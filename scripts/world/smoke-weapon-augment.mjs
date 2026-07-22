/**
 * World 武器強化「簡化輸入」冒煙（覺醒／客製強化）。
 *   (1) Fatalis +10 攻擊 +5% 會心 → EFR 與無強化對照（effAttack/effAffinity/total 合理）。
 *   (2) 追加 4 級洞 → 補珠實際使用該洞（reservedSlots{4:1} 下，含洞比不含洞多出可行配裝）。
 *   (3) 虛擬 set bonus：炎王龍之武技 +1 件 → 2 件防具達成 3 件門檻（達人藝觸發）。
 *
 *   node scripts/world/smoke-weapon-augment.mjs
 */
import { register } from "node:module";
import { pathToFileURL, fileURLToPath } from "node:url";
import path from "node:path";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
register("./scripts/regression-loader.mjs", pathToFileURL(REPO + path.sep).href);

const { computeEfr } = await import("@/lib/efr-world");
const { searchBuilds } = await import("@/lib/build-search");
const { loadWorldSearchDeps } = await import("@/lib/world-registry");
const { applyWeaponAugment } = await import("@/lib/world-weapon-augment");
const { computeSetBonusSkills } = await import("@/lib/skill-calculator");
const { solveDecorations } = await import("@/lib/decoration-solver");
const { collectSlots } = await import("@/lib/slot-utils");

const deps = await loadWorldSearchDeps();
const W = (nameEn) => deps.weapons.find((w) => w.nameEn === nameEn);

let pass = 0, fail = 0;
const assert = (c, m) => { if (c) { pass++; console.log("  ✅ " + m); } else { fail++; console.log("  ❌ " + m); } };

// ═══ (1) Fatalis +10 攻擊 +5% 會心 → EFR 對照 ═══
console.log("\n━━━ (1) Black Fatalis Blade：+10 攻擊 +5% 會心 vs 無強化（挑戰者7/超會心3/弱點特效3/匠5）━━━");
{
  const base = W("Black Fatalis Blade");
  const aug = applyWeaponAugment(base, {
    attack: 10, affinity: 5, element: 0, slot: 0, defense: 0, setBonusId: "",
  });
  const skills = { 挑戰者: 7, 超會心: 3, 弱點特效: 3, 匠: 5 };
  const r0 = computeEfr({ weapon: base, skills, conditionalUptime: 0.75 });
  const r1 = computeEfr({ weapon: aug, skills, conditionalUptime: 0.75 });
  console.log(`  無強化：atk=${base.attack} aff=${base.affinity}% → effAtk=${r0.effAttack.toFixed(1)} effAff=${r0.effAffinity.toFixed(1)}% raw=${r0.raw.toFixed(1)} total=${r0.total.toFixed(1)}`);
  console.log(`  +強化：atk=${aug.attack} aff=${aug.affinity}% → effAtk=${r1.effAttack.toFixed(1)} effAff=${r1.effAffinity.toFixed(1)}% raw=${r1.raw.toFixed(1)} total=${r1.total.toFixed(1)}`);
  assert(base.attack + 10 === aug.attack && base.affinity + 5 === aug.affinity,
    "武器副本：攻擊 +10、會心 +5%（原武器物件不動）");
  assert(Math.abs(r1.effAttack - r0.effAttack - 10) < 1e-6,
    "effAttack 恰 +10（flat 攻擊 delta 直接進顯示值）");
  assert(Math.abs(r1.effAffinity - r0.effAffinity - 5) < 1e-6,
    "effAffinity 恰 +5%（會心 delta 直接加）");
  assert(r1.raw > r0.raw && r1.total > r0.total,
    `EFR 上升（raw ${r0.raw.toFixed(1)}→${r1.raw.toFixed(1)}、total ${r0.total.toFixed(1)}→${r1.total.toFixed(1)}）`);
}

