import type { GameId } from "@/types/build";

/**
 * 稀有度顏色 —— 依遊戲給不同色表（rarity.ts 依 gameId 分派，PLAN Phase 5）。
 *
 * Rise：《MH Rise / Sunbreak》遊戲內裝備框/RARE 標籤配色（rarity 1~10；Sunbreak 上限 10）。
 *   色碼取自 Monster Hunter Wiki「Help:Item Colors」MHRise & MHRS 色表。破曉特徵：8 天藍、9 紫、10 橘。
 * World：《MH World / Iceborne》色表（rarity 1~12；Iceborne 上限 12）。
 *   取自同 Wiki 的 MHW 色表，與 Rise 不同（如 8 綠、10~12 為冰紋末期高階色）。
 */
const RISE_RARITY_COLORS: Record<number, string> = {
  1: "#FFFFFF",
  2: "#FFFF8B",
  3: "#FFA0BB",
  4: "#A0E682",
  5: "#31CDFF",
  6: "#6E8CFF",
  7: "#EF5A47",
  8: "#AAEFFF",
  9: "#966EFF",
  10: "#FA9B38",
};

/** MH World/Iceborne 稀有度色（1~12）。來源：MH Wiki Help:Item Colors（MHW）。 */
const WORLD_RARITY_COLORS: Record<number, string> = {
  1: "#C7C7C7",
  2: "#E8E8E8",
  3: "#EFEFB0",
  4: "#B4E7A0",
  5: "#8FD9C0",
  6: "#7FB0E8",
  7: "#B79BE0",
  8: "#E88FA0",
  9: "#F0B060",
  10: "#E7D77A",
  11: "#8FE0D0",
  12: "#C9A0F0",
};

/** 保留原名（Rise 色表）供既有 import 相容。 */
export const RARITY_COLORS = RISE_RARITY_COLORS;

function tableFor(gameId: GameId): Record<number, string> {
  return gameId === "world" ? WORLD_RARITY_COLORS : RISE_RARITY_COLORS;
}

/** 該稀有度的代表色（找不到時給中性灰）。gameId 預設 rise（既有呼叫端行為不變）。 */
export function rarityColor(rarity: number, gameId: GameId = "rise"): string {
  return tableFor(gameId)[rarity] ?? "#8A8A8A";
}

/** 依背景亮度選黑或白字，確保徽章文字可讀。 */
export function rarityTextColor(rarity: number, gameId: GameId = "rise"): string {
  const hex = rarityColor(rarity, gameId);
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const lin = (c: number) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  const luminance = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return luminance > 0.45 ? "#1a1a1a" : "#ffffff";
}
