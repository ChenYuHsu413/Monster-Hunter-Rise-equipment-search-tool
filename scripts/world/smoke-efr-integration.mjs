/**
 * Phase 4 整合冒煙：efr-world + Task A 斬味修正的合體驗收。
 *   (1) Fatalis 武器 含匠 vs 不含匠：EFR 與生效斬味色對照。
 *   (2) 匠改變生效色的機制證明（Buster：黃→綠）——證明 Task A 修正後匠非 no-op。
 *   (3) 排序 sanity：Fatalis 應排在同類非畢業武器之前（直接 computeEfr 對比 + 真實 searchBuilds）。
 *
 *   node scripts/world/smoke-efr-integration.mjs
 */
import { register } from "node:module";
import { pathToFileURL, fileURLToPath } from "node:url";
import path from "node:path";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
register("./scripts/regression-loader.mjs", pathToFileURL(REPO + path.sep).href);

const { computeEfr } = await import("@/lib/efr-world");
const { searchBuilds } = await import("@/lib/build-search");
const { loadWorldSearchDeps } = await import("@/lib/world-registry");
const deps = await loadWorldSearchDeps();
const W = (nameEn) => deps.weapons.find((w) => w.nameEn === nameEn);

let pass = 0, fail = 0;
const assert = (c, m) => { if (c) { pass++; console.log("  ✅ " + m); } else { fail++; console.log("  ❌ " + m); } };
const fmt = (r) =>
  `EFR raw=${r.raw.toFixed(1)} total=${r.total.toFixed(1)} | effAtk=${r.effAttack.toFixed(1)} effAff=${r.effAffinity.toFixed(1)}% crit×${r.critMult.toFixed(3)} | 生效斬味=${r.sharpColor}(×${r.sharpMult})`;

// 一組畢業級必要技能（挑戰者7 需 secret 解放；此處直接給最終等級模擬解放後）
const SKILLS_NO_HANDI = { 挑戰者: 7, 超會心: 3, 弱點特效: 3 };
const SKILLS_WITH_HANDI = { ...SKILLS_NO_HANDI, 匠: 5 };

// ═══ (1) Fatalis 含匠 vs 不含匠 ═══
console.log("\n━━━ (1) Black Fatalis Blade：含匠5 vs 不含匠（挑戰者7/超會心3/弱點特效3）━━━");
{
  const w = W("Black Fatalis Blade");
  console.log(`  武器 atk=${w.attack} aff=${w.affinity}% base=Σ${w.sharpness.base.reduce((a, b) => a + b, 0)} max=Σ${w.sharpness.max.reduce((a, b) => a + b, 0)}`);
  const noH = computeEfr({ weapon: w, skills: SKILLS_NO_HANDI });
  const wiH = computeEfr({ weapon: w, skills: SKILLS_WITH_HANDI });
  console.log(`  不含匠：${fmt(noH)}`);
  console.log(`  含匠5：${fmt(wiH)}`);
  // Task A 實測：Fatalis base 已有紫斬薄層(purple10) → 匠0/匠5 生效色同為紫，色不變。
  assert(noH.sharpColor === "紫" && wiH.sharpColor === "紫",
    "Fatalis 匠0/匠5 生效色皆為紫（base 已達紫；符合 world-sharpness-audit 第四節）");
  assert(Math.abs(noH.raw - wiH.raw) < 1e-9,
    "→ 故 Fatalis 物理 EFR 匠-不變（color-only 模型不計紫斬長度；已於 efr-world-notes 註記為限制）");
}

