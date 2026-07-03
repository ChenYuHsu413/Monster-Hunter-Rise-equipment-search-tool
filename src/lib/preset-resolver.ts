import type {
  BuildPreset,
  ElementType,
  PresetAutoRules,
  ResolvedSkillConditions,
  SkillMap,
  SkillName,
  Weapon,
} from "@/types/build";

/** 五屬性 → 對應屬性攻擊強化技能。狀態異常（毒/麻/眠/爆破）與無屬性不在此列。 */
export const elementSkillMap: Partial<Record<ElementType, SkillName>> = {
  fire: "火屬性攻擊強化",
  water: "水屬性攻擊強化",
  thunder: "雷屬性攻擊強化",
  ice: "冰屬性攻擊強化",
  dragon: "龍屬性攻擊強化",
};

/** 取「兩邊較大值」合併技能表（不同於 mergeSkills 的累加）。 */
export function mergeMaxSkills(base: SkillMap, add: SkillMap): SkillMap {
  const out: SkillMap = { ...base };
  for (const [name, lvl] of Object.entries(add)) {
    out[name] = Math.max(out[name] ?? 0, lvl);
  }
  return out;
}

/**
 * 依 autoRules 與武器屬性計算要自動加入的技能。
 * 只有五屬性（fire/water/thunder/ice/dragon）會觸發；
 * none 與狀態異常（poison/paralysis/sleep/blast）不加入。
 */
export function resolveAutoSkills(
  autoRules: PresetAutoRules | undefined,
  weapon: Weapon | undefined
): SkillMap {
  if (!autoRules?.addElementAttackSkill) return {};
  const type = weapon?.element?.type;
  if (!type) return {};
  const skill = elementSkillMap[type];
  if (!skill) return {};
  return { [skill]: autoRules.elementAttackLevel ?? 5 };
}

/**
 * 套用 preset 的 autoRules 到技能條件。
 * - 複製 preset 的四組技能表
 * - 若 autoRules.addElementAttackSkill 且武器為五屬性，將對應屬性強化併入 requiredSkills（取較大值）
 * - autoAddedSkills 供 UI 顯示「已自動加入」
 */
export function resolvePresetSkills(
  preset: BuildPreset,
  weapon?: Weapon
): ResolvedSkillConditions {
  const auto = resolveAutoSkills(preset.autoRules, weapon);
  return {
    requiredSkills: mergeMaxSkills({ ...preset.requiredSkills }, auto),
    preferredSkills: { ...preset.preferredSkills },
    avoidSkills: { ...preset.avoidSkills },
    skillWeights: { ...preset.skillWeights },
    autoAddedSkills: auto,
  };
}
