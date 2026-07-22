/**
 * World 產出稽核（PLAN Phase 2）。以**獨立外部源**（mhw-db.com API，非同源自查）
 * 交叉核對筆數，並報 zh 覆蓋率、secret/set bonus 抽驗、三筆已知實體。
 *
 *   node scripts/world/audit-world-data.mjs
 *
 * mhw-db.com 回應快取於 .cache/mhwdb/（gitignore）；重跑零抓取。
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..", "..");
const WORLD = path.join(REPO, "src", "data", "world");
const DBCACHE = path.join(HERE, ".cache", "mhwdb");
mkdirSync(DBCACHE, { recursive: true });

const load = (f) => JSON.parse(readFileSync(path.join(WORLD, f), "utf8"));
const skills = load("skills.json");
const decorations = load("decorations.json");
const charms = load("charms.json");
const setBonuses = load("setBonuses.json");
const armors = load("armors.json");
const weapons = load("weapons.json");
const weaponTypes = load("weaponTypes.json");

let warns = 0;
const warn = (m) => {
  warns++;
  console.log("  ⚠️  " + m);
};
const ok = (m) => console.log("  ✓  " + m);

// ---- 1) 獨立外部源交叉：mhw-db.com 筆數 ----
async function dbCount(ep) {
  const file = path.join(DBCACHE, ep.replace(/\//g, "__") + ".json");
  let json;
  if (existsSync(file)) json = JSON.parse(readFileSync(file, "utf8"));
  else {
    const res = await fetch(`https://mhw-db.com/${ep}`);
    if (!res.ok) throw new Error(`HTTP ${res.status} ${ep}`);
    json = await res.json();
    writeFileSync(file, JSON.stringify(json), "utf8");
  }
  return json;
}
function cmp(label, world, ext, tol = 0.02) {
  const diff = Math.abs(world - ext) / Math.max(ext, 1);
  const s = `${label}: world=${world} vs mhw-db=${ext} (Δ${(diff * 100).toFixed(1)}%)`;
  if (diff > tol) warn(s + " ＞2%，需解釋");
  else ok(s);
}

console.log("=== 1) 獨立外部源交叉（mhw-db.com）===");
try {
  const dbArmor = await dbCount("armor");
  const dbDeco = await dbCount("decorations");
  const dbSkills = await dbCount("skills");
  // mhw-db charms 為 object（含 ranks），展開為逐級數
  const dbCharms = await dbCount("charms");
  const dbCharmLevels = dbCharms.reduce((n, c) => n + (c.ranks?.length ?? 1), 0);
  cmp("防具件數", armors.length, dbArmor.length);
  cmp("裝飾珠", decorations.length, dbDeco.length);
  cmp("技能", skills.length, dbSkills.length);
  cmp("護石（逐級）", charms.length, dbCharmLevels);
  // 武器：mhw-db 停在基礎版（G1），不可交叉；僅記錄
  ok(`武器 world=${weapons.length}（mhw-db 停在基礎版 World，不交叉；見稽核文件 G1）`);
} catch (e) {
  warn("mhw-db.com 交叉失敗（離線？）：" + e.message);
}

// ---- 2) zh 覆蓋率（EN fallback 偵測）----
console.log("\n=== 2) zh 覆蓋率（EN fallback = nameZh 等於 nameEn）===");
function zhCov(label, arr, zhKey, enKey) {
  const miss = arr.filter((x) => x[zhKey] && x[enKey] && x[zhKey] === x[enKey]);
  const pct = ((100 * (arr.length - miss.length)) / arr.length).toFixed(1);
  const s = `${label}: ${arr.length - miss.length}/${arr.length} (${pct}%)`;
  if (miss.length) warn(s + `，未映射 ${miss.length}`);
  else ok(s);
  return miss.map((x) => x[enKey]);
}
const gapReport = {
  skills: zhCov("技能", skills, "name", "nameEn"),
  decorations: zhCov("裝飾珠", decorations, "nameZh", null) && [],
  armors: zhCov("防具", armors, "nameZh", "nameEn"),
  weapons: zhCov("武器", weapons, "nameZh", "nameEn"),
  setBonuses: zhCov("套裝加成", setBonuses, "nameZh", "nameEn"),
};
// decorations/charms 無 nameEn 欄，改對 zh-gaps.json
const gapsFile = path.join(HERE, ".cache", "zh-gaps.json");
if (existsSync(gapsFile)) {
  const g = JSON.parse(readFileSync(gapsFile, "utf8"));
  for (const k of ["decorations", "charms", "armorSets"]) {
    if (g[k]?.length) warn(`${k}: 未映射 ${g[k].length}（見 zh-gaps.json）`);
  }
}

// ---- 3) secret / set bonus 抽驗 ----
console.log("\n=== 3) secret 技能推導抽驗（maxLevel = secretMaxLevel − 2）===");
const secretSkills = skills.filter((s) => s.secretMaxLevel);
if (secretSkills.length !== 12) warn(`secret 技能數 ${secretSkills.length}，Phase 0 實測應為 12`);
else ok(`secret 技能數 12`);
let secretBad = 0;
for (const s of secretSkills) {
  if (s.secretMaxLevel - s.maxLevel !== 2) {
    warn(`${s.name}: secretMax ${s.secretMaxLevel} − max ${s.maxLevel} ≠ 2`);
    secretBad++;
  }
  if (!s.secretUnlockedBy) {
    warn(`${s.name}: 缺 secretUnlockedBy`);
    secretBad++;
  }
}
if (!secretBad) ok("12 secret 技能 Δ 皆為 2 且都有 secretUnlockedBy");
// 抽印 3 筆供 Kiranico 人工核對
console.log("  抽驗（對 Kiranico skilltrees 詳細頁）：");
for (const s of secretSkills.slice(0, 3)) {
  console.log(`    ${s.name}: 原生 ${s.maxLevel} / 解放 ${s.secretMaxLevel}（由 ${s.secretUnlockedBy}）`);
}
console.log(`\n=== set bonus 抽驗（69 個；ranks 由 armorset_bonus_base 機械推導）===`);
ok(`set bonus ${setBonuses.length} 個，帶 setBonusId 的防具 ${armors.filter((a) => a.setBonusId).length} 件`);
for (const en of ["Fatalis Legend", "Silver Rathalos Essence", "Safi'jiiva Seal"]) {
  const sb = setBonuses.find((x) => x.nameEn === en);
  if (sb) console.log(`    ${sb.nameZh}（${en}）: ${sb.ranks.map((r) => `${r.skillName}@${r.pieces}`).join(" + ")}`);
}

// ---- 4) 三筆已知實體 ----
console.log("\n=== 4) 三筆已知實體 ===");
const alat = armors.find((a) => /Escadora/.test(a.nameEn || "") && a.setBonusId === "sb_alatreon-divinity");
alat ? ok(`煌黑龍(Alatreon)防具：${alat.nameZh} setBonusId=${alat.setBonusId}`) : warn("找不到 Alatreon 防具");
const dual = decorations.find((d) => Object.keys(d.skills).length > 1);
dual ? ok(`雙技能複合珠：${dual.nameZh} skills=${JSON.stringify(dual.skills)}`) : warn("找不到複合珠");
const atk3 = charms.find((c) => c.name === "攻擊護石Ⅲ");
atk3 ? ok(`攻擊護石Ⅲ：skills=${JSON.stringify(atk3.skills)}`) : warn("找不到攻擊護石Ⅲ");

// ---- 輸出 gap 清單 ----
writeFileSync(
  path.join(HERE, ".cache", "zh-coverage-report.json"),
  JSON.stringify(gapReport, null, 2) + "\n",
  "utf8"
);
console.log("\n=== 稽核結束 ===");
console.log(warns ? `⚠️  ${warns} 項警告（多為 zh EN-fallback，見稽核文件 G2 已知落差）` : "✓ 全綠");
console.log("zh 未映射清單 → scripts/world/.cache/zh-coverage-report.json + zh-gaps.json");
