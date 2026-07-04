import type {
  BuildScore,
  FixedParts,
  ReservedSlots,
  SkillMap,
} from "@/types/build";
import { slotValue } from "./slot-utils";

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
  /** 屬性流武器屬性加分（由搜尋端依 preferElement 與武器屬性值算好帶入）。預設 0。 */
  elementScore?: number;
};

/**
 * 綜合評分。分數拆成細項方便 UI 顯示。
 * 假設進到此函式的配裝都已滿足必要技能（未滿足者於搜尋階段被淘汰）。
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
  } = input;
  const elementScore = input.elementScore ?? 0;

  // 必要技能：達成給穩定基礎分（依實際達成等級）
  let requiredSkillScore = 0;
  for (const [skill, target] of Object.entries(requiredSkills)) {
    const have = finalSkills[skill] ?? 0;
    requiredSkillScore += Math.min(have, target) * 100;
  }

  // 偏好技能：等級 × 權重
  let preferredSkillScore = 0;
  let specialSkillScore = 0;
  for (const [skill, target] of Object.entries(preferredSkills)) {
    const have = finalSkills[skill] ?? 0;
    const eff = Math.min(have, target);
    if (eff <= 0) continue;
    const weight = skillWeights[skill] ?? 1;
    preferredSkillScore += eff * weight * 20;
    if (skillIsSpecial[skill]) {
      specialSkillScore += eff * weight * 30;
    }
  }

  // 剩餘洞位：彈性加分
  const slotScore = slotValue(remainingSlots) * 3;

  // 排除技能：出現則扣分
  let penaltyScore = 0;
  for (const [skill] of Object.entries(avoidSkills)) {
    const have = finalSkills[skill] ?? 0;
    if (have > 0) penaltyScore -= have * 80;
  }

  // 固定部位：honor 規格（穩定小加分，不影響同條件排序）
  const fixedCount = (["weapon", "head", "chest", "arms", "waist", "legs", "charm"] as const).filter(
    (p) => fixedParts[p as keyof FixedParts]
  ).length;
  const fixedBonus = fixedCount * 5;

  const total =
    requiredSkillScore +
    preferredSkillScore +
    slotScore +
    penaltyScore +
    specialSkillScore +
    fixedBonus +
    elementScore;

  return {
    total: Math.round(total),
    requiredSkillScore: Math.round(requiredSkillScore),
    preferredSkillScore: Math.round(preferredSkillScore),
    slotScore: Math.round(slotScore),
    penaltyScore: Math.round(penaltyScore),
    specialSkillScore: Math.round(specialSkillScore),
    elementScore: Math.round(elementScore),
  };
}
