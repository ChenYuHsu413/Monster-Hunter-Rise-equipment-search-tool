/**
 * World 繁中名映射建立器（PLAN Phase 2，G2）。
 *
 * MHWorldData 少數實體（集中 Fatalis 系 + 活動套）缺 name_zh。此腳本以 **Kiranico World
 * 的穩定 id 跨語系配對**（en 與 zh-Hant 同一 id、不同 slug）建 EN→繁中 映射，
 * 非憑記憶——每筆附 Kiranico zh-Hant url 作為出處，寫入 zh-name-overrides.json。
 *
 * Kiranico 以瀏覽器 UA 可取（比照 import-kiranico.mjs 經驗），磁碟快取 + 2.5s 禮貌間隔。
 *
 *   node scripts/world/build-zh-name-map.mjs           # 抓取（快取）→ 更新 overrides
 *   node scripts/world/build-zh-name-map.mjs --dry       # 只印建議，不寫 overrides
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CACHE = path.join(HERE, ".cache", "kiranico");
mkdirSync(CACHE, { recursive: true });
const OVERRIDE_FILE = path.join(HERE, "zh-name-overrides.json");
const GAPS_FILE = path.join(CACHE, "..", "zh-gaps.json");
const DRY = process.argv.includes("--dry");

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";
const BASE = "https://mhworld.kiranico.com";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchCached(url, cacheKey) {
  const file = path.join(CACHE, cacheKey);
  if (existsSync(file)) return readFileSync(file, "utf8");
  await sleep(2500); // 禮貌間隔
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  const text = await res.text();
  writeFileSync(file, text, "utf8");
  return text;
}

/** 解析某 section 頁的 (id → {name, slug}) 映射。 */
function parseSection(html, section) {
  const re = new RegExp(
    `${section}/([A-Za-z0-9]+)/([a-z0-9-]+)"[^>]*>([^<]+)`,
    "g"
  );
  const map = {};
  let m;
  while ((m = re.exec(html))) {
    const [, id, slug, name] = m;
    if (!map[id]) map[id] = { name: name.trim(), slug };
  }
  return map;
}

/** 抓一個 section 的 en + zh-Hant，以 id join → [{en, zh, url}]。 */
async function pairSection(section, cacheName) {
  const enHtml = await fetchCached(`${BASE}/en/${section}`, `${cacheName}.en.html`);
  const zhHtml = await fetchCached(`${BASE}/zh-Hant/${section}`, `${cacheName}.zh.html`);
  const en = parseSection(enHtml, section.split("?")[0]);
  const zh = parseSection(zhHtml, section.split("?")[0]);
  const pairs = [];
  for (const id of Object.keys(en)) {
    if (zh[id]) {
      pairs.push({
        id,
        en: en[id].name,
        zh: zh[id].name,
        url: `${BASE}/zh-Hant/${section.split("?")[0]}/${id}/${zh[id].slug}`,
      });
    }
  }
  return pairs;
}

// ---- sections：kind（對映 zh-gaps.json 的鍵）→ Kiranico section 名 ----
// Kiranico 把 set bonus 放在 skilltrees、armor 系列放在 armorseries。
// weapons / armors 走各自的專用配對（見下），因結構特殊不套 parseSection 泛式：
//   - weapons：/weapons 是 Livewire 分頁，伺服端只渲染單一武器種；需逐 type（?type=0-13）
//     抓 en/zh 再以「同一 detail id 跨語系」配對。
//   - armors：/armors 為平面列表，但每件連到其「防具系列」armorseries/{setId}（id 為 set 級、
//     非 piece 級），故不能靠 id join piece；改以 en/zh 兩頁「同序（逐列 setId 對齊）」位置配對。
const SECTIONS = [
  { kind: "skills", section: "skilltrees", cache: "skilltrees" },
  { kind: "setBonuses", section: "skilltrees", cache: "skilltrees" },
  { kind: "armorSets", section: "armorseries", cache: "armorseries" },
  { kind: "decorations", section: "decorations", cache: "decorations" },
  // monsters：/monsters 平面索引，id 跨語系配對即可（供 armor sourceMonster 顯示層 zh）。
  { kind: "monsters", section: "monsters", cache: "monsters" },
];

// 名稱正規化（塌縮連續空白）：MHWorldData 少數 name_en 有雙空格（如 "Tentacle Cowl  γ+"），
// 與 Kiranico 顯示名的單空格不一致，直接比對會靜默 miss。比對用塌縮版，
// 但 override 的 key 一律用「原始 gap 名（raw name_en）」——import-world 的 ov() 是精確 key 命中。
const collapse = (s) => String(s).replace(/\s+/g, " ").trim();

