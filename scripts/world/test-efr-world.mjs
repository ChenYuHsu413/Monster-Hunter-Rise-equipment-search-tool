/**
 * efr-world.ts 自測：3 組手算範例（純物理 / 屬性 / 條件技+secret 混合）。
 * 手算過程寫在各案例註解裡；函式輸出必須與手算一致（容差 1e-6）。
 *
 * 執行：node scripts/world/test-efr-world.mjs
 * 直接 import TS 模組（Node 24 型別剝除；與 regression-baseline.mjs 相同慣例）。
 */
import { computeEfr } from "../../src/lib/efr-world.ts";

let pass = 0;
let fail = 0;
const approx = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol;

function check(label, got, exp, tol = 1e-6) {
  const ok = approx(got, exp, tol);
  console.log(`  ${ok ? "OK  " : "FAIL"} ${label}: got=${got.toFixed(6)} exp=${exp.toFixed(6)}`);
  if (ok) pass++;
  else fail++;
}

// 生效會心倍率（正會心）：1 + min(aff,100)/100 * (critDmg-1)
const critMult = (aff, critDmg) =>
  aff >= 0 ? 1 + Math.min(aff, 100) / 100 * (critDmg - 1) : 1 + aff / 100 * 0.25;

// 斬味 raw/element 倍率（同 efr-world）
const RAW = [0.5, 0.75, 1.0, 1.05, 1.2, 1.32, 1.39];
const ELEM = [0.25, 0.5, 0.75, 1.0, 1.0625, 1.15, 1.25];

// ───────────────────────────────────────────────────────────────────────────
// 案例 1：純物理，無斬味資料（弩）→ 斬味中性黃(idx2, ×1.0)
//   武器：攻擊 300、會心 0%。技能：攻擊 Lv4（flat +12、會心 +5%）、超會心 Lv3（會心傷害 1.40）。
//   effAttack = 300 + 12 = 312
//   aff = 0 + 5(攻擊L4) = 5    critMult = 1 + 0.05*(1.40-1) = 1.02
//   sharp = 黃 ×1.0
//   raw = 312 * 1.0 * 1.02 = 318.24 ; element 0 ; total = 318.24
// ───────────────────────────────────────────────────────────────────────────
{
  console.log("案例 1（純物理，無斬味）");
  const r = computeEfr({
    weapon: { id: "w1", nameZh: "測試弩", weaponType: "heavy-bowgun", attack: 300, affinity: 0, slots: [] },
    skills: { 攻擊: 4, 超會心: 3 },
  });
  const effAttack = 312;
  const aff = 5;
  const cm = critMult(aff, 1.4); // 1.02
  const raw = effAttack * RAW[2] * cm;
  check("effAttack", r.effAttack, effAttack);
  check("effAffinity", r.effAffinity, aff);
  check("critMult", r.critMult, cm);
  check("raw", r.raw, raw);
  check("total", r.total, raw);
  console.log(`      生效斬味色=${r.sharpColor}（期望 黃）\n`);
}

