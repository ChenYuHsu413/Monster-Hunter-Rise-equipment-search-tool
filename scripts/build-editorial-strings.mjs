/**
 * 產生 data/editorial-strings.json：Game8 編輯用「短標記」的待人工翻譯清單。
 *
 * 來源＝data/recommended-builds.json 的 buildName / stageName / weapons[].noteRaw。
 * 這些是 Game8 自訂的欄位標記／時期標註（非遊戲官方名詞——官方名詞走 Kiranico 繁中 +
 * jp-name-map，不進此檔）。
 *
 * 分類（與 src/lib/recommended-builds.ts 的 isEditorialSentence 必須同步）：
 *   成句解說＝含「。」或「、」或 ≥22 字（Game8 編輯評述）→ 顯示端「不翻譯也不顯示」直接
 *     排除，故不進候選清單（翻譯人家整段編輯內容＝越過「不爬說明段落」紅線）。
 *   短標記＝其餘（無句讀點且 <22 字，如「火属性の最終派生武器」）→ 進候選清單待人工。
 *
 * 產出格式：{ "$meta": {...}, "原文短標記": null, ... }。值一律 null（本腳本只建清單、
 * 不填譯文）；出現次數與來源欄位、排除的成句統計放 "$meta"。人工把確認的譯文填進
 * data/editorial-translations.json（勿手改本檔——重跑會沖掉）。
 *
 * 用法：node scripts/build-editorial-strings.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const BUILDS_FILE = path.join(ROOT, "data", "recommended-builds.json");
const OUT_FILE = path.join(ROOT, "data", "editorial-strings.json");

/** 成句判定：含。或、或 ≥22 字。★與 recommended-builds.ts isEditorialSentence 同步。 */
function isEditorialSentence(raw) {
  return /[。、]/.test(raw) || raw.length >= 22;
}

const builds = JSON.parse(fs.readFileSync(BUILDS_FILE, "utf8")).builds;

// 短標記 → { count, fields:Set }；成句只計 distinct 統計（不進清單）。
const markers = new Map();
const sentences = new Set();

function consider(raw, field) {
  if (typeof raw !== "string") return;
  const s = raw.trim();
  if (!s) return;
  if (isEditorialSentence(s)) {
    sentences.add(s);
    return;
  }
  const cur = markers.get(s) ?? { count: 0, fields: new Set() };
  cur.count += 1;
  cur.fields.add(field);
  markers.set(s, cur);
}

for (const b of builds) {
  consider(b.buildName, "buildName");
  consider(b.stageName, "stageName");
  for (const w of b.weapons ?? []) consider(w.noteRaw, "noteRaw");
}

// count 由多到少，同數依原文排序，穩定輸出。
const sorted = [...markers.entries()].sort(
  (a, b) => b[1].count - a[1].count || a[0].localeCompare(b[0])
);

const counts = {};
const fieldsOf = {};
const out = {};
for (const [name, info] of sorted) {
  out[name] = null;
  counts[name] = info.count;
  fieldsOf[name] = [...info.fields].sort();
}

const result = {
  $meta: {
    note: "Game8 編輯短標記待人工翻譯清單（自動產出，勿手改——重跑會沖掉）。把確認的譯文填進 data/editorial-translations.json。成句解說已排除（顯示端不翻譯也不顯示）。",
    generatedFrom: "data/recommended-builds.json",
    markerCount: sorted.length,
    excludedSentenceCount: sentences.size,
    counts,
    fields: fieldsOf,
  },
  ...out,
};

fs.writeFileSync(OUT_FILE, JSON.stringify(result, null, 2) + "\n");
console.log(
  `✓ data/editorial-strings.json：${sorted.length} 短標記待人工，排除 ${sentences.size} 成句`
);
