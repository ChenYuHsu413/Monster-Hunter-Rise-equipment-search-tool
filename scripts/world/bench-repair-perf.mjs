/**
 * 複合珠有界修復 — 效能對照（尾巴 D，需求 3）。
 * 10 組 World 搜尋，各跑「貪婪-only（關閉修復）」vs「修復後」，比總時間增幅（須 ≤30%）。
 *   node scripts/world/bench-repair-perf.mjs
 */
import { register } from "node:module";
import { pathToFileURL, fileURLToPath } from "node:url";
import path from "node:path";
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
register("./scripts/regression-loader.mjs", pathToFileURL(REPO + path.sep).href);

const { searchBuilds } = await import("@/lib/build-search");
const { loadWorldSearchDeps } = await import("@/lib/world-registry");
const { __setDecorationRepairEnabled } = await import("@/lib/decoration-solver");
const deps = await loadWorldSearchDeps();
const W = (t, r = 12) => deps.weapons.find((w) => w.weaponType === t && w.rarity === r) ?? deps.weapons.find((w) => w.weaponType === t);
const R0 = { 4: 0, 3: 0, 2: 0, 1: 0 };
const NX = { armorIds: [], weaponIds: [] };
const base = (o) => ({ charms: [], fixedParts: {}, excludedItems: NX, excludedSkills: [], reservedSlots: R0, searchMode: "exact", resultLimit: 50, ...o });

// 10 組：混合會/不會觸發修復（含 2-in-1 複合珠關聯技能者觸發 gate）。
const SCEN = [
  base({ weaponType: "great-sword", weaponSearchMode: "fixed", fixedWeaponId: W("great-sword").id, requiredSkills: { 攻擊: 2, 奪取耐力: 1, 無傷: 1 } }),
  base({ weaponType: "great-sword", weaponSearchMode: "fixed", fixedWeaponId: W("great-sword").id, requiredSkills: { 弱點特効: 3, 超會心: 3 } }),
  base({ weaponType: "long-sword", weaponSearchMode: "fixed", fixedWeaponId: W("long-sword").id, requiredSkills: { 攻擊: 4, 看破: 3 } }),
  base({ weaponType: "long-sword", weaponSearchMode: "search", requiredSkills: { 攻擊: 3, 奪取耐力: 1, 無傷: 1 } }),
  base({ weaponType: "hammer", weaponSearchMode: "fixed", fixedWeaponId: W("hammer").id, requiredSkills: { 挑戰者: 5, 超會心: 2 } }),
  base({ weaponType: "dual-blades", weaponSearchMode: "search", requiredSkills: { 攻擊: 4, 弱點特効: 2 } }),
  base({ weaponType: "charge-blade", weaponSearchMode: "fixed", fixedWeaponId: W("charge-blade").id, requiredSkills: { 攻擊: 3, 奪取耐力: 1, 精霊の加護: 1 } }),
  base({ weaponType: "great-sword", weaponSearchMode: "search", requiredSkills: { 攻擊: 5 } }),
  base({ weaponType: "sword-and-shield", weaponSearchMode: "search", requiredSkills: { 攻擊: 3, 無傷: 1, 奪取耐力: 1 } }),
  base({ weaponType: "lance", weaponSearchMode: "fixed", fixedWeaponId: W("lance").id, requiredSkills: { 攻擊: 4, 業物: 1 } }),
];

const time = (reqs, reps) => {
  const t0 = performance.now();
  for (let i = 0; i < reps; i++) for (const r of reqs) searchBuilds(r, deps);
  return performance.now() - t0;
};

// 暖機（JIT）
__setDecorationRepairEnabled(true); time(SCEN, 1);
__setDecorationRepairEnabled(false); time(SCEN, 1);

const REPS = 3;
__setDecorationRepairEnabled(false);
const tGreedy = time(SCEN, REPS);
__setDecorationRepairEnabled(true);
const tRepair = time(SCEN, REPS);
__setDecorationRepairEnabled(true); // 還原

const pct = ((tRepair / tGreedy - 1) * 100);
console.log(`\n10 組 × ${REPS} 次：`);
console.log(`  貪婪-only : ${tGreedy.toFixed(0)} ms`);
console.log(`  修復後    : ${tRepair.toFixed(0)} ms`);
console.log(`  增幅      : ${pct.toFixed(1)}%  (門檻 ≤30%)`);
const ok = pct <= 30;
console.log(ok ? "  ✅ PASS" : "  ❌ FAIL（超 30%）");
process.exit(ok ? 0 : 1);
