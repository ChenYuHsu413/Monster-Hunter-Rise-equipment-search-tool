import riseDecorationsRaw from "@/data/rise/decorations.json";
import riseSkillsRaw from "@/data/rise/skills.json";
import riseWeaponTypesRaw from "@/data/rise/weaponTypes.json";

import type {
  Decoration,
  GameId,
  SetBonus,
  Skill,
  WeaponType,
} from "@/types/build";

/**
 * 集中式資料存取層（小型、UI 立即需要的資料），per-game。
 *
 * 大型的防具 / 武器資料改由 game-data.ts 延遲載入（不進首屏 bundle），
 * 搜尋時透過 createSearchDeps() 注入。此檔保留技能 / 珠子 / 武器類型 / 套裝加成
 * 等小資料與其衍生索引。
 *
 * 設計：`buildStaticData()` 為 game-agnostic 工廠，由各遊戲的原始陣列建出所有衍生索引；
 * Rise 實例（`riseStatic`）維持與改造前完全相同的輸出，並以既有的具名 export 同步供 UI 使用。
 * World 小資料於 PLAN Phase 2 產出後以 `getGameStaticData("world")` 接入。
 */

export type GameStaticData = {
  decorations: Decoration[];
  skills: Skill[];
  weaponTypes: WeaponType[];
  /** 套裝加成（World）；Rise 為空陣列。 */
  setBonuses: SetBonus[];
  /** 技能名稱 → 最大等級。 */
  skillMax: Record<string, number>;
  /** 技能名稱 → Skill 主資料。 */
  skillByName: Record<string, Skill>;
  /** 技能名稱 → 可補該技能的珠子（依「每洞覆蓋效率」排序）。 */
  decorationsBySkill: Record<string, Decoration[]>;
  /** 高風險/高價值特殊技能名稱集合（skills.json 的 special）。 */
  specialSkills: Set<string>;
};

/**
 * 由原始陣列建出一款遊戲的全部小資料衍生索引。
 *
 * decorationsBySkill 遍歷 `d.skills ?? { [d.skillName]: d.skillLevel }`：
 * Rise 珠子無 `skills` 欄，退回單技能 `{skillName: skillLevel}`，索引與排序與改造前
 * 逐位元相同（由回歸基準驗證）；World 複合珠則被每個技能各索引一次。
 */
export function buildStaticData(
  decorations: Decoration[],
  skills: Skill[],
  weaponTypes: WeaponType[],
  setBonuses: SetBonus[] = []
): GameStaticData {
  const skillMax: Record<string, number> = Object.fromEntries(
    skills.map((s) => [s.name, s.maxLevel])
  );
  const skillByName: Record<string, Skill> = Object.fromEntries(
    skills.map((s) => [s.name, s])
  );
  const specialSkills = new Set<string>(
    skills.filter((s) => s.special).map((s) => s.name)
  );

  const decorationsBySkill: Record<string, Decoration[]> = {};
  const levelForSkill = (d: Decoration, skill: string): number =>
    (d.skills ?? { [d.skillName]: d.skillLevel })[skill] ?? 0;
  for (const d of decorations) {
    const effSkills = d.skills ?? { [d.skillName]: d.skillLevel };
    for (const skillName of Object.keys(effSkills)) {
      (decorationsBySkill[skillName] ??= []).push(d);
    }
  }
  // 排序鍵以「該索引技能的等級」計：複合珠對不同技能可有不同排序位置，
  // 另一技能視為附贈不參與。Rise 珠子單技能，退回 skillLevel，排序與改造前逐位元一致。
  for (const [skill, list] of Object.entries(decorationsBySkill)) {
    list.sort((a, b) => {
      const la = levelForSkill(a, skill);
      const lb = levelForSkill(b, skill);
      // 高覆蓋在前
      if (lb !== la) return lb - la;
      // 同覆蓋則洞小在前
      return a.slotLevel - b.slotLevel;
    });
  }

  return {
    decorations,
    skills,
    weaponTypes,
    setBonuses,
    skillMax,
    skillByName,
    decorationsBySkill,
    specialSkills,
  };
}

/** Rise 小資料實例（Rise 無 SetBonus，故 setBonuses 為空）。 */
const riseStatic = buildStaticData(
  riseDecorationsRaw as unknown as Decoration[],
  riseSkillsRaw as unknown as Skill[],
  riseWeaponTypesRaw as unknown as WeaponType[],
  []
);

const staticByGame = new Map<GameId, GameStaticData>([["rise", riseStatic]]);

/** 依 gameId 取得小資料索引（World 於 Phase 2 註冊）。 */
export function getGameStaticData(gameId: GameId): GameStaticData {
  const s = staticByGame.get(gameId);
  if (!s) {
    throw new Error(
      `static data not registered for "${gameId}" (World 於 Phase 2 接入)`
    );
  }
  return s;
}

/** 供 Phase 2 註冊 World 小資料。 */
export function registerGameStaticData(gameId: GameId, data: GameStaticData) {
  staticByGame.set(gameId, data);
}

// ---- Rise 具名 export（UI 同步使用；值與改造前完全相同）----
export const decorations = riseStatic.decorations;
export const skills = riseStatic.skills;
export const weaponTypes = riseStatic.weaponTypes;
export const skillMax = riseStatic.skillMax;
export const skillByName = riseStatic.skillByName;
export const decorationsBySkill = riseStatic.decorationsBySkill;
export const SPECIAL_SKILLS = riseStatic.specialSkills;

/**
 * 套裝（系列）技能：靠穿戴同系列防具件數累加觸發，而非單件給滿。
 * 風紋一致/雷紋一致/風雷合一 無對應珠子（只能靠防具）；霞皮/鋼殼/炎鱗之恩惠
 * 在 Sunbreak 另有對應珠（霞皮珠等），故仍可由珠子補足。此集合僅供 UI 分類辨識。
 * （Rise 專屬常數，非資料衍生；World 的套裝機制走 SetBonus 型別。）
 */
export const SET_SKILLS = new Set<string>([
  "風紋一致",
  "雷紋一致",
  "風雷合一",
  "霞皮之恩惠",
  "鋼殼之恩惠",
  "炎鱗之恩惠",
]);
