import type {
  Decoration,
  DecorationAssignment,
  DecorationSolveResult,
  EquipmentPart,
  ReservedSlots,
  SkillMap,
} from "@/types/build";
import { normalizeSlots, placeDecoration } from "./slot-utils";
import { mergeSkills, skillGaps } from "./skill-calculator";

export type SolveInput = {
  /** 已合併好的洞池（未正規化亦可，內部會正規化）。 */
  slots: number[];
  /** 補珠前的既有技能（防具 + 護石 + 武器）。 */
  currentSkills: SkillMap;
  requiredSkills: SkillMap;
  reservedSlots: ReservedSlots;
  /** 技能名稱 → 可用珠子清單（已依效率排序）。 */
  decorationsBySkill: Record<string, Decoration[]>;
  skillMax: Record<string, number>;
  /** 洞池來源標記（第一版統一標為 "mixed"，細分需要逐洞追蹤，MVP 從簡）。 */
  source?: EquipmentPart;
};

/** 從洞池挑選一顆最適合補指定技能的珠子（不 mutate slots）。 */
function pickDecoForSkill(
  skill: string,
  gap: number,
  slots: number[],
  decorationsBySkill: Record<string, Decoration[]>
): Decoration | null {
  const candidates = (decorationsBySkill[skill] ?? []).filter((d) =>
    slots.some((s) => s >= d.slotLevel)
  );
  if (candidates.length === 0) return null;

  // 目標：最省洞位。以「對缺口的有效覆蓋」為主，其次用小洞。
  let best: Decoration | null = null;
  let bestKey: [number, number, number] | null = null;
  for (const d of candidates) {
    const effective = Math.min(d.skillLevel, gap); // 有效覆蓋
    const overshoot = d.skillLevel - effective; // 浪費的等級
    // 排序鍵：覆蓋大→洞小→浪費少
    const key: [number, number, number] = [-effective, d.slotLevel, overshoot];
    if (!bestKey || lexLess(key, bestKey)) {
      bestKey = key;
      best = d;
    }
  }
  return best;
}

function lexLess(a: [number, number, number], b: [number, number, number]) {
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return a[i] < b[i];
  }
  return false;
}

/**
 * 嘗試從洞池中保留指定的洞位需求。
 * 高等級需求優先（較難滿足），每項以「能容納的最小洞」保留。
 * 回傳 { held, remaining } 或 null（無法保留）。
 */
function reserveSlots(
  slots: number[],
  reserved: ReservedSlots
): { held: number[]; remaining: number[] } | null {
  const work = [...slots];
  const held: number[] = [];
  for (const level of [4, 3, 2, 1] as const) {
    const need = reserved[level] ?? 0;
    for (let i = 0; i < need; i++) {
      // 找能容納 level 的最小洞
      let bestIdx = -1;
      let bestVal = Infinity;
      for (let j = 0; j < work.length; j++) {
        if (work[j] >= level && work[j] < bestVal) {
          bestVal = work[j];
          bestIdx = j;
        }
      }
      if (bestIdx === -1) return null;
      held.push(work[bestIdx]);
      work.splice(bestIdx, 1);
    }
  }
  return { held, remaining: work };
}

/**
 * 自動補珠主流程：
 * 1. 先補 requiredSkills；補不滿 → success:false（missingRequired 記錄缺口）
 * 2. 檢查 reservedSlots 是否仍能保留；不能 → success:false（保留洞位視為硬條件）
 * 3. 回傳所有指派、達成技能、剩餘洞位（含保留下來的空洞，留給玩家自由運用）
 */
export function solveDecorations(input: SolveInput): DecorationSolveResult {
  const {
    currentSkills,
    requiredSkills,
    reservedSlots,
    decorationsBySkill,
    skillMax,
  } = input;
  const source: EquipmentPart = input.source ?? "head";

  let slots = normalizeSlots(input.slots);
  const assignments: DecorationAssignment[] = [];
  const achieved: SkillMap = {};

  const record = (d: Decoration, placedInSlotLevel: number) => {
    assignments.push({
      decorationId: d.id,
      decorationName: d.nameZh,
      skillName: d.skillName,
      skillLevel: d.skillLevel,
      slotLevel: d.slotLevel,
      placedInSlotLevel,
      source,
    });
    achieved[d.skillName] = (achieved[d.skillName] ?? 0) + d.skillLevel;
  };

  // ---- 1. 必要技能 ----
  // 逐一補足缺口。每輪重算 gap（因為某些珠子可能一次補多級）。
  const requiredGaps = skillGaps(currentSkills, requiredSkills, skillMax);
  for (const skill of Object.keys(requiredGaps)) {
    const gap = () =>
      (skillMax[skill] ? Math.min(requiredSkills[skill], skillMax[skill]) : requiredSkills[skill]) -
      ((currentSkills[skill] ?? 0) + (achieved[skill] ?? 0));
    while (gap() > 0) {
      const deco = pickDecoForSkill(skill, gap(), slots, decorationsBySkill);
      if (!deco) {
        // 無法補滿必要技能
        return {
          success: false,
          assignments,
          achievedSkills: mergeSkills(currentSkills, achieved),
          remainingSlots: slots,
          missingRequired: skillGaps(
            mergeSkills(currentSkills, achieved),
            requiredSkills,
            skillMax
          ),
        };
      }
      const placed = placeDecoration(deco.slotLevel, slots);
      if (!placed) break; // 理論上不會發生（pick 已確認可放）
      record(deco, placed.placedInSlotLevel);
      slots = placed.remaining;
    }
  }

  // ---- 2. 保留洞位（硬條件）----
  const reserve = reserveSlots(slots, reservedSlots);
  if (!reserve) {
    return {
      success: false,
      assignments,
      achievedSkills: mergeSkills(currentSkills, achieved),
      remainingSlots: slots,
      missingRequired: {}, // 必要技能已達成，但保留洞位失敗
    };
  }
  // ---- 3. 回傳 ----
  // 剩餘洞位 = 自由洞 + 保留下來的空洞（都仍可供玩家使用）
  const remaining = normalizeSlots([...reserve.remaining, ...reserve.held]);
  return {
    success: true,
    assignments,
    achievedSkills: mergeSkills(currentSkills, achieved),
    remainingSlots: remaining,
    missingRequired: {},
  };
}
