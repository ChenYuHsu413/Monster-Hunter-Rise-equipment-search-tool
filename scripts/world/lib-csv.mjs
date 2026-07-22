/**
 * World 匯入管線共用工具：CSV 解析 + 快取讀取 + 小工具。
 * 純函式，無副作用（除 readCache 讀檔）。
 */
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const CACHE_MHWD = path.join(HERE, ".cache", "mhwd");

/** RFC4180-ish CSV 解析（處理引號內逗號、跳脫雙引號、CRLF）。 */
export function parseCSV(txt) {
  const rows = [];
  let i = 0,
    f = "",
    row = [],
    q = false;
  for (; i < txt.length; i++) {
    const c = txt[i];
    if (q) {
      if (c === '"') {
        if (txt[i + 1] === '"') {
          f += '"';
          i++;
        } else q = false;
      } else f += c;
    } else {
      if (c === '"') q = true;
      else if (c === ",") {
        row.push(f);
        f = "";
      } else if (c === "\n") {
        row.push(f);
        rows.push(row);
        row = [];
        f = "";
      } else if (c === "\r") {
        /* skip */
      } else f += c;
    }
  }
  if (f.length || row.length) {
    row.push(f);
    rows.push(row);
  }
  return rows;
}

/** 讀快取 CSV（rel 用 '/' 分隔，對映 fetch-mhwd 的 '__' 命名）→ 物件陣列。 */
export function loadMhwd(rel) {
  const file = path.join(CACHE_MHWD, rel.replace(/\//g, "__"));
  if (!existsSync(file)) {
    throw new Error(
      `快取缺檔：${rel}（先跑 node scripts/world/fetch-mhwd.mjs）`
    );
  }
  const rows = parseCSV(readFileSync(file, "utf8"));
  const h = rows[0];
  return rows
    .slice(1)
    .filter((r) => r.length > 1)
    .map((r) => Object.fromEntries(h.map((k, idx) => [k, r[idx]])));
}

/** 讀 CSV 表頭（不轉物件）。 */
export function headerOf(rel) {
  const file = path.join(CACHE_MHWD, rel.replace(/\//g, "__"));
  return parseCSV(readFileSync(file, "utf8"))[0];
}

/** 空/未定義判定。 */
export const isBlank = (v) => v == null || String(v).trim() === "";
