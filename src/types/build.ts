/**
 * 核心型別定義。
 *
 * 設計原則：
 * - 不寫死「太刀」。所有武器共用同一組結構，武器差異只透過 `weaponType` 字串區分。
 * - 保持可擴充：未來要接 SQLite / Supabase / IndexedDB 時，這些型別即為資料列的 shape。
 */

export type SkillName = string;

/** 技能名稱 → 等級 的對應表。等級為累計後的實際等級。 */
export type SkillMap = Record<SkillName, number>;

/** 洞的等級。4 級洞為 Sunbreak 傀異鍊成/特定裝備才有。 */
export type SlotLevel = 1 | 2 | 3 | 4;

/** 全部可固定/鎖定的部位（含武器與護石）。 */
export type EquipmentPart =
  | "weapon"
  | "head"
  | "chest"
  | "arms"
  | "waist"
  | "legs"
  | "charm";

/** 只有防具的五個部位。 */
export type ArmorPart = "head" | "chest" | "arms" | "waist" | "legs";

export const ARMOR_PARTS: ArmorPart[] = [
  "head",
  "chest",
  "arms",
  "waist",
  "legs",
];

export const ARMOR_PART_LABELS: Record<ArmorPart, string> = {
  head: "頭部",
  chest: "身體",
  arms: "手部",
  waist: "腰部",
  legs: "腳部",
};

export const EQUIPMENT_PART_LABELS: Record<EquipmentPart, string> = {
  weapon: "武器",
  head: "頭部",
  chest: "身體",
  arms: "手部",
  waist: "腰部",
  legs: "腳部",
  charm: "護石",
};

/** 一件防具。slots 為洞的等級陣列，例如 [3,1,0] 代表一個 3 級洞、一個 1 級洞、一個空位。 */
export type ArmorPiece = {
  id: string;
  nameZh: string;
  nameEn?: string;
  part: ArmorPart;
  rarity?: number;
  /** 每個元素是該洞的等級。0 代表沒有洞（正規化後通常會濾掉 0）。 */
  slots: number[];
  skills: SkillMap;
  defense?: number;
  elementRes?: {
    fire: number;
    water: number;
    thunder: number;
    ice: number;
    dragon: number;
  };
  tags?: string[];
  /** 傀異鍊成產生的自訂版本標記。 */
  isAugmented?: boolean;
  /** 若為鍊成版本，指向原始防具 id。 */
  baseArmorId?: string;
};

export type Weapon = {
  id: string;
  nameZh: string;
  weaponType: string;
  slots: number[];
  skills?: SkillMap;
  attack?: number;
  affinity?: number;
  element?: string;
  elementValue?: number;
  tags?: string[];
};

export type Decoration = {
  id: string;
  nameZh: string;
  slotLevel: SlotLevel;
  skillName: string;
  skillLevel: number;
  craftable: boolean;
};

export type Charm = {
  id?: string;
  name?: string;
  skills: SkillMap;
  slots: number[];
};

/** 技能主資料（用於 UI 顯示上限、分類、描述）。 */
export type Skill = {
  name: string;
  nameEn?: string;
  maxLevel: number;
  category?: string;
  description?: string;
  /** 是否為高風險/高價值特殊技能（狂化、業鎧、狂龍症等），影響評分。 */
  special?: boolean;
};

/** 武器類型定義。第一版只有太刀完整支援，其餘 `supported: false` 佔位。 */
export type WeaponType = {
  id: string;
  nameZh: string;
  nameEn?: string;
  supported: boolean;
};

export type BuildPreset = {
  id: string;
  nameZh: string;
  weaponType: string;
  description: string;
  requiredSkills: SkillMap;
  preferredSkills: SkillMap;
  avoidSkills: SkillMap;
  skillWeights: SkillMap;
  tags: string[];
};

/** 固定部位。字串為裝備 id；護石因為使用者手動輸入，直接存物件。 */
export type FixedParts = {
  weapon?: string;
  head?: string;
  chest?: string;
  arms?: string;
  waist?: string;
  legs?: string;
  charm?: Charm;
};

export type ExcludedItems = {
  armorIds: string[];
  weaponIds: string[];
};

/** 保留洞位：每個等級要留幾個。第一版為硬性條件。 */
export type ReservedSlots = {
  4: number;
  3: number;
  2: number;
  1: number;
};

export type SearchMode = "fast" | "exact" | "greedy";

export type BuildSearchRequest = {
  weaponType: string;
  presetId: string;
  weaponSlots: number[];
  charm: Charm;
  fixedParts: FixedParts;
  excludedItems: ExcludedItems;
  requiredSkills: SkillMap;
  preferredSkills: SkillMap;
  avoidSkills: SkillMap;
  /** 偏好技能的評分權重（由 preset 帶入，可隨技能條件一起調整）。 */
  skillWeights: SkillMap;
  reservedSlots: ReservedSlots;
  searchMode: SearchMode;
  resultLimit: number;
};

/** 一顆被放入某個洞的珠子紀錄。 */
export type DecorationAssignment = {
  decorationId: string;
  decorationName: string;
  skillName: string;
  skillLevel: number;
  /** 珠子本身需要的洞等級。 */
  slotLevel: number;
  /** 實際被放進去的洞等級（可能比 slotLevel 高）。 */
  placedInSlotLevel: number;
  /** 洞來源部位。 */
  source: EquipmentPart;
};

export type BuildScore = {
  total: number;
  requiredSkillScore: number;
  preferredSkillScore: number;
  slotScore: number;
  penaltyScore: number;
  specialSkillScore: number;
};

export type BuildResult = {
  id: string;
  weapon?: Weapon;
  armor: {
    head: ArmorPiece;
    chest: ArmorPiece;
    arms: ArmorPiece;
    waist: ArmorPiece;
    legs: ArmorPiece;
  };
  charm: Charm;
  decorations: DecorationAssignment[];
  finalSkills: SkillMap;
  /** 補完珠子後仍剩下的洞（依等級展開，例如 [3,1]）。 */
  remainingSlots: number[];
  score: BuildScore;
  /** 未能補滿的必要技能（技能 → 還缺幾級）。理論上搜尋結果不含缺口，但保留欄位供 debug/greedy。 */
  missingRequiredSkills: SkillMap;
  /** 是否符合保留洞位需求。 */
  meetsReservedSlots: boolean;
  summary: string;
};

/** decoration-solver 的回傳結構。 */
export type DecorationSolveResult = {
  success: boolean;
  assignments: DecorationAssignment[];
  achievedSkills: SkillMap;
  remainingSlots: number[];
  /** 未補滿的必要技能缺口。 */
  missingRequired: SkillMap;
};

/** 候選池：每個部位對應一組候選裝備。 */
export type EquipmentPools = Record<ArmorPart, ArmorPiece[]>;
