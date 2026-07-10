/**
 * 社群配裝（data/community-builds/cb_*.json，schema v2）的顯示端型別。
 *
 * 唯一真相來源＝scripts/validate-community-builds.mjs 的 SCHEMA_DOC。
 * 這裡只覆蓋「顯示端會讀到」的欄位。
 *
 * 設計前提：社群來源多為文字骨架（防具＋目標技能）；精確孔位／珠子／護石由使用者
 * 匯入配裝器後、以自身資源用 decoration-solver 計算。故骨架必填、細節選填；
 * 『選填欄位缺失是合法狀態，不是資料錯誤』。名稱存繁中／日文／簡中原文（非專案 id），
 * 由 community-builds.ts 於載入時解析到內部 id（繁中直比 → jp-name-map → cn-name-map）。
 */

export type CommunityPlatform =
  | "bahamut"
  | "altema"
  | "nga"
  | "bilibili"
  | "youtube"
  | "other";

/** 來源物件（必填）。 */
export type CommunitySource = {
  platform: CommunityPlatform;
  author: string;
  url: string;
  collectedAt: string;
};

/** 一顆裝飾珠引用（選填細節）。name＝繁中／日文／簡中原文。 */
export type CommunityDeco = { name: string; count?: number };

/** 技能引用（名稱＋等級）。 */
export type CommunitySkill = { name: string; level: number };

/** 一件防具（必填五件之一）。decorations／augment 為選填細節。 */
export type CommunityArmorPiece = {
  slot: "head" | "chest" | "arms" | "waist" | "legs";
  name: string;
  decorations?: CommunityDeco[];
  /** 傀異錬成內容原文（專案不模擬）。 */
  augment?: string;
};

/** 武器（選填；泛用防具骨架可不綁武器）。 */
export type CommunityWeapon = {
  name: string;
  slots?: number[];
  decorations?: CommunityDeco[];
  rampageDecorations?: CommunityDeco[];
};

/** 護石（選填）。 */
export type CommunityTalisman = {
  skills?: CommunitySkill[];
  slots?: number[];
  decorations?: CommunityDeco[];
};

/** 一套社群配裝（一檔一套）。 */
export type CommunityBuild = {
  schemaVersion: 2;
  slug: string;
  /** true＝示範／佔位資料，UI 標「示範資料」。 */
  placeholder?: boolean;
  buildName: string;
  /** 選填：泛用防具骨架可無（不綁單一武器種類）。 */
  weaponType?: string;
  /** 恰 5 件。 */
  armor: CommunityArmorPiece[];
  weapon?: CommunityWeapon;
  talisman?: CommunityTalisman;
  /** 目標技能列表（必填，≥1）。匯出到配裝器的核心輸入。 */
  targetSkills: CommunitySkill[];
  gameVersion?: string;
  publishedAt?: string;
  notes?: string;
  source: CommunitySource;
};
