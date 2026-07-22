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
const SECTIONS = [
  { kind: "skills", section: "skilltrees", cache: "skilltrees" },
  { kind: "setBonuses", section: "skilltrees", cache: "skilltrees" },
  { kind: "armorSets", section: "armorseries", cache: "armorseries" },
  { kind: "decorations", section: "decorations", cache: "decorations" },
];

// MHWorldData 的 EN 名 與 Kiranico 的 EN 名 已知分歧（同一實體不同英文標籤）的橋接。
// 仍由 Kiranico 的 id 取 zh 值＋出處，非憑記憶——只是換用 Kiranico 的 EN key 去查。
// 例：Fatalis 防具在 MHWorldData 內部名為 "Dragon"，Kiranico 顯示 "Fatalis"。
const EN_ALIAS = {
  armorSets: { "Dragon α+": "Fatalis α+", "Dragon β+": "Fatalis β+" },
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
