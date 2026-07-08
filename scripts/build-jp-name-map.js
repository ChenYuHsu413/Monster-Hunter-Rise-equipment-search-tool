#!/usr/bin/env node
/**
 * 日文名稱對照表產生器 — 為 Game8 推薦配裝（scrape-game8.js）建立
 * 「日文名 → 專案內部 ID」對照，供顯示端一律透過內部 ID 查現有繁中資料。
 *
 * 原理：專案內部 ID（weapon_/armor_/deco_ 的數字段）就是 Kiranico 的數字 ID，
 * 跨語言一致。故抓 Kiranico **日文版**列表頁取（數字ID, 日文名），組出
 * 日文名→內部ID；技能因內部 ID 就是繁中名（無數字 ID），改抓 ja+zh 兩版
 * 以數字 ID join（ja名→zh名）。只輸出「內部 ID 確實存在於專案資料」的條目。
 *
 * 比對哲學（依使用者指示）：
 * 1. 先正規化（NFKC + 去空白 + 大寫，見 game8-normalize.js）再精確比對，
 *    吸收全形/半形、羅馬數字 Ⅰ/Ⅱ vs I/II 等格式差異。
 * 2. 精確比對失敗者「不自動猜」——輸出建議檔（每筆附編輯距離最近的 2-3 個
 *    Kiranico 候選名＋其內部 ID）供人工勾選，不默默採用最相近者。
 *
 * 產出：data/jp-name-map.json（人工可增補）、data/jp-name-map.suggestions.json。
 * 禮貌抓取：2.5s 間隔＋正常 UA，列表頁 HTML 快取到 scripts/.cache/（gitignore）。
 * 用法：node scripts/build-jp-name-map.js [--refresh]
 */
const fs = require("node:fs");
const path = require("node:path");
const { normalizeJa } = require("./game8-normalize.js");

const ROOT = path.join(__dirname, "..");
const SRC = path.join(ROOT, "src", "data");
const CACHE = path.join(__dirname, ".cache");
const MAP_FILE = path.join(ROOT, "data", "jp-name-map.json");
const OVERRIDE_FILE = path.join(ROOT, "data", "jp-name-overrides.json");
const SUGGEST_FILE = path.join(ROOT, "data", "jp-name-map.suggestions.json");
const BUILDS_FILE = path.join(ROOT, "data", "recommended-builds.json");

/** 部位後綴 token（A/B 二擇一防具的後綴重建用）。 */
const ARMOR_SUFFIX =
  /(ヘルム|メイル|アーム|コイル|グリーヴ|グリーブ|クラウン|フォールド|ペイル|アンカ|ガンバ|キャップ|レジスト|ベスト|ロッド|フープ|マスク|コート|スーツ|レギンス|アンク|イラム|クイス|ラーマ|オッハ|ライース|トロンコ|フロール|【[^】]*】[^【】]*)$/;

/** 「A/Bヘルム」→ ["Aヘルム", "Bヘルム"]（末段完整，前段補末段後綴）。非 A/B 回 null。 */
function splitAlternatives(name) {
  const parts = name.split("/");
  if (parts.length < 2) return null;
  const last = parts[parts.length - 1];
  const sm = last.match(ARMOR_SUFFIX);
  const suf = sm ? sm[1] : "";
  return parts.map((p, i) => (i === parts.length - 1 || p.match(ARMOR_SUFFIX) ? p : p + suf));
}

const HOST = "https://mhrise.kiranico.com";
const UA = { "User-Agent": "Mozilla/5.0 (data import for personal armor builder)" };
const DELAY = 2500;
const REFRESH = process.argv.includes("--refresh");

// ---------- 禮貌抓取（快取） ----------
let last = 0;
async function fetchCached(url, key) {
  const file = path.join(CACHE, `${key}.html`);
  if (!REFRESH && fs.existsSync(file)) return fs.readFileSync(file, "utf8");
  const wait = last + DELAY - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  console.log(`  ↓ ${url}`);
  let html = null;
  for (let i = 0; i < 3 && html == null; i++) {
    try {
      const res = await fetch(url, { headers: UA });
      last = Date.now();
      if (res.ok) html = await res.text();
      else console.warn(`  ${res.status} ${url} (retry ${i + 1})`);
    } catch (e) {
      console.warn(`  err ${e.message} (retry ${i + 1})`);
    }
    if (html == null) await new Promise((r) => setTimeout(r, 800));
  }
  if (html == null) throw new Error(`failed: ${url}`);
  fs.mkdirSync(CACHE, { recursive: true });
  fs.writeFileSync(file, html);
  return html;
}