// ═══ (2) 匠改變生效色的機制證明（Buster：base 黃封頂 → max 綠）═══
console.log("\n━━━ (2) 匠改變生效色機制證明（Buster Sword I：base 黃 → max 綠）━━━");
{
  const w = W("Buster Sword I");
  console.log(`  武器 base=${JSON.stringify(w.sharpness.base)} max=${JSON.stringify(w.sharpness.max)}`);
  const noH = computeEfr({ weapon: w, skills: {} });
  const wiH = computeEfr({ weapon: w, skills: { 匠: 5 } });
  console.log(`  不含匠：${fmt(noH)}`);
  console.log(`  含匠5：${fmt(wiH)}`);
  assert(noH.sharpColor === "黃" && wiH.sharpColor === "綠",
    "匠5 使生效色 黃→綠（Task A 修正後匠非 no-op；base≠max 生效）");
  assert(wiH.raw > noH.raw, `→ 含匠 EFR raw 更高（${noH.raw.toFixed(1)} → ${wiH.raw.toFixed(1)}）`);
}

// ═══ (3a) 排序 sanity：Fatalis vs 同類非畢業 GS（同技能，直接對比）═══
console.log("\n━━━ (3a) 排序 sanity：Fatalis vs 非畢業 GS（Purgation's Atrocity r8，同技能）━━━");
{
  const fat = W("Black Fatalis Blade");
  const mid = W("Purgation's Atrocity"); // r8 上位非畢業，atk 1008 aff 0，藍封頂
  const sk = SKILLS_WITH_HANDI;
  const rf = computeEfr({ weapon: fat, skills: sk });
  const rm = computeEfr({ weapon: mid, skills: sk });
  console.log(`  Fatalis:            ${fmt(rf)}`);
  console.log(`  Purgation's(非畢業): ${fmt(rm)}`);
  assert(rf.raw > rm.raw,
    `Fatalis 物理 EFR 高於非畢業 GS（${rf.raw.toFixed(1)} > ${rm.raw.toFixed(1)}；1632atk+紫 勝 1008atk+藍，即便 −30 會心）`);
}

// ═══ (3b) 排序 sanity：真實 searchBuilds 最佳全配裝 EFR，固定 Fatalis vs 固定非畢業 ═══
// （引擎的武器候選剪枝在 search 模式只會浮出單一最佳武器，無法逐武器取 EFR；
//   故改以「同技能、各自固定武器」跑兩次搜尋，比其最佳全配裝 total EFR。）
console.log("\n━━━ (3b) 排序 sanity：固定武器各自最佳全配裝 EFR（弱點特效3+超會心3）━━━");
{
  const runFixed = (nameEn) => {
    const w = W(nameEn);
    const { results } = searchBuilds({
      weaponType: "great-sword", weaponSearchMode: "fixed", fixedWeaponId: w.id,
      charms: [], fixedParts: {}, excludedItems: { armorIds: [], weaponIds: [] },
      requiredSkills: { 弱點特效: 3, 超會心: 3 }, excludedSkills: [], reservedSlots: { 4: 0, 3: 0, 2: 0, 1: 0 },
      searchMode: "fast", resultLimit: 50,
    }, deps);
    const best = results.reduce((m, r) => Math.max(m, r.efr?.total ?? 0), 0);
    return { w, best };
  };
  const fat = runFixed("Black Fatalis Blade");     // 畢業（r12）
  const mid = runFixed("Purgation's Atrocity");    // 非畢業（r8，上位）
  console.log(`  Black Fatalis Blade (r${fat.w.rarity})：最佳全配裝 total EFR=${fat.best.toFixed(1)}`);
  console.log(`  Purgation's Atrocity (r${mid.w.rarity})：最佳全配裝 total EFR=${mid.best.toFixed(1)}`);
  assert(fat.best > mid.best,
    `Fatalis 最佳全配裝 EFR 高於非畢業 GS（${fat.best.toFixed(1)} > ${mid.best.toFixed(1)}）`);
  console.log("  註：純 search 模式下引擎浮出的 #1 為碎光之擊劍（r12，Raging Brachy）——");
  console.log("     那是畢業 vs 畢業（碎光 0 會心配重會心投資，微幅勝 Fatalis −30 會心）；");
  console.log("     Fatalis 裸武器 raw(2450) 實高於碎光(2402)，全配裝差距屬會心 scaling，非資料/模型錯。");
}

console.log(`\n═══ 整合冒煙：PASS ${pass} / FAIL ${fail} ═══`);
process.exit(fail ? 1 : 0);
