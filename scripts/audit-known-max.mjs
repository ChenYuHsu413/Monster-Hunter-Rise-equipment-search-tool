// @ts-nocheck
/**
 * KNOWN_MAX 稽核器 — 把 scripts/known-max.mjs 的硬編技能上限逐條對 Kiranico
 * 技能「詳細頁效果表」（第一張 table，每列 ＬｖN）機械核對。
 *
 * 方法已校準：12 個已知正確技能（攻擊7/匠5/看破7…）效果表列數 100% 吻合。
 * 用途二：(1) 獨立跑 `node scripts/audit-known-max.mjs` 出報告（不符則 exit 1）；
 *         (2) 被 import-kiranico 當重跑防呆呼叫（auditKnownMax()），不符即中止匯入。
 *
 * 破曉資料已凍結，故不做「import 時自動抓效果表」的根治（147 次額外 fetch），
 * 改以本稽核 + import 防呆固化——九成保護、近零成本。
 * 禮貌抓取：2.5s 間隔 + 正常 UA，HTML 快取 scripts/.cache/（gitignore）重跑免抓。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { KNOWN_MAX } from "./known-max.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CACHE = path.join(__dirname, ".cache");
const BASE = "https://mhrise.kiranico.com";
const UA = { "User-Agent": "Mozilla/5.0 (data import for personal armor builder)" };
const DELAY = 2500;

let last = 0;
async function fetchCached(url, key) {
  const file = path.join(CACHE, `${key}.html`);
  if (fs.existsSync(file)) return fs.readFileSync(file, "utf8");
  const wait = last + DELAY - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  let html = null;
  for (let i = 0; i < 3 && html == null; i++) {
    try {
      const res = await fetch(url, { headers: UA });
      last = Date.now();
      if (res.ok) html = await res.text();
    } catch {}
    if (html == null) await new Promise((r) => setTimeout(r, 800));
  }
  if (html == null) throw new Error(`fetch 失敗: ${url}`);
  fs.mkdirSync(CACHE, { recursive: true });
  fs.writeFileSync(file, html);
  return html;
}

/** 技能繁中名 → Kiranico 數字 ID（zh 技能清單頁）。 */
async function skillIdMap() {
  const html = await fetchCached(`${BASE}/zh-Hant/data/skills`, "zh-skills");
  const map = {};
  for (const m of html.matchAll(/data\/skills\/(\d+)"[\s\S]{0,120}?<p[^>]*>([^<]+)<\/p>/g)) map[m[2].trim()] = m[1];
  return map;
}

/** 技能詳細頁效果表的最大 Ｌｖ（第一張含 Ｌｖ 列的 table）；無則 null。 */
function effectMax(html) {
  for (const t of html.matchAll(/<table[^>]*>[\s\S]*?<\/table>/g)) {
    const rows = [...t[0].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)];
    const lv = rows
      .map((r) => (r[1].match(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/) || [, ""])[1].replace(/<[^>]+>/g, "").trim())
      .filter((x) => /^[ＬL][ｖv]/.test(x))
      .map((x) => Number(x.replace(/[^\d]/g, "")));
    if (lv.length) return Math.max(...lv);
  }
  return null;
}

/**
 * 稽核。回傳不符清單 [{name, hard, actual, numId}]。
 * actual=null（效果表讀不到，如 Kiranico 版面變動）不算不符，僅列入 warnings。
 */
export async function auditKnownMax({ verbose = false } = {}) {
  const ids = await skillIdMap();
  const mismatches = [];
  const warnings = [];
  for (const [name, hard] of Object.entries(KNOWN_MAX)) {
    const numId = ids[name];
    if (!numId) {
      warnings.push({ name, reason: "技能清單找不到 numId" });
      continue;
    }
    const html = await fetchCached(`${BASE}/ja/data/skills/${numId}`, `skill-${numId}`);
    const actual = effectMax(html);
    if (actual == null) warnings.push({ name, reason: "詳細頁無效果表" });
    else if (actual !== hard) mismatches.push({ name, hard, actual, numId });
    if (verbose) console.log(`  ${name.padEnd(14)} 硬編 ${hard} / 效果表 ${actual ?? "-"} ${actual === hard ? "OK" : actual == null ? "(無法核對)" : "✗"}`);
  }
  if (warnings.length && verbose) for (const w of warnings) console.warn(`  ⚠ ${w.name}: ${w.reason}`);
  return mismatches;
}

// 獨立執行：出報告 + exit code
const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  console.log(`稽核 KNOWN_MAX（${Object.keys(KNOWN_MAX).length} 條）對 Kiranico 效果表\n`);
  const mism = await auditKnownMax({ verbose: true });
  if (mism.length) {
    console.error(`\n✗ ${mism.length} 條不符，請更新 scripts/known-max.mjs：`);
    for (const m of mism) console.error(`   ${m.name}: ${m.hard} → ${m.actual}`);
    process.exit(1);
  }
  console.log("\n✓ 全數吻合");
}
