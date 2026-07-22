#!/usr/bin/env node
/**
 * World（MHW: Iceborne）推薦配裝爬蟲 — 離線建置腳本，只在本機手動執行。
 * 比照 Rise 的 scrape-game8.js 慣例：磁碟快取（gitignore）、2.5s 禮貌間隔、重跑零抓取、
 * 產出檔不手改、人工裁決進 override 檔。來源＝game8.co MHW「Best {W} Builds for Iceborne」
 * 14 頁（見 docs/world-game8-audit.md）。
 *
 * 名稱映射：Game8 英文名 → MHWorldData `name_en` → 專案 id：
 *   - 防具/武器：以 src/data/world/{armors,weapons}.json 的 nameEn 欄比對。
 *   - 裝飾珠/護石：以 .cache/mhwd/{decorations,charms}__base.csv 的 id + name_en → wdeco_/wcharm_。
 *   - 技能：以 skills.json 的 nameEn → 繁中 name。
 *   正規化：Alpha/Beta/Gamma→α/β/γ、去空白、小寫。對不上者進 game8-en-overrides.json（附出處）。
 *
 * 未模擬系統不丟棄：Safi 覺醒（weapon 名含 Safi）→ awakened；Kjarr → kjarr；meta 隱含客製強化
 *   → customAugment。旗標寫進 build.unmodeled，供 UI 標示與 builder-import 排除。
 *
 * 用法：node scripts/world/scrape-game8-mhwi.mjs [--only=great-sword,bow] [--refresh]
 * 輸出：src/data/world/recommended-builds.json
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..", "..");
const OUT = path.join(REPO, "src", "data", "world", "recommended-builds.json");
const CACHE = path.join(HERE, ".game8-mhwi-cache");
const OVERRIDE_FILE = path.join(HERE, "game8-en-overrides.json");
const DELAY_MS = 2500;
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

const args = process.argv.slice(2);
const ONLY = (args.find((a) => a.startsWith("--only=")) || "").slice(7).split(",").filter(Boolean);
const REFRESH = args.includes("--refresh");

// 14 武器種 → Game8 archive id + 顯示中文（沿用 weaponTypes.json 的 zh）。
const PAGES = [
  ["great-sword", 314144], ["long-sword", 314083], ["sword-and-shield", 314170],
  ["dual-blades", 314162], ["hammer", 314192], ["hunting-horn", 314231],
  ["lance", 314772], ["gunlance", 314799], ["switch-axe", 314805],
  ["charge-blade", 314812], ["insect-glaive", 314855], ["bow", 314871],
  ["light-bowgun", 314934], ["heavy-bowgun", 314965],
];

// h2 階段標題 → 內部 category（實測收斂 3 階，見 audit 第六節）。
function categoryOf(h2) {
  if (/Progression/i.test(h2)) return "worldProgression";
  if (/Endgame Meta Build\b/i.test(h2)) return "worldEndgame";
  if (/Meta Build/i.test(h2)) return "worldMeta";
  return null; // 非配裝區塊（Best Weapons/Skills/Counter/Related…）靜默略過
}

// ───────── 名稱正規化與映射 ─────────
const normEquip = (s) =>
  s
    .normalize("NFKC") // 折疊相容字元（羅馬數字 Ⅰ→I 等）
    .normalize("NFD").replace(/[̀-ͯ]/g, "") // 去重音（Kjárr→Kjarr）
    .replace(/\bAlpha\b/gi, "α").replace(/\bBeta\b/gi, "β").replace(/\bGamma\b/gi, "γ")
    .replace(/\s+/g, "").toLowerCase();
/** 去除 Game8 遠程武器名尾附的「 Attack: NNN」等統計字尾。 */
const stripWeaponStat = (s) => s.replace(/\s+(Attack|Affinity|Element)\s*:.*$/i, "").trim();
const normSkill = (s) => s.replace(/\s+/g, " ").trim().toLowerCase();

