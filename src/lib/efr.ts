import type { SkillMap, Weapon } from "@/types/build";

/**
 * EFR（Effective Raw / 期望傷害）近似模型。
 *
 * 用途：在「同一武器種類內」為配裝排序提供客觀傷害指標，取代人工權重。
 * 只算相對值，故略去招式倍率（motion value）與肉質——這些對同武器種類是常數。
 * 攻擊力採 Kiranico 顯示值（膨脹後）；因搜尋一律同武器種類比較，顯示值即可比。
 *
 * 假設（依使用者決定）：
 * - 弱點特效等「命中弱點才生效」的技能：假設命中弱點，計滿。
 * - 條件型技能（挑戰者/力量解放/火場怪力/拔刀術…）：全效果 × 統一觸發率（預設 0.75）。
 *
 * 數值來源：Kiranico 破曉（Ver16/TU5）技能逐級說明。
 */

/** 斬味段索引：0紅 1橙 2黃 3綠 4藍 5白 6紫。 */
const RAW_SHARP_MULT = [0.5, 0.75, 1.0, 1.05, 1.2, 1.32, 1.39];
const ELEM_SHARP_MULT = [0.25, 0.5, 0.75, 1.0, 1.0625, 1.15, 1.25];
const SHARP_COLOR_ZH = ["紅", "橙", "黃", "綠", "藍", "白", "紫"];

// ---- 無條件傷害技能（依等級索引，index 0 = 未持有）----
const ATTACK_FLAT = [0, 3, 6, 9, 7, 8, 9, 10];
const ATTACK_PCT = [0, 0, 0, 0, 0.05, 0.06, 0.08, 0.1];
const CRIT_EYE_AFF = [0, 5, 10, 15, 20, 25, 30, 40];
const WEX_AFF = [0, 15, 30, 50];
const CRIT_BOOST_DMG = [1.25, 1.3, 1.35, 1.4]; // 會心傷害倍率
const CRIT_ELEM_MULT = [1, 1.05, 1.1, 1.15];
const ELEM_ATK_FLAT = [0, 2, 3, 4, 4, 4];
const ELEM_ATK_PCT = [0, 0, 0, 0.05, 0.1, 0.2];

// ---- 條件型傷害技能（× 觸發率）----
// 明確值（Kiranico 逐級）：
const AGITATOR_ATK = [0, 4, 8, 12, 16, 20]; // 挑戰者：發怒時
const AGITATOR_AFF = [0, 3, 5, 7, 10, 15];
const MAX_MIGHT_AFF = [0, 10, 20, 30, 40, 50]; // 力量解放：耐力滿
const RESENT_ATK_MULT = [0, 0, 0.05, 0.05, 0.1, 0.3]; // 火場怪力攻擊%（HP<35%，Lv1 無攻擊）
const DRAW_TECH_AFF = [0, 10, 20, 40]; // 拔刀術【技】：拔刀攻擊後
const DRAW_POWER_FLAT = [0, 3, 5, 7]; // 拔刀術【力】
const GRUDGE_FLAT = [0, 5, 10, 15, 20, 25]; // 怨恨：紅槽殘留時
const PEAK_FLAT = [0, 5, 10, 20]; // 無傷：HP 全滿
const COUNTER_FLAT = [0, 10, 15, 25]; // 逆襲：被擊飛後
// 近似值（Qurio/紅槽系 meta 技能，Kiranico 未給逐級數字，取社群共識近似；校準時可調）：
const DERELICTION_PCT = [0, 0.05, 0.1, 0.15]; // 伏魔響命：依附噬生蟲時攻擊%（近似）
const STRIFE_AFF = [0, 15, 30]; // 奮鬥：紅槽滿時會心%（近似，需狂化）
const BLOODLUST_AFF = 10; // 狂化：紅槽時內含會心%（近似，Lv1）
const BLOOD_AWAKEN_PCT = 0.1; // 血氣覺醒：發動時攻擊%（近似，Lv1）

const at = (arr: number[], lv: number) =>
  arr[Math.max(0, Math.min(lv, arr.length - 1))];

/**
 * 所有會影響 EFR（物理或屬性期望傷害）的技能名稱。
 * 護石支配剪枝以「必要技能 ∪ 此集合」為「相關技能」——非相關技能不影響配裝的
 * 合法性與 EFR 排名，故可忽略以剪掉更多冗餘護石。
 * 新增/移除 computeEfr 中參照的技能時，務必同步維護此集合。
 */
export const EFR_RELEVANT_SKILLS: ReadonlySet<string> = new Set([
  // 無條件傷害
  "攻擊", "看破", "弱點特效", "超會心", "匠", "會心擊【屬性】",
  "火屬性攻擊強化", "水屬性攻擊強化", "雷屬性攻擊強化", "冰屬性攻擊強化", "龍屬性攻擊強化",
  // 條件型傷害
  "挑戰者", "拔刀術【力】", "拔刀術【技】", "怨恨", "無傷", "逆襲",
  "力量解放", "火場怪力", "伏魔響命", "血氣覺醒", "奮鬥", "狂化",
]);

export type EfrInput = {
  weapon: Weapon;
  /** 最終技能（補珠後、已截斷至上限）。 */
  skills: SkillMap;
  /** 條件技能觸發率，預設 0.75。 */
  conditionalUptime?: number;
  /** 是否假設命中弱點（弱點特效），預設 true。 */
  assumeWeakpoint?: boolean;
};

