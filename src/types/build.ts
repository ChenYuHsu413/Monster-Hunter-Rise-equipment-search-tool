/**
 * 核心型別定義。
 *
 * 設計原則：
 * - 不寫死特定武器。所有武器共用同一組結構，武器差異只透過 `weaponType` 字串區分。
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
  /** 防具系列名稱（同系列 5 部位共用，例如「冥淵」「原初」）。 */
  seriesName?: string;
  /** 依稀有度推算的階級標籤：村 / HR / MR。為推算值，非精確任務解放條件。 */
  rankLabel?: string;
  /** 推測的主要來源怪物（由生產素材推得，同套 5 部位一致，非官方標註）。 */
  sourceMonster?: string;
};

/** 屬性 / 狀態異常類型。none 表示無屬性。 */
export type ElementType =
  | "fire"
  | "water"
  | "thunder"
  | "ice"
  | "dragon"
  | "poison"
  | "paralysis"
  | "sleep"
  | "blast"
  | "none";

/** 武器屬性篩選（只含五屬性；狀態異常與無屬性不列入）。 */
export type WeaponElementFilter = "fire" | "water" | "thunder" | "ice" | "dragon";

export type Weapon = {
  id: string;
  nameZh: string;
  nameEn?: string;
  weaponType: string;
  attack: number;
  /** 會心率（%）。 */
  affinity: number;
  slots: number[];
  element?: {
    type: ElementType;
    value: number;
  };
  sharpness?: {
    purple?: number;
    white?: number;
    blue?: number;
    green?: number;
  };
  /** 百龍洞等級（顯示用，不參與裝飾珠洞位計算）。 */
  rampageSlot?: number;
  skills?: SkillMap;
  tags: string[];
  rarity?: number;
  /** 弩槍彈種資訊（輕弩/重弩）。 */
  ammo?: {
    normal?: number[];
    pierce?: number[];
    spread?: number[];
    shrapnel?: number[];
    sticky?: number[];
    slicing?: number[];
    elemental?: string[];
    rapidFire?: string[];
  };
  /** 弓的射法/瓶種資訊。 */
  bow?: {
    shotType?: "rapid" | "pierce" | "spread";
    chargeLevels?: string[];
    coatings?: string[];
  };
  /** 銃槍砲擊資訊。 */
  shelling?: {
    type: "normal" | "long" | "wide";
    level: number;
  };
  /** 斬擊斧/盾斧瓶種。 */
  phial?: {
    type:
      | "power"
      | "element"
      | "impact"
      | "dragon"
      | "poison"
      | "paralysis"
      | "exhaust";
  };
  /** 操蟲棍獵蟲等級。 */
  kinsectLevel?: number;
  /** 武器系列/線（同一把武器的強化前後共用，例如「白兔刃」）。 */
  seriesName?: string;
  /** 依稀有度推算的階級標籤：村 / HR / MR。為推算值，非精確任務解放條件。 */
  rankLabel?: string;
  /** 生產素材（Kiranico 原始資料，含數量，例如「爵銀龍的純淨殼×6」）。 */
  materials?: string[];
  /** 推測的主要來源怪物（由生產素材推得，非官方標註）。 */
  sourceMonster?: string;
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

/** 武器類型定義。`supported: false` 的武器為佔位，將陸續開放。 */
export type WeaponType = {
  id: string;
  nameZh: string;
  nameEn?: string;
  supported: boolean;
};

/** preset 自動規則：依武器屬性自動加入條件技能等。 */
export type PresetAutoRules = {
  /** 依武器屬性（五屬性）自動加入對應「○屬性攻擊強化」。 */
  addElementAttackSkill?: boolean;
  /** 自動加入的屬性強化等級，預設 5。 */
  elementAttackLevel?: number;
};

/** preset 進度階段：初心（剛進 MR）→ 拓荒（MR 前期）→ 進階（中期）→ 畢業（TU5 終盤 meta）。 */
export type PresetTier = "初心" | "拓荒" | "進階" | "畢業";

export const PRESET_TIER_ORDER: PresetTier[] = ["初心", "拓荒", "進階", "畢業"];

/**
 * 各階段允許的防具 rarity 上限（取得門檻代理指標）。
 * MR 防具為 rarity 8（早期）/9（中期，含天迴龍 MR5）/10（終盤）。
 * 初心限 ≤8 以排除天迴龍等 MR5+ 裝；進階/畢業不設限（≤10）。
 * 註：Kiranico 無精確「MR 第幾星解放」資料，此為 rarity 推算的近似值。
 */
export const TIER_MAX_RARITY: Record<PresetTier, number> = {
  初心: 8,
  拓荒: 9,
  進階: 10,
  畢業: 10,
};

export type BuildPreset = {
  id: string;
  nameZh: string;
  weaponType: string;
  /** 進度階段分類（用於流派清單分組）。未標示者視為未分類。 */
  tier?: PresetTier;
  /** 屬攻武器流派：search 模式挑候選武器時以屬性值優先（與 autoRules 解耦，物理向初心屬性武器亦可開）。 */
  preferElement?: boolean;
  description: string;
  requiredSkills: SkillMap;
  preferredSkills: SkillMap;
  avoidSkills: SkillMap;
  skillWeights: SkillMap;
  autoRules?: PresetAutoRules;
  /** 套用時一併帶入的保留洞位（例如屬性模板預留 Lv3+Lv2 給屬性攻擊珠）。未指定則不改動現有保留洞位。 */
  reservedSlots?: Partial<ReservedSlots>;
  tags: string[];
};

/** resolvePresetSkills() 的結果：套用 autoRules 後的技能條件。 */
export type ResolvedSkillConditions = {
  requiredSkills: SkillMap;
  preferredSkills: SkillMap;
  avoidSkills: SkillMap;
  skillWeights: SkillMap;
  /** 由 autoRules 自動加入的技能（顯示用）。 */
  autoAddedSkills: SkillMap;
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

/** 武器搜尋模式：fixed = 固定指定武器；search = 從同類型武器中搜尋。 */
export type WeaponSearchMode = "fixed" | "search";

export type BuildSearchRequest = {
  weaponType: string;
  presetId: string;
  weaponSearchMode: WeaponSearchMode;
  /** weaponSearchMode 為 fixed 時使用的武器 id（與 fixedParts.weapon 相容，此欄優先）。 */
  fixedWeaponId?: string;
  /** preset 的自動規則（search 模式下由搜尋引擎逐武器套用）。 */
  autoRules?: PresetAutoRules;
  /** 武器屬性篩選（僅五屬性；search 模式縮小候選池，未指定＝不限）。 */
  elementFilter?: WeaponElementFilter;
  /** 裝備 rarity 上限（依 preset 階段限制取得門檻，同時套用於防具與 search 模式武器；未指定＝不限）。固定部位/武器不受限。 */
  maxRarity?: number;
  /** 屬攻武器流派：候選武器評分以屬性值優先。未指定時退回依 autoRules 推斷。 */
  preferElement?: boolean;
  /** @deprecated 舊版手動武器洞數。僅在武器候選池為空時作為後援。 */
  weaponSlots?: number[];
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
  /** 屬性流：武器屬性值加分（屬攻優先，延伸到最終排序）。非屬性流為 0。 */
  elementScore: number;
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
  /** 由 autoRules 依武器屬性自動加入的技能（顯示用）。 */
  autoSkills?: SkillMap;
  /** 武器是否為使用者固定（false = 系統搜尋選出）。 */
  weaponFixed?: boolean;
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