function loadJson(p) {
  return JSON.parse(readFileSync(p, "utf8"));
}
function loadCsv(rel) {
  // 極簡 CSV（欄無逗號的 base 檔）：首列表頭。與 lib-csv 同源但避免相依。
  const txt = readFileSync(path.join(HERE, ".cache", "mhwd", rel), "utf8");
  const lines = txt.split(/\r?\n/).filter((l) => l.length);
  const head = splitCsvLine(lines[0]);
  return lines.slice(1).map((l) => {
    const cells = splitCsvLine(l);
    const o = {};
    head.forEach((h, i) => (o[h] = cells[i] ?? ""));
    return o;
  });
}
function splitCsvLine(line) {
  const out = [];
  let cur = "", q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ",") { out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur);
  return out;
}

const overrides = existsSync(OVERRIDE_FILE) ? loadJson(OVERRIDE_FILE) : { armors: {}, weapons: {}, decorations: {}, charms: {}, skills: {} };
const armors = loadJson(path.join(REPO, "src/data/world/armors.json"));
const weapons = loadJson(path.join(REPO, "src/data/world/weapons.json"));
const skills = loadJson(path.join(REPO, "src/data/world/skills.json"));
const decoBase = loadCsv("decorations__decoration_base.csv");
const charmBase = loadCsv("charms__charm_base.csv");

const armorMap = new Map(armors.map((a) => [normEquip(a.nameEn), a.id]));
const weaponMap = new Map(weapons.map((w) => [normEquip(w.nameEn), w.id]));
const decoMap = new Map(decoBase.map((d) => [normEquip(d.name_en), `wdeco_${d.id}`]));
const charmMap = new Map(charmBase.map((c) => [normEquip(c.name_en), `wcharm_${c.id}`]));
const skillMap = new Map(skills.map((s) => [normSkill(s.nameEn), s.name]));
// override 併入（正規化鍵）
for (const [en, id] of Object.entries(overrides.armors || {})) armorMap.set(normEquip(en), id);
for (const [en, id] of Object.entries(overrides.weapons || {})) weaponMap.set(normEquip(en), id);
for (const [en, id] of Object.entries(overrides.decorations || {})) decoMap.set(normEquip(en), id);
for (const [en, id] of Object.entries(overrides.charms || {})) charmMap.set(normEquip(en), id);
for (const [en, zh] of Object.entries(overrides.skills || {})) skillMap.set(normSkill(en), zh);

const unresolved = new Map(); // `${type}:${en}` → {type,en,count,examples}
let curBuildId = null;
function resolve(map, en, type, norm) {
  const id = map.get(norm(en));
  if (id != null) return id;
  const key = `${type}:${en}`;
  const u = unresolved.get(key) ?? { type, en, count: 0, examples: [] };
  u.count++;
  if (curBuildId && u.examples.length < 3 && !u.examples.includes(curBuildId)) u.examples.push(curBuildId);
  unresolved.set(key, u);
  return null;
}

// ───────── HTML 工具 ─────────
const decodeEnt = (s) =>
  s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&nbsp;/g, " ");
