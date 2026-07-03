import type {
  ArmorPiece,
  EquipmentPools,
  ExcludedItems,
  FixedParts,
  SkillMap,
} from "@/types/build";
import { ARMOR_PARTS } from "@/types/build";
import { slotValue } from "./slot-utils";

/** 依部位分組所有防具，並套用排除清單。 */
export function buildEquipmentPools(
  armors: ArmorPiece[],
  excluded?: ExcludedItems
): EquipmentPools {
  const excludeSet = new Set(excluded?.armorIds ?? []);
  const pools = {
    head: [],
    chest: [],
    arms: [],
    waist: [],
    legs: [],
  } as EquipmentPools;
  for (const a of armors) {
    if (excludeSet.has(a.id)) continue;
    if (pools[a.part]) pools[a.part].push(a);
  }
  return pools;
}

/** 從既有候選池再套用一次排除（用於結果卡片「排除此裝備」後重搜）。 */
export function applyExcludedItems(
  pools: EquipmentPools,
  excluded: ExcludedItems
): EquipmentPools {
  const excludeSet = new Set(excluded.armorIds);
  const out = {} as EquipmentPools;
  for (const part of ARMOR_PARTS) {
    out[part] = pools[part].filter((a) => !excludeSet.has(a.id));
  }
  return out;
}

/**
 * 套用固定部位：被固定的部位候選池收斂為單一指定裝備。
 * 找不到指定 id 時保留原池（避免搜尋直接無解，UI 另行提示）。
 */
export function applyFixedParts(
  pools: EquipmentPools,
  fixed: FixedParts,
  armorById: Record<string, ArmorPiece>
): EquipmentPools {
  const out = {} as EquipmentPools;
  for (const part of ARMOR_PARTS) {
    const fixedId = fixed[part];
    if (fixedId && armorById[fixedId]) {
      out[part] = [armorById[fixedId]];
    } else {
      out[part] = pools[part];
    }
  }
  return out;
}

/**
 * 單件裝備對某流派的啟發式分數，用於 fast/greedy 模式候選篩選。
 * 只是粗略排序，不代表最終配裝分數。
 */
export function scoreArmorPieceForPreset(
  piece: ArmorPiece,
  required: SkillMap,
  preferred: SkillMap,
  avoid: SkillMap,
  weights: SkillMap
): number {
  let score = 0;
  for (const [skill, lvl] of Object.entries(piece.skills)) {
    if (required[skill]) score += lvl * 12;
    if (preferred[skill]) score += lvl * (weights[skill] ?? 1) * 4;
    if (avoid[skill]) score -= lvl * 25;
  }
  // 洞位彈性：能容納珠子越多越好
  score += slotValue(piece.slots) * 1.5;
  return score;
}

/**
 * 針對 greedy 模式的排序鍵：優先「能補多少必要技能缺口」。
 */
export function requiredCoverageScore(
  piece: ArmorPiece,
  required: SkillMap
): number {
  let cover = 0;
  for (const [skill, lvl] of Object.entries(piece.skills)) {
    if (required[skill]) cover += lvl;
  }
  return cover;
}

/**
 * 依模式對候選池做裁切。
 * - exact：全部保留
 * - fast：每部位保留啟發式分數前 limit 名
 * - greedy：每部位保留「必要覆蓋 + 分數」前 limit 名（更小）
 */
export function prunePools(
  pools: EquipmentPools,
  preset: {
    requiredSkills: SkillMap;
    preferredSkills: SkillMap;
    avoidSkills: SkillMap;
    skillWeights: SkillMap;
  },
  mode: "fast" | "exact" | "greedy",
  fixed: FixedParts
): EquipmentPools {
  // 每部位保留件數（控制組合數 N^5)。
  // 全防具資料庫下（每部位 300+ 件),暴力枚舉不可行,故各模式皆做相關度裁切。
  const limit = mode === "greedy" ? 7 : mode === "fast" ? 9 : 12;

  // 相關技能集合（必要 + 偏好),用於預先濾除完全無關的裝備。
  const relevant = new Set([
    ...Object.keys(preset.requiredSkills),
    ...Object.keys(preset.preferredSkills),
  ]);

  const scoreOf = (piece: ArmorPiece) =>
    scoreArmorPieceForPreset(
      piece,
      preset.requiredSkills,
      preset.preferredSkills,
      preset.avoidSkills,
      preset.skillWeights
    ) +
    (mode === "greedy"
      ? requiredCoverageScore(piece, preset.requiredSkills) * 20
      : 0);

  const out = {} as EquipmentPools;
  for (const part of ARMOR_PARTS) {
    // 已固定的部位只有一件，不需裁切
    if (fixed[part]) {
      out[part] = pools[part];
      continue;
    }
    // 預先濾除：既無相關技能、洞位又少（<4)的裝備直接淘汰。
    const useful = pools[part].filter((p) => {
      const hasRel = Object.keys(p.skills).some((s) => relevant.has(s));
      const slotV = (p.slots ?? []).reduce((a, b) => a + b, 0);
      return hasRel || slotV >= 4;
    });
    const pool = useful.length ? useful : pools[part];
    out[part] = pool
      .map((piece) => ({ piece, score: scoreOf(piece) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((x) => x.piece);
  }
  return out;
}