// ───────────────────────────────────────────────────────────────────────────
// 案例 2（＝驗收「短帶」）：屬性（含會心擊【屬性】依武器種）+ 匠改變 tip 色 + 期望斬味加權
//   武器：長劍(long-sword) 攻擊 250、會心 10%、冰屬性 300。
//     斬味 base=[100,50,50,0,0,0,0]Σ200(黃封頂)，max=[100,50,80,20,0,0,0]Σ250(綠)。
//   技能：看破 Lv3（會心+15）、冰屬性攻擊強化 Lv3（flat +100）、會心攻擊【屬性】 Lv1、匠 Lv5。
//   物理：effAttack=250（無攻擊技）；aff=10+15=25；critMult=1+0.25*(1.25-1)=1.0625
//     匠5 → reach=250=maxΣ → 色帶=[100,50,80,20,0,0,0]，tip=綠(idx3,長20)。
//     【期望斬味 60 單位手算】自頂端往下：綠20 + 黃40（黃 80 取 40）＝60。
//       sRaw = (20*1.05 + 40*1.0)/60 = (21+40)/60 = 61/60 ≈ 1.016667
//       sElem= (20*1.0  + 40*0.75)/60 = (20+30)/60 = 50/60 ≈ 0.833333
//     raw = 250 * sRaw * 1.0625
//   屬性：elVal = 300*(1+0)+100 = 400
//     會心擊【屬性】long-sword 非高倍組 → critElem=1.35；aPos=0.25 → elCritMult=1+0.25*0.35=1.0875
//     element = 400 * sElem * 1.0875
//   total = raw + element*4
// ───────────────────────────────────────────────────────────────────────────
{
  console.log("案例 2（屬性 + 匠改 tip 色 + 期望斬味加權，long-sword，＝驗收「短帶」）");
  const r = computeEfr({
    weapon: {
      id: "w2", nameZh: "測試長劍", weaponType: "long-sword", attack: 250, affinity: 10, slots: [],
      element: { type: "ice", value: 300 },
      sharpness: { base: [100, 50, 50, 0, 0, 0, 0], max: [100, 50, 80, 20, 0, 0, 0] },
    },
    skills: { 看破: 3, 冰屬性攻擊強化: 3, "會心攻擊【屬性】": 1, 匠: 5 },
  });
  const effAttack = 250;
  const aff = 25;
  const cm = critMult(aff, 1.25); // 超會心0 → 基礎會心傷害 1.25 → 1.0625
  const sRaw = (20 * RAW[3] + 40 * RAW[2]) / 60; // 綠20 + 黃40
  const sElem = (20 * ELEM[3] + 40 * ELEM[2]) / 60;
  const raw = effAttack * sRaw * cm;
  const elVal = 400;
  const elCritMult = 1 + 0.25 * (1.35 - 1);
  const element = elVal * sElem * elCritMult;
  const total = raw + element * 4.0;
  check("effAttack", r.effAttack, effAttack);
  check("effAffinity", r.effAffinity, aff);
  check("critMult", r.critMult, cm);
  check("sharpMult(期望raw)", r.sharpMult, sRaw);
  check("raw", r.raw, raw);
  check("element", r.element, element);
  check("total", r.total, total);
  console.log(`      tip 斬味色=${r.sharpColor}（期望 綠，匠5 tip 由黃→綠）\n`);
}

// ───────────────────────────────────────────────────────────────────────────
// 案例 3：條件技 + secret 解放混合（Fatalis 類，uptime=0.75）
//   武器：大劍(great-sword) 攻擊 350、會心 -30%（Fatalis 系負會心）。
//     斬味 base=[160,20,20,70,40,30,10]Σ350，max=[160,20,20,70,40,30,60]Σ400（紫）。
//   技能：挑戰者 Lv7（secret 解放；flat+28、會心+20）、超會心 Lv3（1.40）、
//         弱點特效 Lv3（會心+50，assumeWeakpoint 預設 true）、匠 Lv5。
//   uptime=0.75：
//     effAttack = 350 + 28*0.75 = 350 + 21 = 371
//     aff = -30 + 50(弱特) + 20*0.75(挑戰者) = -30 + 50 + 15 = 35
//     critMult = 1 + 0.35*(1.40-1) = 1.14
//     匠5 → reach=400 → 紫(idx6) raw 1.39
//     raw = 371 * 1.39 * 1.14 = 587.83 (=371*1.39=515.69 ; *1.14=587.8866)
//   total = raw（無屬性）
// ───────────────────────────────────────────────────────────────────────────
{
  console.log("案例 3（條件技 + secret 挑戰者7 混合，great-sword，uptime=0.75）");
  const r = computeEfr({
    weapon: {
      id: "w3", nameZh: "測試大劍", weaponType: "great-sword", attack: 350, affinity: -30, slots: [],
      sharpness: { base: [160, 20, 20, 70, 40, 30, 10], max: [160, 20, 20, 70, 40, 30, 60] },
    },
    skills: { 挑戰者: 7, 超會心: 3, 弱點特效: 3, 匠: 5 },
    conditionalUptime: 0.75,
  });
  const effAttack = 350 + 28 * 0.75; // 371
  const aff = -30 + 50 + 20 * 0.75; // 35
  const cm = critMult(aff, 1.4); // 1.14
  const raw = effAttack * RAW[6] * cm; // 紫 1.39
  check("effAttack", r.effAttack, effAttack);
  check("effAffinity", r.effAffinity, aff);
  check("critMult", r.critMult, cm);
  check("raw", r.raw, raw);
  check("total", r.total, raw);
  console.log(`      生效斬味色=${r.sharpColor}（期望 紫）\n`);
}

