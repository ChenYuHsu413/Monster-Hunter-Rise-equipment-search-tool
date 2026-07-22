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
// 案例 2：屬性（含會心擊【屬性】依武器種）+ 匠改變生效色
//   武器：長劍(long-sword) 攻擊 250、會心 10%、冰屬性 300。
//     斬味 base=[100,50,50,0,0,0,0]Σ200(黃封頂)，max=[100,50,80,20,0,0,0]Σ250(綠)。
//   技能：看破 Lv3（會心+15）、冰屬性攻擊強化 Lv3（flat +100）、會心攻擊【屬性】 Lv1、匠 Lv5。
//   物理：effAttack=250（無攻擊技）；aff=10+15=25；critMult=1+0.25*(1.25-1)=1.0625
//     匠5 → reach=250 落在 max 綠段(idx3) → 生效綠：raw倍率 1.05、elem倍率 1.0
//     raw = 250 * 1.05 * 1.0625 = 278.90625
//   屬性：elVal = 300*(1+0)+100 = 400
//     會心擊【屬性】long-sword 非高倍組 → critElem=1.35
//     aPos=0.25 → elCritMult = 1 + 0.25*(1.35-1) = 1.0875
//     element = 400 * ELEM[綠=1.0] * 1.0875 = 435
//   total = 278.90625 + 435*4 = 2018.90625
// ───────────────────────────────────────────────────────────────────────────
{
  console.log("案例 2（屬性 + 匠改變生效色，long-sword）");
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
  const raw = effAttack * RAW[3] * cm; // 綠 1.05
  const elVal = 400;
  const elCritMult = 1 + 0.25 * (1.35 - 1);
  const element = elVal * ELEM[3] * elCritMult; // 綠 elem 1.0
  const total = raw + element * 4.0;
  check("effAttack", r.effAttack, effAttack);
  check("effAffinity", r.effAffinity, aff);
  check("critMult", r.critMult, cm);
  check("raw", r.raw, raw);
  check("element", r.element, element);
  check("total", r.total, total);
  console.log(`      生效斬味色=${r.sharpColor}（期望 綠，匠5 由黃→綠）\n`);
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

console.log(`\n[test-efr-world] ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