const textOf = (h) => decodeEnt(h.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
// Game8 HTML 常有**未閉合 <td>**：以「開啟標籤」切格（非成對匹配），才不會把相鄰格併吞。
const cellsOf = (trHtml) =>
  trHtml.split(/<t[dh][^>]*>/i).slice(1).map((s) => s.replace(/<\/tr>[\s\S]*$/i, ""));
const rowsOf = (html) => [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map((m) => m[1]);
/** 該列的前導 label（首個 <th> 文字，如 Head/Weapon/Armor/Charm）。 */
const rowLabel = (rowHtml) => textOf((rowHtml.match(/<th[^>]*>([\s\S]*?)(?:<\/th>|<td|<th)/i) || [])[1] || "");
/** 該列所有 <a> 連結文字。 */
const rowLinks = (rowHtml) => [...rowHtml.matchAll(/<a[^>]*>([^<]+)<\/a>/g)].map((m) => decodeEnt(m[1]).trim());

/** 解析一格「Decorations」：多個 <a>Name</a> xN。回傳 [{en,count}]。 */
function parseDecoCell(cellHtml) {
  const out = [];
  const re = /<a[^>]*>([^<]+)<\/a>\s*(?:x\s*(\d+))?/g;
  let m;
  while ((m = re.exec(cellHtml))) {
    const en = decodeEnt(m[1]).trim();
    if (!en || /jewel/i.test(en) === false) continue; // 只收珠（防誤收其他連結）
    out.push({ en, count: m[2] ? Number(m[2]) : 1 });
  }
  return out;
}
function mapDecos(list) {
  return list.map((d) => {
    const id = resolve(decoMap, d.en, "decorations", normEquip);
    return id ? { id, count: d.count, rawNameEn: d.en } : { rawNameEn: d.en, count: d.count };
  });
}

/** 解析一格技能「Name N」或「Name」（set bonus 無級數）。 */
function parseSkillCell(cellHtml) {
  const t = textOf(cellHtml);
  if (!t) return null;
  const m = t.match(/^(.*?)(?:\s+(\d+)(?:-\d+)?)?$/);
  const en = (m ? m[1] : t).trim();
  if (!en) return null;
  const level = m && m[2] ? Number(m[2]) : 1;
  return { en, level };
}

const ARMOR_SLOTS = ["head", "chest", "arms", "waist", "legs"];

/** 解析單一 build（h3 到下一 header 間的 HTML）。 */
function parseBuild(html, weaponType, category, buildName, stageName, sourceUrl, idx) {
  curBuildId = `${weaponType}_${category}_${idx}`;
  const tables = [...html.matchAll(/<table[\s\S]*?<\/table>/g)].map((m) => m[0]);
  const build = {
    id: curBuildId, weaponType, category, kind: "full-build",
    buildName, stageName, sourceUrl,
    weapons: [], armor: [], charm: null, skillTotals: [],
    unmodeled: {},
  };
  for (const tbl of tables) {
    const rows = rowsOf(tbl);
    if (!rows.length) continue;
    const head = cellsOf(rows[0]).map(textOf);
    // 註解表（Game8 strategy team + 長句）→ 跳過。
    if (/Game8|strategy/i.test(head[0] || "") || (head.some((h) => h.length > 60))) continue;

    if (/^Weapon/i.test(head[0] || "")) {
      // 裝備表：單一 table 內混 Weapon 列 + Armor 子標頭 + 5 防具 + Charm（Game8 HTML 未閉合 td、
      // 列版型不一）。改以**連結驅動**：裝備名＝首個非 Jewel <a>、珠＝Jewel <a>。section 由
      // 無連結的子標頭（Weapon/Armor）切換。
      let section = null, armorIdx = 0;
      for (const r of rows) {
        const links = rowLinks(r);
        const label = rowLabel(r);
        if (links.length === 0) {
          if (/Weapon/i.test(label)) section = "weapon";
          else if (/Armor/i.test(label)) section = "armor";
          continue; // 子標頭（Weapon|Decorations / Armor|Decorations）
        }
        const nameLinks = links.filter((l) => !/Jewel/i.test(l));
        const decos = mapDecos(parseDecoCell(r));
        if (/Charm/i.test(label)) {
          const en = nameLinks[0];
          if (en) { const id = resolve(charmMap, en, "charms", normEquip); build.charm = id ? { id, rawNameEn: en } : { rawNameEn: en }; }
          continue;
        }
        const en0 = nameLinks[0];
        if (!en0) continue;
        if (section === "weapon") {
          const en = stripWeaponStat(en0);
          const id = resolve(weaponMap, en, "weapons", normEquip);
          const w = { rawNameEn: en, decorations: decos };
          if (id) w.id = id;
          build.weapons.push(w);
        } else if (section === "armor" && armorIdx < 5) {
          const id = resolve(armorMap, en0, "armors", normEquip);
          const piece = { slot: ARMOR_SLOTS[armorIdx], rawNameEn: en0, decorations: decos };
          if (id) piece.id = id;
          build.armor.push(piece);
          armorIdx++;
        }
      }
    } else {
      // 技能表：每格「Name N」。
      for (const r of rows) {
        for (const cell of cellsOf(r)) {
          const sk = parseSkillCell(cell);
          if (!sk) continue;
          const zh = skillMap.get(normSkill(sk.en));
          if (zh) build.skillTotals.push({ id: zh, level: sk.level, rawNameEn: sk.en });
          else build.skillTotals.push({ rawNameEn: sk.en, level: sk.level, setBonusOrUnknown: true });
        }
      }
    }
  }
  // 未模擬系統旗標
  const wEn = build.weapons[0]?.rawNameEn || "";
  if (/Safi'?s |Safi'?jiiva/i.test(wEn)) build.unmodeled.awakened = true;
  if (/Kjarr/i.test(wEn)) build.unmodeled.kjarr = true;
  if (category === "worldEndgame" || category === "worldMeta") build.unmodeled.customAugment = true;
  return build;
}

/** 解析整頁：walk headers。 */
function parsePage(html, weaponType, sourceUrl) {
  const hdrs = [...html.matchAll(/a-header--([23])' id='(h[lm]_\d+)'>([^<]+)/g)]
    .map((m) => ({ lvl: +m[1], name: decodeEnt(m[3]).trim(), pos: m.index }));
  const builds = [];
  let curCat = null, idx = 0;
  for (let i = 0; i < hdrs.length; i++) {
    const hd = hdrs[i];
    if (hd.lvl === 2) { curCat = categoryOf(hd.name); continue; }
    if (hd.lvl === 3 && curCat) {
      const end = hdrs[i + 1] ? hdrs[i + 1].pos : hd.pos + 6000;
      const seg = html.slice(hd.pos, end);
      builds.push(parseBuild(seg, weaponType, curCat, hd.name, hd.name, sourceUrl, idx++));
    }
  }
  return builds;
}

// ───────── 抓取（cache-first，2.5s 間隔）─────────
async function fetchPage(id) {
  if (!existsSync(CACHE)) mkdirSync(CACHE, { recursive: true });
  const f = path.join(CACHE, `${id}.html`);
  if (existsSync(f) && !REFRESH) return readFileSync(f, "utf8");
  const url = `https://game8.co/games/Monster-Hunter-World/archives/${id}`;
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`fetch ${id} → HTTP ${res.status}`);
  const html = await res.text();
  writeFileSync(f, html, "utf8");
  await new Promise((r) => setTimeout(r, DELAY_MS));
  return html;
}

async function main() {
  const targets = PAGES.filter(([wt]) => ONLY.length === 0 || ONLY.includes(wt));
  const allBuilds = [];
  for (const [wt, id] of targets) {
    const url = `https://game8.co/games/Monster-Hunter-World/archives/${id}`;
    const html = await fetchPage(id);
    const builds = parsePage(html, wt, url);
    allBuilds.push(...builds);
    console.log(`${wt.padEnd(16)} ${builds.length} 筆`);
  }
  const out = {
    meta: {
      source: "Game8 — Monster Hunter World (Iceborne) Builds",
      attribution: "https://game8.co/games/Monster-Hunter-World",
      scrapedAt: new Date().toISOString().slice(0, 10),
      gameId: "world",
      schemaDoc: "docs/world-game8-audit.md",
    },
    builds: allBuilds,
    unresolved: [...unresolved.values()].sort((a, b) => b.count - a.count),
  };
  mkdirSync(path.dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(out, null, 2) + "\n", "utf8");

  console.log(`\n[scrape-mhwi] 產出 ${allBuilds.length} 筆 → src/data/world/recommended-builds.json`);
  const byCat = {};
  for (const b of allBuilds) byCat[b.category] = (byCat[b.category] ?? 0) + 1;
  console.log("  分階:", JSON.stringify(byCat));
  const flagged = allBuilds.filter((b) => b.unmodeled.awakened || b.unmodeled.kjarr).length;
  console.log(`  含未模擬旗標(awakened/kjarr): ${flagged} 筆`);
  console.log(`\n[scrape-mhwi] 未解析名稱 ${out.unresolved.length} 類:`);
  for (const u of out.unresolved.slice(0, 40)) console.log(`  [${u.type}] ${u.en} ×${u.count} (例 ${u.examples.join(",")})`);
}

main().catch((e) => { console.error(e); process.exit(1); });
