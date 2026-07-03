import decorationsRaw from "@/data/decorations.json";
import skillsRaw from "@/data/skills.json";
import weaponTypesRaw from "@/data/weaponTypes.json";
import presetsRaw from "@/data/buildPresets.json";

import type {
  BuildPreset,
  Decoration,
  Skill,
  WeaponType,
} from "@/types/build";

/**
 * 集中式資料存取層（小型、UI 立即需要的資料）。
 *
 * 大型的防具 / 武器資料改由 game-data.ts 延遲載入（不進首屏 bundle），
 * 搜尋時透過 createSearchDeps() 注入。此檔只保留技能 / 珠子 / 武器類型 /
 * preset 等小資料與其衍生索引。
 */

export const decorations = decorationsRaw as unknown as Decoration[];
export const skills = skillsRaw as unknown as Skill[];
export const weaponTypes = weaponTypesRaw as unknown as WeaponType[];
export const buildPresets = presetsRaw as unknown as BuildPreset[];

/** 技能名稱 → 最大等級。未列出的技能預設上限 7。 */
export const skillMax: Record<string, number> = Object.fromEntries(
  skills.map((s) => [s.name, s.maxLevel])
);

/** 技能名稱 → 是否為特殊/高風險技能。 */
export const skillIsSpecial: Record<string, boolean> = Object.fromEntries(
  skills.map((s) => [s.name, !!s.special])
);

/** 技能名稱 → Skill 主資料。 */
export const skillByName: Record<string, Skill> = Object.fromEntries(
  skills.map((s) => [s.name, s])
);

/** 技能名稱 → 可補該技能的珠子（依「每洞覆蓋效率」排序：等級高、洞小優先）。 */
export const decorationsBySkill: Record<string, Decoration[]> = (() => {
  const map: Record<string, Decoration[]> = {};
  for (const d of decorations) {
    (map[d.skillName] ??= []).push(d);
  }
  for (const list of Object.values(map)) {
    list.sort((a, b) => {
      // 高覆蓋在前
      if (b.skillLevel !== a.skillLevel) return b.skillLevel - a.skillLevel;
      // 同覆蓋則洞小在前
      return a.slotLevel - b.slotLevel;
    });
  }
  return map;
})();

export function getPreset(id: string): BuildPreset | undefined {
  return buildPresets.find((p) => p.id === id);
}

export function presetsForWeapon(weaponType: string): BuildPreset[] {
  return buildPresets.filter((p) => p.weaponType === weaponType);
}