// MHWorldData 的 EN 名 與 Kiranico 的 EN 名 已知分歧（同一實體不同英文標籤）的橋接。
// 仍由 Kiranico 的 id 取 zh 值＋出處，非憑記憶——只是換用 Kiranico 的 EN key 去查。
// 例：Fatalis 防具在 MHWorldData 內部名為 "Dragon"，Kiranico 顯示 "Fatalis"。
const EN_ALIAS = {
  armorSets: { "Dragon α+": "Fatalis α+", "Dragon β+": "Fatalis β+" },
};

// 活動限定 α+ 防具系列（Passionate/Demonlord/Artemis）**不在** /armorseries 索引頁，
// 但其防具「零件」在 /armors 平面列表中連到各自的 armorseries/{id}（見 armors resolver）。
// 這裡以「該 set 的穩定 Kiranico id」為指標，抓 detail 頁 <title> 取 zh 集合名（非憑記憶：
// zh 值仍即時抓取＋附 src）。id 由 /armors 零件列反查取得（Passionate Headdress α+ 等）。
const ARMORSET_DETAIL = {
  "Passionate α+": { id: "73EbB", slug: "passion-a" },
  "Demonlord α+": { id: "BPZ07", slug: "demonlord-a" },
  "Artemis α+": { id: "5bZq5", slug: "artemis-a" },
};
// Kiranico detail 頁 <title> 形如「NAME - MH:World - Kiranico ...」，取首段即集合名。
const titleName = (html) => {
  const m = html.match(/<title>([^<]+?)\s*-\s*MH:World/);
  return m ? m[1].trim() : null;
};

const gaps = existsSync(GAPS_FILE) ? JSON.parse(readFileSync(GAPS_FILE, "utf8")) : {};
const overrides = existsSync(OVERRIDE_FILE)
  ? JSON.parse(readFileSync(OVERRIDE_FILE, "utf8"))
  : {};

let filled = 0;
const unresolved = {};
for (const { kind, section, cache } of SECTIONS) {
  const wanted = new Set(gaps[kind] ?? []);
  if (wanted.size === 0) continue;
  const pairs = await pairSection(section, cache);
  const byEn = {};
  for (const p of pairs) byEn[p.en] = p;
  overrides[kind] ??= {};
  const alias = EN_ALIAS[kind] ?? {};
  const missing = [];
  for (const en of wanted) {
    const hit = byEn[en] ?? byEn[alias[en]];
    if (hit) {
      overrides[kind][en] = {
        zh: hit.zh,
        src: hit.url,
        ...(alias[en] ? { via: `Kiranico EN "${alias[en]}"（MHWorldData EN "${en}" 別名橋接）` } : {}),
      };
      filled++;
    } else {
      missing.push(en);
    }
  }
  if (missing.length) unresolved[kind] = missing;
  console.log(`[zh-map] ${kind}: ${wanted.size - missing.length}/${wanted.size} 由 Kiranico ${section} 解出`);
}

// ---------------------------------------------------------------------
// armorSets 補救：活動 α+ 系列不在索引頁，改抓各 set 的 armorseries detail 頁 <title>。
// ---------------------------------------------------------------------
if (unresolved.armorSets?.length) {
  overrides.armorSets ??= {};
  const before = unresolved.armorSets.length;
  const still = [];
  for (const en of unresolved.armorSets) {
    const d = ARMORSET_DETAIL[en];
    if (!d) { still.push(en); continue; }
    const html = await fetchCached(`${BASE}/zh-Hant/armorseries/${d.id}/${d.slug}`, `armorseries.${d.id}.zh.html`);
    const zh = titleName(html);
    if (zh) {
      overrides.armorSets[en] = { zh, src: `${BASE}/zh-Hant/armorseries/${d.id}/${d.slug}`, via: "armorseries detail <title>（活動 α+ 系列不在索引頁）" };
      filled++;
    } else {
      still.push(en);
    }
  }
  if (still.length) unresolved.armorSets = still; else delete unresolved.armorSets;
  console.log(`[zh-map] armorSets(detail 補救): ${before - still.length}/${before} 由 detail 頁解出`);
}