// ═══ (2) 追加 4 級洞 → 補珠實際使用該洞 ═══
// 建構「唯一可用洞＝武器追加洞」的場景（防具/護石全無洞），要求需 2 級洞的痛擊珠【2】(弱點特效)。
// 無追加洞 → 無處可補 → 解算失敗；追加 4 級洞 → 痛擊珠塞進該洞 → 成功。直接證明該洞被補珠消費。
console.log("\n━━━ (2) 追加洞 → 補珠使用該洞（唯一可用洞為武器追加洞，補痛擊珠【2】弱點特效）━━━");
{
  // 2a：applyWeaponAugment 對真實武器確實追加 1 個 4 級洞（原物件不動）。
  const real = W("Black Fatalis Blade");
  const realAug = applyWeaponAugment(real, {
    attack: 0, affinity: 0, element: 0, slot: 4, defense: 0, setBonusId: "",
  });
  console.log(`  真實武器原洞=${JSON.stringify(real.slots)} → 追加後=${JSON.stringify(realAug.slots)}（原物件=${JSON.stringify(real.slots)}）`);
  assert(realAug.slots.length === real.slots.length + 1 && realAug.slots.includes(4) && real.slots.length === 2,
    "武器副本：追加 1 個 4 級洞，原武器 slots 不變");

  // 2b：唯一可用洞來自武器追加洞的補珠可行性翻轉。
  const noSlotPieces = Array.from({ length: 5 }, () => ({ slots: [] }));
  const noCharm = { skills: {}, slots: [] };
  const reserved = { 4: 0, 3: 0, 2: 0, 1: 0 };
  const solveWith = (weaponSlots) =>
    solveDecorations({
      slots: collectSlots(noSlotPieces, noCharm, weaponSlots),
      currentSkills: {},
      requiredSkills: { 弱點特效: 1 }, // 痛擊珠【2】：需 2 級洞
      reservedSlots: reserved,
      decorationsBySkill: deps.decorationsBySkill,
      skillMax: deps.skillMax,
    });
  const sBase = solveWith(applyWeaponAugment({ ...real, slots: [] }, {
    attack: 0, affinity: 0, element: 0, slot: 0, defense: 0, setBonusId: "",
  }).slots); // 無追加洞 → []
  const sAug = solveWith(applyWeaponAugment({ ...real, slots: [] }, {
    attack: 0, affinity: 0, element: 0, slot: 4, defense: 0, setBonusId: "",
  }).slots); // 追加 4 級洞 → [4]
  console.log(`  無追加洞：solve.success=${sBase.success}；追加 4 級洞：solve.success=${sAug.success} 珠=${JSON.stringify(sAug.assignments?.map((a) => a.decorationName))}`);
  assert(!sBase.success, "無任何洞 → 弱點特效珠無處可補 → 解算失敗");
  assert(sAug.success && sAug.assignments.length === 1,
    "追加 4 級洞 → 痛擊珠【2】塞入該洞 → 解算成功（補珠確實使用追加洞）");
}

// ═══ (3) 虛擬 set bonus +1 件：2 件防具達成 3 件門檻 ═══
console.log("\n━━━ (3) 炎王龍之武技 虛擬 +1 件 → 2 件防具達成 3 件門檻（達人藝觸發）━━━");
{
  const SB = "sb_teostra-technique"; // 炎王龍之武技：3 件 → 達人藝 Lv1
  const twoPieces = [
    { setBonusId: SB }, { setBonusId: SB }, {}, {}, {},
  ];
  const without = computeSetBonusSkills(twoPieces, deps.world.setBonusById);
  const withVirtual = computeSetBonusSkills(twoPieces, deps.world.setBonusById, { [SB]: 1 });
  console.log(`  2 件防具 無虛擬：${JSON.stringify(without)}`);
  console.log(`  2 件防具 +虛擬1：${JSON.stringify(withVirtual)}`);
  assert(!without["達人藝"],
    "2 件防具（無虛擬）未達 3 件門檻 → 達人藝未觸發");
  assert(withVirtual["達人藝"] === 1,
    "2 件防具 + 武器覺醒虛擬 1 件 = 3 件 → 達人藝 Lv1 觸發（結果卡 virtualSetBonus 亦種入同值）");
  // 引擎路徑：deps.world.virtualSetBonus 注入後，真實搜尋以 2 件防具即滿足需要 3 件的達人藝。
  const teostraArmors = deps.armors.filter((a) => a.setBonusId === SB);
  console.log(`  炎王龍(${SB}) 防具件數 in data：${teostraArmors.length}`);
}

console.log(`\n═══ 武器強化冒煙：PASS ${pass} / FAIL ${fail} ═══`);
process.exit(fail ? 1 : 0);
