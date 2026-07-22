/**
 * World 主源 MHWorldData（gatheringhallstudios/MHWorldData）raw CSV 下載器。
 *
 * 產出磁碟快取 scripts/world/.cache/mhwd/（gitignore）。import-world.mjs 由此讀取，
 * 不直接連網。重跑安全：已存在的檔預設跳過（--force 強制重抓）。
 *
 * pin 到 Phase 0 稽核記錄的 commit（docs/world-data-source-audit.md），
 * 確保凍結的 Iceborne 資料不隨 master 漂移、可重現。
 *
 *   node scripts/world/fetch-mhwd.mjs            # 補齊缺檔
 *   node scripts/world/fetch-mhwd.mjs --force     # 全部重抓
 */
import { mkdirSync, writeFileSync, existsSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CACHE = path.join(HERE, ".cache", "mhwd");
mkdirSync(CACHE, { recursive: true });

// Phase 0 稽核記錄之 commit（MHWorldData master tree），凍結重現用。
const PIN = "be7362213d7d1e30b794e3b58d3f87712035658d";
const BASE = `https://raw.githubusercontent.com/gatheringhallstudios/MHWorldData/${PIN}/source_data`;

const FILES = [
  // 武器
  "weapons/weapon_base.csv",
  "weapons/weapon_base_translations.csv",
  "weapons/weapon_sharpness.csv",
  "weapons/weapon_ammo.csv",
  "weapons/weapon_bow_ext.csv",
  "weapons/weapon_melody_base.csv",
  "weapons/weapon_melody_base_translations.csv",
  "weapons/weapon_melody_notes.csv",
  // 防具
  "armors/armor_base.csv",
  "armors/armor_base_translations.csv",
  "armors/armor_skills_ext.csv",
  "armors/armorset_base.csv",
  "armors/armorset_base_translations.csv",
  "armors/armorset_bonus_base.csv",
  "armors/armorset_bonus_base_translations.csv",
  // 裝飾珠
  "decorations/decoration_base.csv",
  "decorations/decoration_base_translations.csv",
  // 技能
  "skills/skill_base.csv",
  "skills/skill_base_translations.csv",
  "skills/skill_levels.csv",
  // 護石
  "charms/charm_base.csv",
  "charms/charm_base_translations.csv",
  "charms/charm_craft.csv",
];

const force = process.argv.includes("--force");

function cachePath(rel) {
  return path.join(CACHE, rel.replace(/\//g, "__"));
}

async function fetchOne(rel) {
  const dest = cachePath(rel);
  if (!force && existsSync(dest) && statSync(dest).size > 0) {
    return { rel, status: "cached", bytes: statSync(dest).size };
  }
  const url = `${BASE}/${rel}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const text = await res.text();
  writeFileSync(dest, text, "utf8");
  return { rel, status: "fetched", bytes: Buffer.byteLength(text, "utf8") };
}

console.log(`[fetch-mhwd] pin=${PIN.slice(0, 10)} cache=${path.relative(HERE, CACHE)}`);
let fetched = 0,
  cached = 0;
for (const rel of FILES) {
  // 逐檔序列（禮貌 + 避免 raw.githubusercontent 限流）
  const r = await fetchOne(rel);
  if (r.status === "fetched") fetched++;
  else cached++;
  console.log(`  ${r.status.padEnd(7)} ${rel}  (${r.bytes}B)`);
}
console.log(`[fetch-mhwd] done: ${fetched} fetched, ${cached} cached, ${FILES.length} total`);
