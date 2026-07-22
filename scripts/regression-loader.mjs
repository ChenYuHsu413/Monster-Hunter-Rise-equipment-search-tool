/**
 * 回歸基準專用 ESM loader（僅測試用，不進 app runtime）。
 *
 * 讓 Node 能直接載入 app 的 TypeScript 原始碼跑 searchBuilds：
 *  1. 解析 tsconfig 的 `@/*` → `src/*` path alias。
 *  2. 解析無副檔名的相對 import（Node ESM 預設要求副檔名，TS 不用）。
 *  3. 攔截 `.json` import：包成 `export default <json>` 模組
 *     （Node ESM 預設需 import attributes，app 原始碼沒帶）。
 * `.ts` 檔的型別剝除交給 Node 24 內建（nextLoad），本 loader 不碰。
 */
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(REPO_ROOT, "src");

const EXT_CANDIDATES = ["", ".ts", ".tsx", ".mts", ".mjs", ".js", ".json"];
const INDEX_CANDIDATES = ["/index.ts", "/index.tsx", "/index.mjs", "/index.js"];

function resolveFile(target) {
  // 已有副檔名且存在 → 直接用
  if (path.extname(target) && existsSync(target)) return target;
  for (const ext of EXT_CANDIDATES) {
    const cand = target + ext;
    if (existsSync(cand)) return cand;
  }
  for (const idx of INDEX_CANDIDATES) {
    const cand = target + idx;
    if (existsSync(cand)) return cand;
  }
  return null;
}

export function resolve(specifier, context, nextResolve) {
  let target = null;
  if (specifier.startsWith("@/")) {
    target = path.join(SRC, specifier.slice(2));
  } else if (
    (specifier.startsWith("./") || specifier.startsWith("../")) &&
    context.parentURL &&
    context.parentURL.startsWith("file:")
  ) {
    target = path.resolve(path.dirname(fileURLToPath(context.parentURL)), specifier);
  }
  if (target) {
    const found = resolveFile(target);
    if (found) {
      return { url: pathToFileURL(found).href, shortCircuit: true };
    }
  }
  return nextResolve(specifier, context);
}

export function load(url, context, nextLoad) {
  if (url.endsWith(".json") && url.startsWith("file:")) {
    const text = readFileSync(fileURLToPath(url), "utf8");
    return {
      format: "module",
      source: "export default " + text,
      shortCircuit: true,
    };
  }
  return nextLoad(url, context);
}