// ───────────────────────────────────────────────────────────────────────────
// 案例 4（＝驗收「厚白無紫」）：期望斬味 60 單位跨白/藍加權（純物理，隔離斬味項）
//   武器：攻擊 200、會心 0%、無屬性、無技能、匠5。
//     斬味 base=max=[80,20,20,60,80,40,0]Σ300（白 40 疊藍 80，無紫）。
//   reach=300=maxΣ → 色帶不變，tip=白(idx5,長40)。
//   【60 單位手算】自頂端：白40 + 藍20（藍 80 取 20）＝60。
//     sRaw = (40*1.32 + 20*1.2)/60 = (52.8+24)/60 = 76.8/60 = 1.28
//   effAttack=200；aff=0 → critMult=1；raw = 200*1.28*1 = 256；total=raw（無屬性）
// ───────────────────────────────────────────────────────────────────────────
{
  console.log("案例 4（厚白無紫，白疊藍 60 單位加權）");
  const r = computeEfr({
    weapon: {
      id: "w4", nameZh: "測試厚白", weaponType: "great-sword", attack: 200, affinity: 0, slots: [],
      sharpness: { base: [80, 20, 20, 60, 80, 40, 0], max: [80, 20, 20, 60, 80, 40, 0] },
    },
    skills: { 匠: 5 },
  });
  const sRaw = (40 * RAW[5] + 20 * RAW[4]) / 60; // 白40 + 藍20
  const raw = 200 * sRaw * 1.0;
  check("sharpMult(期望raw)", r.sharpMult, sRaw);
  check("raw", r.raw, raw);
  check("total", r.total, raw);
  console.log(`      tip 斬味色=${r.sharpColor}（期望 白）\n`);
}

// ───────────────────────────────────────────────────────────────────────────
// 案例 5（＝驗收「薄紫」）：Fatalis 真實色帶形狀、匠0 頂端薄紫混白混藍（純物理，隔離斬味項）
//   武器：攻擊 300、會心 0%、無屬性、無技能、匠0。
//     斬味 base=[160,20,20,70,40,30,10]Σ350、max=[160,20,20,70,40,30,60]Σ400（Fatalis 實測）。
//   匠0 → reach=350 → 截斷 max：紅160 橙20 黃20 綠70 藍40 白30 紫10（＝base），tip=紫(idx6,長10)。
//   【60 單位手算】自頂端：紫10 + 白30 + 藍20（藍 40 取 20）＝60。
//     sRaw = (10*1.39 + 30*1.32 + 20*1.2)/60 = (13.9+39.6+24)/60 = 77.5/60 ≈ 1.291667
//   effAttack=300；aff=0 → critMult=1；raw = 300*sRaw；total=raw
//   （紫仍為 tip 色，但期望倍率 1.29 < 純紫 1.39——薄紫尖端被其下白/藍稀釋，正是匠增厚紫斬的收益空間）
// ───────────────────────────────────────────────────────────────────────────
{
  console.log("案例 5（薄紫，Fatalis 匠0 形狀，紫混白混藍 60 單位加權）");
  const r = computeEfr({
    weapon: {
      id: "w5", nameZh: "測試薄紫", weaponType: "great-sword", attack: 300, affinity: 0, slots: [],
      sharpness: { base: [160, 20, 20, 70, 40, 30, 10], max: [160, 20, 20, 70, 40, 30, 60] },
    },
    skills: {}, // 匠0
  });
  const sRaw = (10 * RAW[6] + 30 * RAW[5] + 20 * RAW[4]) / 60; // 紫10 + 白30 + 藍20
  const raw = 300 * sRaw * 1.0;
  check("sharpMult(期望raw)", r.sharpMult, sRaw);
  check("raw", r.raw, raw);
  check("total", r.total, raw);
  console.log(`      tip 斬味色=${r.sharpColor}（期望 紫；期望倍率 ${sRaw.toFixed(4)} < 純紫 1.39，薄紫被稀釋）\n`);
}

console.log(`\n[test-efr-world] ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
