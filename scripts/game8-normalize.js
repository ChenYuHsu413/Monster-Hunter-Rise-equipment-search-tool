/**
 * 日文名稱正規化（scrape-game8.js 查表與 build-jp-name-map.js 建表共用，
 * 必須同一套規則，否則正規化後的鍵對不上）。
 *
 * 目的：吸收 Game8 與 Kiranico 之間的「格式差異」——全形/半形、羅馬數字
 * （Ⅰ/Ⅱ vs I/II）、空白、latin 大小寫——讓精確比對只在「真正的名稱差異」
 * （Game8 暱稱簡稱）時才失敗。
 *
 * NFKC 已處理大部分：全形英數→半形、羅馬數字 Ⅰ(U+2160)→"I"、Ⅱ→"II"…、
 * 半形片假名→全形。再補：去所有空白、latin 轉大寫（of/OF 對齊）。
 * 保留 ・ 【】（NFKC 不動 CJK 標點，兩站寫法一致）。
 */
function normalizeJa(s) {
  return (s || "")
    .normalize("NFKC")
    .replace(/\s+/g, "")
    .toUpperCase();
}

module.exports = { normalizeJa };
