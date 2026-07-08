/**
 * 日文名稱正規化（scrape-game8.js 查表與 build-jp-name-map.js 建表共用，
 * 必須同一套規則，否則正規化後的鍵對不上）。
 *
 * 目的：吸收 Game8 與 Kiranico 之間的「格式差異」——全形/半形、羅馬數字
 * （Ⅰ/Ⅱ vs I/II）、空白、latin 大小寫——讓精確比對只在「真正的名稱差異」
 * （Game8 暱稱簡稱）時才失敗。
 *
 * NFKC 已處理大部分：全形英數→半形、羅馬數字 Ⅰ(U+2160)→"I"、Ⅱ→"II"…、
 * 半形片假名→全形。再補：去所有空白、latin 轉大寫（of/OF 對齊）、異體字歸一。
 * 保留 ・ 【】（NFKC 不動 CJK 標點，兩站寫法一致）。
 */
// 異體字歸一表：NFKC 不合併的 CJK 異體字，逐案加入（Game8 與 Kiranico/專案用字不一）。
// 盤/磐：顕如盤石 的珠——Kiranico ja/Game8 用「盤」，專案繁中用「磐」。
const VARIANTS = { "盤": "磐" };
const VARIANTS_RE = new RegExp(`[${Object.keys(VARIANTS).join("")}]`, "g");

function normalizeJa(s) {
  return (s || "")
    .normalize("NFKC")
    .replace(/\s+/g, "")
    .replace(VARIANTS_RE, (c) => VARIANTS[c])
    .toUpperCase();
}

module.exports = { normalizeJa };