// ---------------------------------------------------------------------
// weapons：/weapons 依 Livewire ?type=N 分頁（0-13 對映 14 武器種），逐型抓 en/zh，
// 以「同一 detail id 跨語系」配對。override key 用原始 gap 名。
// ---------------------------------------------------------------------
{
  const rawWanted = gaps.weapons ?? [];
  if (rawWanted.length) {
    const rawByCollapse = {};
    for (const r of rawWanted) rawByCollapse[collapse(r)] = r;
    const enById = {};
    const zhById = {};
    for (let ty = 0; ty <= 13; ty++) {
      const enH = await fetchCached(`${BASE}/en/weapons?type=${ty}`, `weapons.t${ty}.en.html`);
      const zhH = await fetchCached(`${BASE}/zh-Hant/weapons?type=${ty}`, `weapons.t${ty}.zh.html`);
      Object.assign(enById, parseSection(enH, "weapons"));
      Object.assign(zhById, parseSection(zhH, "weapons"));
    }
    const byEn = {};
    for (const id of Object.keys(enById)) {
      if (zhById[id]) byEn[collapse(enById[id].name)] = { zh: zhById[id].name, id, slug: zhById[id].slug };
    }
    overrides.weapons ??= {};
    const missing = [];
    for (const raw of rawWanted) {
      const hit = byEn[collapse(raw)];
      if (hit) {
        overrides.weapons[raw] = { zh: hit.zh, src: `${BASE}/zh-Hant/weapons/${hit.id}/${hit.slug}` };
        filled++;
      } else {
        missing.push(raw);
      }
    }
    if (missing.length) unresolved.weapons = missing;
    console.log(`[zh-map] weapons: ${rawWanted.length - missing.length}/${rawWanted.length} 由 Kiranico weapons(?type 0-13) 解出`);
  }
}

// ---------------------------------------------------------------------
// armors：/armors 平面列表，逐件連到其 armorseries/{setId}（id 為 set 級，非 piece 級），
// 故不能靠 id join；改以 en/zh 兩頁「同序（逐列 setId 對齊）」位置配對。
// 對齊性以「逐列 setId 一致」硬檢查，不齊即中止（避免 Kiranico 版本漂移造成整批錯配）。
// ---------------------------------------------------------------------
{
  const rawWanted = gaps.armors ?? [];
  if (rawWanted.length) {
    const enH = await fetchCached(`${BASE}/en/armors`, `armors.en.html`);
    const zhH = await fetchCached(`${BASE}/zh-Hant/armors`, `armors.zh.html`);
    const pieces = (html) =>
      [...html.matchAll(/armorseries\/([A-Za-z0-9]+)\/([a-z0-9-]+)">([^<]+)<\/a>/g)].map((m) => ({
        id: m[1],
        slug: m[2],
        name: m[3].trim(),
      }));
    const en = pieces(enH);
    const zh = pieces(zhH);
    const aligned = en.length === zh.length && en.every((e, i) => e.id === zh[i].id);
    if (!aligned) {
      throw new Error(
        `[zh-map] armors en/zh 未逐列對齊（en=${en.length} zh=${zh.length}）——Kiranico 版本漂移，中止以免錯配`
      );
    }
    const byEn = {};
    for (let i = 0; i < en.length; i++) {
      byEn[collapse(en[i].name)] = { zh: zh[i].name, id: zh[i].id, slug: zh[i].slug };
    }
    overrides.armors ??= {};
    const missing = [];
    for (const raw of rawWanted) {
      const hit = byEn[collapse(raw)];
      if (hit) {
        overrides.armors[raw] = { zh: hit.zh, src: `${BASE}/zh-Hant/armorseries/${hit.id}/${hit.slug}` };
        filled++;
      } else {
        missing.push(raw);
      }
    }
    if (missing.length) unresolved.armors = missing;
    console.log(`[zh-map] armors: ${rawWanted.length - missing.length}/${rawWanted.length} 由 Kiranico armors(平面列表位置配對) 解出`);
  }
}

console.log(`\n[zh-map] 合計填入 overrides：${filled} 筆`);
for (const [kind, list] of Object.entries(unresolved)) {
  console.log(`  未解 ${kind} (${list.length}): ${list.join(", ")}`);
}

if (DRY) {
  console.log("\n[zh-map] --dry：不寫檔");
} else {
  writeFileSync(OVERRIDE_FILE, JSON.stringify(overrides, null, 2) + "\n", "utf8");
  console.log(`\n[zh-map] overrides 已更新 → ${path.relative(path.resolve(HERE, "..", ".."), OVERRIDE_FILE)}`);
}
