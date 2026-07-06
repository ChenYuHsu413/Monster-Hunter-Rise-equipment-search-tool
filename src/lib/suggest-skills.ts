import type { Decoration, SkillMap } from "@/types/build";
import { normalizeSlots, placeDecoration } from "./slot-utils";

/** 一則「可追加技能」建議：把剩餘洞位全用於此技能時可再加的等級。 */
export type AddableSkill = { skillName: string; addLevels: number };

/**
 * 由一套配裝的剩餘洞位，推算「還能追加哪些技能」。
 *
 * 每個技能獨立計算：假設把所有剩餘洞位都投入該技能，用其珠子貪婪填裝，
 * 得出可再加的等級（受技能上限與現有等級限制）。因此清單為「擇一」性質——
 * 各項各自佔用剩餘洞，不代表可同時全加。無對應珠的技能（如純系列技能）自然不會出現。
 */
export function suggestAddableSkills(
  remainingSlots: number[],
  currentSkills: SkillMap,
  decorationsBySkill: Record<string, Decoration[]>,
  skillMax: Record<string, number>,
  limit = 8
): AddableSkill[] {
  const base = normalizeSlots(remainingSlots);
  if (base.length === 0) return [];

  const out: AddableSkill[] = [];
  for (const [skill, decos] of Object.entries(decorationsBySkill)) {
    const headroom = (skillMax[skill] ?? 7) - (currentSkills[skill] ?? 0);
    if (headroom <= 0) continue;

    // 效率優先：單顆等級高、需求洞小的珠先放。
    const sorted = [...decos].sort(
      (a, b) => b.skillLevel - a.skillLevel || a.slotLevel - b.slotLevel
    );

    let slots = [...base];
    let added = 0;
    let progressed = true;
    while (added < headroom && progressed) {
      progressed = false;
      for (const d of sorted) {
        const placed = placeDecoration(d.slotLevel, slots);
        if (placed) {
          slots = placed.remaining;
          added += d.skillLevel;
          progressed = true;
          break; // 重新從最有效率的珠開始
        }
      }
    }
    if (added >= 1) {
      out.push({ skillName: skill, addLevels: Math.min(added, headroom) });
    }
  }

  out.sort(
    (a, b) =>
      b.addLevels - a.addLevels || a.skillName.localeCompare(b.skillName)
  );
  return out.slice(0, limit);
}
