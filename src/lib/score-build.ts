import type {
  BuildScore,
  FixedParts,
  ReservedSlots,
  ScoreProfile,
  SkillMap,
  Weapon,
} from "@/types/build";
import { DEFAULT_SCORE_PROFILE } from "@/types/build";
import { computeEfr } from "./efr";

export type ScoreInput = {
  /** 補珠後的最終技能（已截斷至上限）。 */
  finalSkills: SkillMap;
  requiredSkills: SkillMap;
  preferredSkills: SkillMap;
  avoidSkills: SkillMap;
  skillWeights: SkillMap;
  remainingSlots: number[];
  reservedSlots: ReservedSlots;
  meetsReserved: boolean;
  fixedParts: FixedParts;
  skillMax: Record<string, number>;
  skillIsSpecial: Record<string, boolean>;
  /** 目前配裝的武器（EFR 傷害計算用）。後援手動洞數時可能為 undefined。 */
  weapon?: Weapon;
  /** 排名權重（傷害/舒適/彈性）。未指定用 DEFAULT_SCORE_PROFILE。 */
  scoreProfile?: ScoreProfile;
  /** 屬性流：EFR 納入屬性傷害。 */
  preferElement?: boolean;
  /** 條件技能觸發率（傳入 EFR）。 */
  conditionalUptime?: number;
};

/** 洞位非線性價值：高等級洞更值錢（近似其可容納的珠子價值）。 */
const SLOT_VALUE: Record<number, number> = { 1: 1, 2: 3, 3: 5, 4: 8 };

function slotFlexValue(slots: number[]): number {
  let v = 0;
  for (const s of slots) v += SLOT_VALUE[s] ?? 0;
  return v;
}

/**
 * 綜合評分。假設進到此函式的配裝都已滿足必要技能（未滿足者於搜尋階段被淘汰）。
 *
 * 排名主軸改為 EFR 傷害 + 舒適(偏好技能) + 彈性(剩餘洞)，依 scoreProfile 分階加權：
 * - 傷害向（畢業-傷害）：damage 權重高
 * - 舒適向（新手/畢業-舒適）：comfort、slot 權重高
 * 必要技能為所有結果的共同前提（常數），不計入排名，僅保留欄位供顯示。
 */
export function scoreBuild(input: ScoreInput): BuildScore {
  const {
    finalSkills,
    requiredSkills,
    preferredSkills,
    avoidSkills,
    skillWeights,
    remainingSlots,
    fixedParts,
    skillIsSpecial,
    weapon,
    preferElement,
  } = input;
  const profile = input.scoreProfile ?? DEFAULT_SCORE_PROFILE;

  // ---- 傷害：EFR ----
  let efrValue = 0;
  let elementValue = 0;
  if (weapon) {
    const efr = computeEfr({
      weapon,
      skills: finalSkills,
      conditionalUptime: input.conditionalUptime,
    });
    // 物理流以 raw 排序；屬性流納入屬性傷害。
    efrValue = preferElement ? efr.total : efr.raw;
    elementValue = efr.element;
  }
  const damageScore = efrValue * profile.damage;

  // ---- 舒適：偏好技能（等級 × 權重）----
  let preferredSkillScore = 0;
  let specialSkillScore = 0;
  for (const [skill, target] of Object.entries(preferredSkills)) {
    const have = finalSkills[skill] ?? 0;
    const eff = Math.min(have, target);
    if (eff <= 0) continue;
    const weight = skillWeights[skill] ?? 1;
    preferredSkillScore += eff * weight * 20;
  }
  preferredSkillScore *= profile.comfort;

  // ---- 特殊技能：與偏好清單解耦，只要最終技能出現即計。----
  // 傷害相關特殊技能（狂化/伏魔等）已在 EFR 內計傷；此處僅當 utility 加分，
  // 故同樣依 comfort 權重縮放，避免污染「傷害最大」profile 的排名。
  for (const [skill, lvl] of Object.entries(finalSkills)) {
    if (lvl > 0 && skillIsSpecial[skill]) specialSkillScore += lvl * 15;
  }
  specialSkillScore *= profile.comfort;

  // ---- 彈性：剩餘洞位（非線性）----
  const slotScore = slotFlexValue(remainingSlots) * 3 * profile.slot;

  // ---- 排除技能：出現則扣分（不隨 profile 縮放，恆為硬訊號）----
  let penaltyScore = 0;
  for (const [skill] of Object.entries(avoidSkills)) {
    const have = finalSkills[skill] ?? 0;
    if (have > 0) penaltyScore -= have * 80;
  }

  // ---- 固定部位：穩定小加分 ----
  const fixedCount = (
    ["weapon", "head", "chest", "arms", "waist", "legs", "charm"] as const
  ).filter((p) => fixedParts[p as keyof FixedParts]).length;
  const fixedBonus = fixedCount * 5;

  // 必要技能：所有結果共同達成，僅供顯示，不計入 total（避免死常數灌水排名）。
  let requiredSkillScore = 0;
  for (const [skill, target] of Object.entries(requiredSkills)) {
    const have = finalSkills[skill] ?? 0;
    requiredSkillScore += Math.min(have, target) * 100;
  }

  const total =
    damageScore +
    preferredSkillScore +
    slotScore +
    specialSkillScore +
    penaltyScore +
    fixedBonus;

  return {
    total: Math.round(total),
    damageScore: Math.round(damageScore),
    requiredSkillScore: Math.round(requiredSkillScore),
    preferredSkillScore: Math.round(preferredSkillScore),
    slotScore: Math.round(slotScore),
    penaltyScore: Math.round(penaltyScore),
    specialSkillScore: Math.round(specialSkillScore),
    elementScore: Math.round(elementValue),
  };
}