/** 列表頁 → [{numId, name}]。skills 名稱在巢狀 <p>，其餘在 anchor 文字。 */
function parseList(html, kind) {
  const out = [];
  if (kind === "skills") {
    for (const m of html.matchAll(/data\/skills\/(\d+)"[\s\S]{0,120}?<p[^>]*>([^<]+)<\/p>/g)) {
      out.push({ numId: m[1], name: m[2].trim() });
    }
  } else {
    const re = new RegExp(`data/${kind}/(\\d+)">([^<]+)</a>`, "g");
    for (const m of html.matchAll(re)) out.push({ numId: m[1], name: m[2].trim() });
  }
  return out;
}

// ---------- 專案內部 ID / 名稱集合 ----------
const projWeapons = new Set(JSON.parse(fs.readFileSync(path.join(SRC, "weapons.json"), "utf8")).map((x) => x.id));
const projArmors = new Set(JSON.parse(fs.readFileSync(path.join(SRC, "armors.json"), "utf8")).map((x) => x.id));
const projDecos = new Set(JSON.parse(fs.readFileSync(path.join(SRC, "decorations.json"), "utf8")).map((x) => x.id));
const projSkills = new Set(JSON.parse(fs.readFileSync(path.join(SRC, "skills.json"), "utf8")).map((x) => x.name));

// ---------- 編輯距離（建議檔用） ----------
function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  if (Math.abs(m - n) > 8) return Math.abs(m - n) + Math.min(m, n); // 早剪枝
  const dp = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j];
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return dp[n];
}

