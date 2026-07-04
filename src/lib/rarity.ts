/**
 * 稀有度顏色 —— 使用《MH Rise / Sunbreak》遊戲內裝備框/RARE 標籤配色（rarity 1~10；Sunbreak 上限 10）。
 * 色碼取自 Monster Hunter Wiki「Help:Item Colors」的 MHRise & MHRS 色表（與 MH World 不同）。
 * 破曉特徵：RARE 8 天藍、9 紫、10 橘。
 */
export const RARITY_COLORS: Record<number, string> = {
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

/** 該稀有度的代表色（找不到時給中性灰）。 */
export function rarityColor(rarity: number): string {
  return RARITY_COLORS[rarity] ?? "#8A8A8A";
}

/** 依背景亮度選黑或白字，確保徽章文字可讀。 */
export function rarityTextColor(rarity: number): string {
  const hex = rarityColor(rarity);
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const lin = (c: number) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  const luminance = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return luminance > 0.45 ? "#1a1a1a" : "#ffffff";
}
