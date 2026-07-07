// @ts-nocheck
/**
 * 解放條件資料驗證 — 檢查 src/data/unlocks.json 與裝備資料的一致性，
 * 並輸出覆蓋率報告。import-unlocks.mjs 重跑後執行此腳本確認資料健康。
 *
 * 檢查項目：
 * 1. 引用完整性：每件裝備都有解放條目；每個條目的 id 都存在於裝備資料
 * 2. 條目有效性：至少有一個里程碑軸（v/h/m/mr），信心度為合法值
 * 3. 合理性：inferred 條目的里程碑軸不得與 rankLabel 矛盾
 *    （村裝備須有 v 或 h、HR 裝備須有 h≥4、MR 裝備須有 m 或 mr）
 * 4. 覆蓋率報告：信心度 × rankLabel 分布
 *
 * 用法：node scripts/validate-unlocks.mjs（有錯誤時 exit 1）
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "src", "data");

const unlocks = JSON.parse(fs.readFileSync(path.join(DATA_DIR, "unlocks.json"), "utf8"));
const armors = JSON.parse(fs.readFileSync(path.join(DATA_DIR, "armors.json"), "utf8"));
const weapons = JSON.parse(fs.readFileSync(path.join(DATA_DIR, "weapons.json"), "utf8"));

const items = [...armors, ...weapons];
const itemIds = new Set(items.map((x) => x.id));
const errors = [];

// 1. 引用完整性
for (const x of items) {
  if (!unlocks.entries[x.id]) errors.push(`缺少解放條目：${x.id}（${x.nameZh}）`);
}
for (const id of Object.keys(unlocks.entries)) {
  if (!itemIds.has(id)) errors.push(`孤兒條目（裝備資料中不存在）：${id}`);
}

// 2. 條目有效性
const CONFIDENCE = new Set(["confirmed", "inferred", "unverified"]);
for (const [id, e] of Object.entries(unlocks.entries)) {
  if (e.v == null && e.h == null && e.m == null && e.mr == null) {
    errors.push(`條目無任何里程碑軸：${id}`);
  }
  if (!CONFIDENCE.has(e.c)) errors.push(`非法信心度「${e.c}」：${id}`);
  if (e.v != null && (e.v < 1 || e.v > 6)) errors.push(`村★超界（${e.v}）：${id}`);
  if (e.h != null && (e.h < 1 || e.h > 8)) errors.push(`集會所★超界（${e.h}）：${id}`);
  if (e.m != null && (e.m < 1 || e.m > 6)) errors.push(`Master★超界（${e.m}）：${id}`);
  if (e.mr != null && e.mr < 10) errors.push(`MR 門檻異常（${e.mr}）：${id}`);
}

// 3. 合理性（僅 inferred；unverified 本來就是近似，confirmed 是常數表）
for (const x of items) {
  const e = unlocks.entries[x.id];
  if (!e || e.c !== "inferred") continue;
  if (x.rankLabel === "村" && e.v == null && e.h == null)
    errors.push(`村裝備缺 v/h：${x.id}（${x.nameZh}）`);
  if (x.rankLabel === "HR" && (e.h == null || e.h < 4))
    errors.push(`HR 裝備 h 軸異常：${x.id}（${x.nameZh}）→ ${JSON.stringify(e)}`);
  if (x.rankLabel === "MR" && e.m == null && e.mr == null)
    errors.push(`MR 裝備缺 m/mr：${x.id}（${x.nameZh}）`);
}

// 4. 覆蓋率報告
const dist = {};
for (const x of items) {
  const e = unlocks.entries[x.id];
  if (!e) continue;
  const k = `${x.rankLabel ?? "?"}/${e.c}`;
  dist[k] = (dist[k] ?? 0) + 1;
}
const byConf = { confirmed: 0, inferred: 0, unverified: 0 };
for (const e of Object.values(unlocks.entries)) byConf[e.c] = (byConf[e.c] ?? 0) + 1;
const total = items.length;
const pct = (n) => `${((100 * n) / total).toFixed(1)}%`;

console.log(`裝備 ${total} 件（防具 ${armors.length}／武器 ${weapons.length}）`);
console.log(`信心度：confirmed ${byConf.confirmed}（${pct(byConf.confirmed)}）、` +
  `inferred ${byConf.inferred}（${pct(byConf.inferred)}）、unverified ${byConf.unverified}（${pct(byConf.unverified)}）`);
console.log("信心度 × rank 分布：");
for (const k of Object.keys(dist).sort()) console.log(`  ${k}: ${dist[k]}`);

if (errors.length) {
  console.error(`\n✗ ${errors.length} 個錯誤：`);
  for (const e of errors.slice(0, 30)) console.error("  " + e);
  if (errors.length > 30) console.error(`  …其餘 ${errors.length - 30} 筆省略`);
  process.exit(1);
}
console.log("\n✓ 驗證通過");
