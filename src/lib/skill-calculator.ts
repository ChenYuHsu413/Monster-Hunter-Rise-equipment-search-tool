import type { ArmorPiece, Charm, SkillMap, Weapon } from "@/types/build";

/** 合併多個 SkillMap（累加等級）。不 mutate 輸入。 */
export function mergeSkills(...maps: (SkillMap | undefined)[]): SkillMap {
  const out: SkillMap = {};
  for (const m of maps) {
    if (!m) continue;
    for (const [name, lvl] of Object.entries(m)) {
      out[name] = (out[name] ?? 0) + lvl;
    }
  }
  return out;
}

/**
 * 計算一套裝備（防具 + 護石 + 武器）在「未補珠」前的技能等級。
 * 珠子技能由 decoration-solver 之後再併入。
 */
export function calculateSkills(
  pieces: ArmorPiece[],
  charm: Charm | undefined,
  weapon?: Weapon
): SkillMap {
  return mergeSkills(
    ...pieces.map((p) => p.skills),
    charm?.skills,
    weapon?.skills
  );
}

/** 依技能上限截斷等級（超過上限的等級視為浪費，不計入）。 */
export function clampSkillsToMax(
  skills: SkillMap,
  skillMax: Record<string, number>
): SkillMap {
  const out: SkillMap = {};
  for (const [name, lvl] of Object.entries(skills)) {
    const max = skillMax[name];
    out[name] = max ? Math.min(lvl, max) : lvl;
  }
  return out;
}

/**
 * 計算距離目標技能還缺多少等級（gap）。
 * 已達成或超過的技能 gap 為 0。目標會先以 skillMax 截斷。
 */
export function skillGaps(
  current: SkillMap,
  target: SkillMap,
  skillMax: Record<string, number>
): SkillMap {
  const gaps: SkillMap = {};
  for (const [name, wanted] of Object.entries(target)) {
    const cap = skillMax[name] ?? wanted;
    const capped = Math.min(wanted, cap);
    const have = current[name] ?? 0;
    const gap = capped - have;
    if (gap > 0) gaps[name] = gap;
  }
  return gaps;
}

/** 是否已滿足所有必要技能。 */
export function meetsRequired(
  current: SkillMap,
  required: SkillMap,
  skillMax: Record<string, number>
): boolean {
  return Object.keys(skillGaps(current, required, skillMax)).length === 0;
}