async function main() {
  // ---- 抓列表、組對照 ----
  const map = { skills: {}, armors: {}, decorations: {}, weapons: {} };
  const pool = { skills: [], armors: [], decorations: [], weapons: [] }; // {name, norm, id}
  const collisions = [];

  // 命名衝突（同名→不同 ID）幾乎全為防具性別雙胞胎（男/女版同名同技能同數值，
  // 僅外觀不同）。以列表順序 first-wins 取一件即可（功能等價），衝突記錄供稽核。
  const add = (type, name, id) => {
    const norm = normalizeJa(name);
    if (map[type][norm] != null && map[type][norm] !== id) {
      collisions.push({ type, norm, name, existing: map[type][norm], incoming: id });
      return;
    }
    map[type][norm] = id;
    pool[type].push({ name, norm, id });
  };

  console.log("→ Kiranico ja 武器（14 類）");
  for (let v = 0; v <= 13; v++) {
    const html = await fetchCached(`${HOST}/ja/data/weapons?view=${v}`, `ja-weapons-${v}`);
    for (const { numId, name } of parseList(html, "weapons")) {
      const id = `weapon_${numId}`;
      if (projWeapons.has(id)) add("weapons", name, id);
    }
  }
  console.log("→ Kiranico ja 防具（RARE 1-10）");
  for (let v = 0; v <= 9; v++) {
    const html = await fetchCached(`${HOST}/ja/data/armors?view=${v}`, `ja-armors-${v}`);
    for (const { numId, name } of parseList(html, "armors")) {
      const id = `armor_${numId}`;
      if (projArmors.has(id)) add("armors", name, id);
    }
  }
  console.log("→ Kiranico ja 裝飾珠");
  {
    const html = await fetchCached(`${HOST}/ja/data/decorations`, "ja-decorations");
    for (const { numId, name } of parseList(html, "decorations")) {
      const id = `deco_${numId}`;
      if (projDecos.has(id)) add("decorations", name, id);
    }
  }
  console.log("→ Kiranico ja+zh 技能（以數字 ID join）");
  {
    const jaHtml = await fetchCached(`${HOST}/ja/data/skills`, "ja-skills");
    const zhHtml = await fetchCached(`${HOST}/zh-Hant/data/skills`, "zh-skills");
    const zhById = {};
    for (const { numId, name } of parseList(zhHtml, "skills")) zhById[numId] = name;
    for (const { numId, name } of parseList(jaHtml, "skills")) {
      const zh = zhById[numId];
      if (zh && projSkills.has(zh)) add("skills", name, zh);
    }
  }

  const counts = Object.fromEntries(Object.entries(map).map(([k, v]) => [k, Object.keys(v).length]));
  console.log(`  對照條目：${JSON.stringify(counts)}；命名衝突 ${collisions.length}（防具性別雙胞胎，first-wins 取一件）`);

  // ---- 合併人工 override（重跑安全：人工判斷全收在 data/jp-name-overrides.json，
  //      override 優先蓋過自動結果；★不從產出檔回讀，重跑不會沖掉人工成果）----
  const projById = { weapons: projWeapons, armors: projArmors, decorations: projDecos, skills: projSkills };
  let override = {};
  try {
    override = JSON.parse(fs.readFileSync(OVERRIDE_FILE, "utf8"));
  } catch {}
  const ovApplied = { skills: 0, armors: 0, decorations: 0, weapons: 0, alternatives: 0 };
  const ovBad = [];
  for (const type of ["skills", "armors", "decorations", "weapons"]) {
    for (const [rawName, id] of Object.entries(override[type] ?? {})) {
      if (rawName.startsWith("$")) continue;
      if (!projById[type].has(id)) {
        ovBad.push(`${type}.${rawName}→${id}（ID 不在專案資料）`);
        continue;
      }
      map[type][normalizeJa(rawName)] = id;
      ovApplied[type]++;
    }
  }
  // alternatives（A/B 二擇一）：值為內部 ID 陣列，第一個為主裝備
  const alternatives = {};
  for (const [rawName, ids] of Object.entries(override.alternatives ?? {})) {
    if (rawName.startsWith("$")) continue;
    const bad = (ids ?? []).filter((id) => !projArmors.has(id));
    if (!Array.isArray(ids) || ids.length < 2 || bad.length) {
      ovBad.push(`alternatives.${rawName}（需 ≥2 個有效 armor ID；無效：${bad.join(",") || "格式"}）`);
      continue;
    }
    alternatives[normalizeJa(rawName)] = ids;
    ovApplied.alternatives++;
  }
  map.alternatives = alternatives;
  if (ovBad.length) console.warn(`  ⚠ override 無效項 ${ovBad.length}：\n     ${ovBad.join("\n     ")}`);
  fs.writeFileSync(MAP_FILE, JSON.stringify(map, null, 1) + "\n");
  console.log(`✓ data/jp-name-map.json（合併 override：${JSON.stringify(ovApplied)}）`);

  // ---- 建議檔：對 recommended-builds.json 仍比不到者，附最近候選 ----
  let builds;
  try {
    builds = JSON.parse(fs.readFileSync(BUILDS_FILE, "utf8"));
  } catch {
    console.log("（尚無 recommended-builds.json，略過建議檔）");
    return;
  }
  // 仍未解析者＝(a) 一般名不在 map，或 (b) A/B 二擇一名不在 map.alternatives
  const still = builds.unresolved.filter((u) => {
    const norm = normalizeJa(u.rawNameJa);
    if (u.type === "armors" && u.rawNameJa.includes("/")) return map.alternatives[norm] == null;
    return map[u.type]?.[norm] == null;
  });
  const suggestions = still.map((u) => {
    const norm = normalizeJa(u.rawNameJa);
    const base = { type: u.type, rawNameJa: u.rawNameJa, game8Id: u.game8Id, count: u.count, examples: u.examples };
    // A/B 二擇一防具：分割器重建後綴，每個替代裝備各給最近候選（不直接採用，供人工填 override.alternatives）
    const alts = u.type === "armors" ? splitAlternatives(u.rawNameJa) : null;
    if (alts) {
      base.kind = "alternatives";
      base.alternativeCandidates = alts.map((part) => {
        const pn = normalizeJa(part);
        return {
          reconstructed: part,
          candidates: pool.armors
            .map((c) => ({ name: c.name, id: c.id, distance: levenshtein(pn, c.norm) }))
            .sort((a, b) => a.distance - b.distance)
            .slice(0, 2),
        };
      });
      // 附上「兩件皆 exact-match」時可直接填入 override 的 ID 陣列
      const exact = base.alternativeCandidates.map((a) => (a.candidates[0]?.distance === 0 ? a.candidates[0].id : null));
      if (exact.every(Boolean)) base.suggestedOverride = exact;
      return base;
    }
    base.candidates = pool[u.type]
      .map((c) => ({ name: c.name, id: c.id, distance: levenshtein(norm, c.norm) }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 3);
    return base;
  });
  suggestions.sort((a, b) => a.type.localeCompare(b.type) || b.count - a.count);
  fs.writeFileSync(
    SUGGEST_FILE,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString().slice(0, 10),
        note: "正規化後精確比對仍失敗者，多為 Game8 暱稱/簡稱/錯字/二擇一寫法。★確認後填 data/jp-name-overrides.json（勿手改 jp-name-map.json），重跑 build-jp-name-map.js → scrape-game8.js 回填。一般項：candidates 為編輯距離最近 2-3 候選，把確認 ID 填進 override 對應 type。二擇一項（kind=alternatives，防具 A/B）：alternativeCandidates 列各替代裝備的重建名＋候選；suggestedOverride 為兩件皆 exact-match 時可直接填入 override.alternatives 的 ID 陣列。",
        counts: still.reduce((a, u) => ((a[u.type] = (a[u.type] ?? 0) + 1), a), {}),
        items: suggestions,
      },
      null,
      1
    ) + "\n"
  );
  console.log(`✓ data/jp-name-map.suggestions.json：${suggestions.length} 筆待人工（${JSON.stringify(
    still.reduce((a, u) => ((a[u.type] = (a[u.type] ?? 0) + 1), a), {})
  )}）`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