export type EfrResult = {
  /** 物理有效傷害指標。 */
  raw: number;
  /** 屬性有效傷害指標（無屬性為 0）。 */
  element: number;
  /** 綜合指標（物理 + 屬性；屬性以較小係數併入，供屬性流排序）。 */
  total: number;
  /** 有效攻擊力（套技能後、乘斬味/會心前）。 */
  effAttack: number;
  /** 有效會心率（%，可為負）。 */
  effAffinity: number;
  /** 期望會心倍率。 */
  critMult: number;
  /** 生效斬味色（中文）與其物理乘數。 */
  sharpColor: string;
  sharpMult: number;
};

/** 依匠等級推算目前生效的斬味段索引（在 base↔max 間依總長插值）。 */
function activeSharpIndex(
  sharpness: { base: number[]; max: number[] } | undefined,
  handicraftLv: number
): number {
  if (!sharpness) return 2; // 無斬味資料（弩/弓）→ 視為黃(1.0) 中性
  const { base, max } = sharpness;
  const sum = (a: number[]) => a.reduce((s, v) => s + v, 0);
  const baseTotal = sum(base);
  const maxTotal = sum(max);
  const reach =
    baseTotal + (Math.min(handicraftLv, 5) / 5) * (maxTotal - baseTotal);
  let cum = 0;
  let last = 2;
  for (let i = 0; i < 7; i++) {
    if (max[i] > 0) {
      cum += max[i];
      last = i;
      if (reach <= cum + 1e-6) return i;
    }
  }
  return last;
}

/** 期望會心倍率：正會心以會心傷害計，負會心以 0.75×（−25%）計。 */
function expectedCritMult(affinity: number, critDmg: number): number {
  const a = Math.min(affinity, 100) / 100;
  if (a >= 0) return 1 + a * (critDmg - 1);
  return 1 + a * 0.25; // a 為負 → 降低
}

/** 計算一套配裝（武器 + 最終技能）的 EFR。 */
export function computeEfr(input: EfrInput): EfrResult {
  const { weapon, skills } = input;
  const uptime = input.conditionalUptime ?? 0.75;
  const weakpoint = input.assumeWeakpoint ?? true;
  const lv = (name: string) => skills[name] ?? 0;

  // ---- 攻擊力 ----
  const base = weapon.attack;
  let pct = at(ATTACK_PCT, lv("攻擊"));
  let flat = at(ATTACK_FLAT, lv("攻擊"));
  // 條件型攻擊（× 觸發率）
  flat += at(AGITATOR_ATK, lv("挑戰者")) * uptime;
  flat += at(DRAW_POWER_FLAT, lv("拔刀術【力】")) * uptime;
  flat += at(GRUDGE_FLAT, lv("怨恨")) * uptime;
  flat += at(PEAK_FLAT, lv("無傷")) * uptime;
  flat += at(COUNTER_FLAT, lv("逆襲")) * uptime;
  pct += at(RESENT_ATK_MULT, lv("火場怪力")) * uptime;
  pct += at(DERELICTION_PCT, lv("伏魔響命")) * uptime;
  if (lv("血氣覺醒") > 0) pct += BLOOD_AWAKEN_PCT * uptime;
  const effAttack = base * (1 + pct) + flat;

  // ---- 會心率 ----
  let aff = weapon.affinity;
  aff += at(CRIT_EYE_AFF, lv("看破"));
  if (weakpoint) aff += at(WEX_AFF, lv("弱點特效"));
  aff += at(AGITATOR_AFF, lv("挑戰者")) * uptime;
  aff += at(MAX_MIGHT_AFF, lv("力量解放")) * uptime;
  aff += at(DRAW_TECH_AFF, lv("拔刀術【技】")) * uptime;
  aff += at(STRIFE_AFF, lv("奮鬥")) * uptime;
  if (lv("狂化") > 0) aff += BLOODLUST_AFF * uptime;

  const critDmg = at(CRIT_BOOST_DMG, lv("超會心"));
  const critMult = expectedCritMult(aff, critDmg);

  // ---- 斬味 ----
  const sharpIdx = activeSharpIndex(weapon.sharpness, lv("匠"));
  const sharpMult = RAW_SHARP_MULT[sharpIdx];

  const raw = effAttack * sharpMult * critMult;

  // ---- 屬性 ----
  let element = 0;
  if (weapon.element && weapon.element.value > 0) {
    const elType = weapon.element.type;
    const elSkill: Record<string, string> = {
      fire: "火屬性攻擊強化",
      water: "水屬性攻擊強化",
      thunder: "雷屬性攻擊強化",
      ice: "冰屬性攻擊強化",
      dragon: "龍屬性攻擊強化",
    };
    const skillName = elSkill[elType];
    const elLv = skillName ? lv(skillName) : 0;
    const elBase =
      weapon.element.value * (1 + at(ELEM_ATK_PCT, elLv)) + at(ELEM_ATK_FLAT, elLv);
    const elSharp = ELEM_SHARP_MULT[sharpIdx];
    // 會心擊【屬性】：會心時屬性傷害提升 → 期望屬性會心倍率
    const critElem = at(CRIT_ELEM_MULT, lv("會心擊【屬性】"));
    const aPos = Math.max(0, Math.min(aff, 100)) / 100;
    const elCritMult = 1 + aPos * (critElem - 1);
    element = elBase * elSharp * elCritMult;
  }

  // 屬性以較小係數併入綜合指標（物理仍為主；屬性流由 preset 端調整權重）
  const total = raw + element * 4.0;

  return {
    raw,
    element,
    total,
    effAttack,
    effAffinity: aff,
    critMult,
    sharpColor: SHARP_COLOR_ZH[sharpIdx],
    sharpMult,
  };
}
