import decorationsRaw from "@/data/decorations.json";
import skillsRaw from "@/data/skills.json";
import weaponTypesRaw from "@/data/weaponTypes.json";

import type {
  Decoration,
  Skill,
  WeaponType,
} from "@/types/build";

/**
 * 集中式資料存取層（小型、UI 立即需要的資料）。
 *
 * 大型的防具 / 武器資料改由 game-data.ts 延遲載入（不進首屏 bundle），
 * 搜尋時透過 createSearchDeps() 注入。此檔只保留技能 / 珠子 / 武器類型
 * 等小資料與其衍生索引。
 */

export const decorations = decorationsRaw as unknown as Decoration[];
export const skills = skillsRaw as unknown as Skill[];
export const weaponTypes = weaponTypesRaw as unknown as WeaponType[];

/**
 * 套裝（系列）技能：靠穿戴同系列防具件數累加觸發，而非單件給滿。
 * 風紋一致/雷紋一致/風雷合一 無對應珠子（只能靠防具）；霞皮/鋼殼/炎鱗之恩惠
 * 在 Sunbreak 另有對應珠（霞皮珠等），故仍可由珠子補足。此集合僅供 UI 分類辨識。
 */
export const SET_SKILLS = new Set<string>([
  "風紋一致",
  "雷紋一致",
  "風雷合一",
  "霞皮之恩惠",
  "鋼殼之恩惠",
  "炎鱗之恩惠",
]);

/**
 * 高風險/高價值特殊技能（狂化、業鎧、狂龍症、血氣覺醒等；skills.json 的 special）。
 * 這批多為傀異錬成/狂竜化衍生，搜尋器不模擬其取得，故推薦配裝匯入時不列入必要技能。
 */
export const SPECIAL_SKILLS = new Set<string>(
  skills.filter((s) => s.special).map((s) => s.name)
);

/** 技能名稱 → 最大等級。未列出的技能預設上限 7。 */
export const skillMax: Record<string, number> = Object.fromEntries(
  skills.map((s) => [s.name, s.maxLevel])
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
