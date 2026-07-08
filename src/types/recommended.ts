/**
 * 推薦配裝（Game8 爬蟲產物 data/recommended-builds.json）的顯示端型別。
 *
 * 唯一真相來源＝scripts/scrape-game8.js 的 SCHEMA_DOC（見該檔 meta.schemaDoc）。
 * 這裡只覆蓋「顯示端會讀到」的欄位；純除錯欄位（game8Id 等）以選用型別帶過。
 *
 * ID 慣例：armors/weapons/decorations 存專案內部 id（armor_* / weapon_* / deco_*，
 * 少數為手工合成 deco_manual_*）；skills 直接存中文名稱字串。對應不到時 id 省略，
 * 顯示端 fallback 到 rawNameJa 並加警告樣式。
 */

/** 五個階段分類 + 推薦武器一覽。 */
export type RecommendedCategory =
  | "riseLow"
  | "riseHigh"
  | "riseEndgame"
  | "mrEarly"
  | "mrEndgame"
  | "weaponRecommend";

export type RecommendedKind =
  | "full-build"
  | "armor-pieces"
  | "weapon-list"
  | "kinsect-list";

/** 一顆裝飾珠引用。placeholder=true 時為屬性佔位符（無 id，顯示「對應屬性珠」）。 */
export type RecoDecoration = {
  /** 內部 deco id（deco_* / deco_manual_*）。placeholder 珠無此欄。 */
  id?: string;
  rawNameJa?: string;
  count?: number;
  game8Id?: number;
  /** 屬性佔位符：依武器屬性自選對應珠，非單一珠、無 id。 */
  placeholder?: boolean;
  /** 空洞佔位（Game8 標明留空的洞）。 */
  free?: boolean;
  /** free 洞的等級。 */
  slotSize?: number;
};

/** 技能引用。id＝中文名稱（技能無獨立 id）。 */
export type RecoSkill = {
  id?: string;
  rawNameJa?: string;
  level: number;
};

/** 發動技能總表的一列（僅 full-build，來源提供時）。 */
export type RecoSkillTotal = RecoSkill & {
  /** 紅字必要技能。 */
  required?: boolean;
  /** 傀異錬成後的實際等級（有加成時）。 */
  augmentedLevel?: number;
};

/** 武器引用。 */
export type RecoWeapon = {
  id?: string;
  rawNameJa?: string;
  game8Id?: number;
  /** 洞位等級陣列（weapon-list 有）。 */
  slots?: number[];
  /** 百龍洞等級（weapon-list 有）。 */
  rampageSlot?: number;
  /** Game8 原樣規格字串（攻擊/屬性/會心）。 */
  statsRaw?: string;
  /** weapon-list：H3 標題原文（含時期標註）。 */
  noteRaw?: string;
  /** full-build：武器上的裝飾珠。 */
  decorations?: RecoDecoration[];
  /** full-build：百龍裝飾珠（rawNameJa 原文，無 id 解析）。 */
  rampageDecos?: { rawNameJa: string; count?: number }[];
};

/** 一件防具引用（full-build slot 恆為部位；armor-pieces slot=null）。 */
export type RecoArmor = {
  slot: "head" | "chest" | "arms" | "waist" | "legs" | null;
  id?: string;
  rawNameJa?: string;
  game8Id?: number;
  /** A/B 二擇一：存在時 id=alternatives[0].id，全部可選件列此。 */
  alternatives?: { id?: string; rawNameJa?: string }[];
  /** 傀異錬成內容（日文原樣）。 */
  augmentRaw?: string;
  /** full-build：該部位裝飾珠。 */
  decorations?: RecoDecoration[];
  /** armor-pieces：該件洞位。 */
  slots?: number[];
  /** armor-pieces：該件自帶技能。 */
  skills?: RecoSkill[];
};

/** 護石（full-build 選用）。 */
export type RecoTalisman = {
  skills?: RecoSkill[];
  slots?: number[];
  decorations?: RecoDecoration[];
};

/** 獵蟲（kinsect-list / weapon-list 選用；僅 rawNameJa，無 id 解析）。 */
export type RecoKinsect = {
  rawNameJa: string;
  game8Id?: number | null;
  statsRaw?: string;
};

/** 一筆推薦配裝。欄位依 kind 而異，顯示端須分別處理。 */
export type RecommendedBuild = {
  id: string;
  weaponType: string;
  category: RecommendedCategory;
  kind: RecommendedKind;
  buildName: string;
  stageName?: string;
  weapons?: RecoWeapon[];
  armor?: RecoArmor[];
  talisman?: RecoTalisman | null;
  /** 全裝珠總計（僅上位畢業格式；該格式不逐部位標珠）。 */
  buildDecorations?: RecoDecoration[] | null;
  /** 發動技能總表（null＝來源未提供）。 */
  skillTotals?: RecoSkillTotal[] | null;
  /** 百龍技能（rawNameJa 原文，無 id 解析）。 */
  rampageSkills?: { rawNameJa: string }[] | null;
  kinsect?: RecoKinsect[];
  sourceUrl: string;
};

/** recommended-builds.json 頂層結構。 */
export type RecommendedBuildsFile = {
  meta: {
    source: string;
    attribution: string;
    scrapedAt: string;
    [k: string]: unknown;
  };
  builds: RecommendedBuild[];
  errors: unknown[];
  unresolved: unknown[];
};
