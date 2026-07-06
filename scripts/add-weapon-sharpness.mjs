// @ts-nocheck
/**
 * 補齊武器斬味 — Kiranico 只在「個別武器詳細頁」以 SVG 色塊呈現斬味，
 * 故逐把抓詳細頁解析，將 sharpness 併回 src/data/weapons.json。其他資料檔不動。
 *
 * 斬味色塊：<rect ... width="W" fill="#RRGGBB" x="X">。x 歸零代表新的一條，
 * 第一條為基礎（匠0），最後一條為最大匠。以顏色對應 7 段：紅橙黃綠藍白紫。
 *
 * 因需抓 ~3953 頁，採並發 + 檢查點快取（可中斷續跑）。
 *
 * 用法：
 *   node scripts/add-weapon-sharpness.mjs --limit 20 --dry   # 小量測試、不寫 weapons.json
 *   node scripts/add-weapon-sharpness.mjs                    # 全量、寫回
 * 快取檔置於系統暫存目錄（可重跑；刪除即重新抓取）。
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "src", "data");
const BASE = "https://mhrise.kiranico.com/zh-Hant/data";
const UA = { "User-Agent": "Mozilla/5.0 (data import for personal armor builder)" };
const CACHE = path.join(os.tmpdir(), "mhsb-sharpness-cache.json");
const CONCURRENCY = 6;
const CHECKPOINT_EVERY = 100;

/** 顏色 → 段索引（紅0 橙1 黃2 綠3 藍4 白5 紫6）。 */
const COLOR_INDEX = {
  "#BE3843": 0,
  "#D3673D": 1,
  "#C9B232": 2,
  "#81B034": 3,
  "#3A58D7": 4,
  "#E2E2E2": 5,
  "#885AEC": 6,
};

async function fetchText(url, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { headers: UA });
      if (res.ok) return await res.text();
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 600 * (i + 1)));
  }
  return null;
}

/** 解析詳細頁的斬味：回傳 { base:[7], max:[7] }，弩槍等無斬味回 null。 */
function parseSharpness(html) {
  const rects = [
    ...html.matchAll(
      /<rect height="8" width="(\d+)" fill="(#[0-9A-F]+)" x="(\d+)"/g
    ),
  ]
    .map((m) => ({ w: +m[1], ci: COLOR_INDEX[m[2]], x: +m[3] }))
    .filter((r) => r.ci != null);
  if (rects.length === 0) return null;

  const bars = [];
  let cur = null;
  for (const r of rects) {
    if (r.x === 0) {
      cur = [0, 0, 0, 0, 0, 0, 0];
      bars.push(cur);
    }
    if (cur) cur[r.ci] += r.w;
  }
  if (bars.length === 0) return null;
  return { base: bars[0], max: bars[bars.length - 1] };
}

function loadCache() {
  try {
    return JSON.parse(fs.readFileSync(CACHE, "utf8"));
  } catch {
    return {};
  }
}
function saveCache(cache) {
  fs.writeFileSync(CACHE, JSON.stringify(cache));
}

/** 簡單並發池。 */
async function runPool(items, worker, concurrency) {
  let idx = 0;
  async function next() {
    while (idx < items.length) {
      const i = idx++;
      await worker(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, next));
}

async function main() {
  const dry = process.argv.includes("--dry");
  const limArg = process.argv.indexOf("--limit");
  const limit = limArg >= 0 ? Number(process.argv[limArg + 1]) : Infinity;

  const weaponsPath = path.join(DATA_DIR, "weapons.json");
  const weapons = JSON.parse(fs.readFileSync(weaponsPath, "utf8"));

  const cache = loadCache();
  // 待抓：尚未在快取中的武器（value 可為 null 代表已確認無斬味）
  const todo = weapons
    .filter((w) => !(w.id in cache))
    .slice(0, limit === Infinity ? undefined : limit);
  console.log(
    `武器 ${weapons.length}，快取已有 ${Object.keys(cache).length}，本次待抓 ${todo.length}（並發 ${CONCURRENCY}）`
  );

  let done = 0;
  let failed = 0;
  await runPool(
    todo,
    async (w) => {
      const num = w.id.replace("weapon_", "");
      const html = await fetchText(`${BASE}/weapons/${num}`);
      if (html == null) {
        failed++;
        cache[w.id] = null; // 抓不到，記 null 避免卡住（可事後刪快取重試）
      } else {
        cache[w.id] = parseSharpness(html); // 可能為 null（無斬味武器）
      }
      done++;
      if (done % CHECKPOINT_EVERY === 0) {
        saveCache(cache);
        console.log(`  進度 ${done}/${todo.length}（失敗 ${failed}）`);
      }
    },
    CONCURRENCY
  );
  saveCache(cache);
  console.log(`抓取完成：成功處理 ${done}，失敗 ${failed}`);

  // 合併：sharpness 插在 affinity 之後；null（無斬味）不加欄位。
  let withSharp = 0;
  const merged = weapons.map((w) => {
    const s = cache[w.id];
    if (!s) return w;
    withSharp++;
    const out = {};
    for (const [k, v] of Object.entries(w)) {
      out[k] = v;
      if (k === "affinity") out.sharpness = s;
    }
    if (!("sharpness" in out)) out.sharpness = s;
    return out;
  });
  console.log(`  ${withSharp}/${weapons.length} 把有斬味資料`);
  const sample = merged.find((w) => w.sharpness);
  if (sample)
    console.log(
      `  抽樣：${sample.nameZh} → base ${JSON.stringify(sample.sharpness.base)} / max ${JSON.stringify(sample.sharpness.max)}`
    );

  if (dry) {
    console.log("（--dry：未寫 weapons.json）");
    return;
  }
  // 一把武器一行（compact）：避免斬味等陣列被 indent 垂直爆炸撐大檔案。
  fs.writeFileSync(
    weaponsPath,
    "[\n" + merged.map((w) => JSON.stringify(w)).join(",\n") + "\n]\n"
  );
  console.log("✓ 已更新 src/data/weapons.json（新增 sharpness，compact 格式）");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
