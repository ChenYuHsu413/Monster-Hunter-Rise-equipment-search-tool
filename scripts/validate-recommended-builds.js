#!/usr/bin/env node
/**
 * 推薦配裝驗證器 — 檢查 data/recommended-builds.json 的每個裝備/技能/珠子引用：
 *  (1) 完整性：非 null 的內部 ID 必須確實存在於專案資料（抓錯 ID / 壞連結）。
 *  (2) 孤兒：id=null（正規化後仍比不到，待 jp-name-map 補）——列出並指向建議檔。
 *
 * 「預期無 ID」者不算孤兒：獵蟲（專案無資料）、百龍珠（○系/○竜珠）、自由孔、
 * 傀異錬成原字串。
 *
 * 完整性錯誤（id 存在但不在專案）→ 退出碼 1（真 bug）。
 * 孤兒（id=null）→ 警告，退出碼 0（已知待補，見 suggestions 檔）。
 * 用法：node scripts/validate-recommended-builds.js
 */
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const SRC = path.join(ROOT, "src", "data");
const builds = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "recommended-builds.json"), "utf8"));

const proj = {
  weapons: new Set(JSON.parse(fs.readFileSync(path.join(SRC, "weapons.json"), "utf8")).map((x) => x.id)),
  armors: new Set(JSON.parse(fs.readFileSync(path.join(SRC, "armors.json"), "utf8")).map((x) => x.id)),
  decorations: new Set(JSON.parse(fs.readFileSync(path.join(SRC, "decorations.json"), "utf8")).map((x) => x.id)),
  skills: new Set(JSON.parse(fs.readFileSync(path.join(SRC, "skills.json"), "utf8")).map((x) => x.name)),
};

const broken = []; // {type, id, rawNameJa, buildId} — id 存在但不在專案
const orphans = new Map(); // `${type}:${rawNameJa}` -> {type, rawNameJa, count, examples}

function checkRef(type, ref, buildId) {
  if (!ref || ref.free) return; // 自由孔
  if (ref.id == null) {
    const key = `${type}:${ref.rawNameJa}`;
    const o = orphans.get(key) ?? { type, rawNameJa: ref.rawNameJa, count: 0, examples: [] };
    o.count++;
    if (o.examples.length < 3 && !o.examples.includes(buildId)) o.examples.push(buildId);
    orphans.set(key, o);
    return;
  }
  if (!proj[type].has(ref.id)) broken.push({ type, id: ref.id, rawNameJa: ref.rawNameJa, buildId });
}

for (const b of builds.builds) {
  const decos = (arr) => (arr ?? []).forEach((d) => checkRef("decorations", d, b.id));
  const skills = (arr) => (arr ?? []).forEach((s) => checkRef("skills", s, b.id));
  (b.weapons ?? []).forEach((w) => checkRef("weapons", w, b.id));
  for (const p of b.armor ?? []) {
    checkRef("armors", p, b.id);
    decos(p.decorations);
    skills(p.skills); // armorSimple 逐部位技能
  }
  if (b.talisman) {
    skills(b.talisman.skills);
    decos(b.talisman.decorations);
  }
  decos(b.buildDecorations);
  skills(b.skillTotals);
  // kinsect / rampageDecos / rampageSkills：專案無對應資料，預期無 ID，不檢查
}

const orphanList = [...orphans.values()];
const byType = (list) => list.reduce((a, x) => ((a[x.type] = (a[x.type] ?? 0) + 1), a), {});

console.log(`驗證 ${builds.builds.length} builds`);
console.log(`完整性錯誤（id 不在專案）：${broken.length}`);
for (const b of broken.slice(0, 20)) console.log(`  ✗ [${b.type}] ${b.id} (${b.rawNameJa}) @ ${b.buildId}`);
if (broken.length > 20) console.log(`  … 另 ${broken.length - 20} 筆`);

console.log(`\n孤兒（id=null，待 jp-name-map 補）：${orphanList.length} 種 ${JSON.stringify(byType(orphanList))}`);
for (const type of ["weapons", "armors", "decorations", "skills"]) {
  const items = orphanList.filter((o) => o.type === type).sort((a, b) => b.count - a.count);
  if (!items.length) continue;
  console.log(`  [${type}] ${items.length} 種：`);
  for (const o of items) console.log(`     ${o.rawNameJa}（${o.count} 次，例 ${o.examples[0]}）`);
}

// 對照 scraper 自報的 unresolved 與建議檔，確認一致
const scraperUnresolved = builds.unresolved?.length ?? 0;
console.log(`\nscraper 自報 unresolved：${scraperUnresolved} 種`);
try {
  const sug = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "jp-name-map.suggestions.json"), "utf8"));
  console.log(`建議檔 data/jp-name-map.suggestions.json：${sug.items.length} 筆（每筆附 2-3 個 Kiranico 候選＋內部 ID）`);
} catch {
  console.log("（尚無建議檔，跑 build-jp-name-map.js 產生）");
}

if (broken.length) {
  console.error(`\n✗ 完整性錯誤 ${broken.length} 筆（id 指向不存在的專案資料）`);
  process.exit(1);
}
console.log(`\n✓ 完整性通過：所有已解析 ID 都對應到專案資料。孤兒 ${orphanList.length} 種待人工補對照表。`);
