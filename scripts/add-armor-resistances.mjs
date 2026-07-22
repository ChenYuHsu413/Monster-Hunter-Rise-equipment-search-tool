// @ts-nocheck
/**
 * 補齊防具屬性耐性 — 只抓 Kiranico 防具頁的 5 屬性耐性（火水雷冰龍），
 * 以 id 併回現有 src/data/armors.json 的 elementRes 欄位。其餘欄位與其他資料檔皆不動。
 *
 * 為何獨立於 import-kiranico.mjs：主匯入器會重寫四個 JSON（含 1.6MB weapons.json
 * 與很慢的來源怪抓取），只為補耐性去重跑全流程風險過大。此腳本只做「抓耐性→合併」。
 *
 * 用法：
 *   node scripts/add-armor-resistances.mjs --dry   # 只預覽覆蓋率，不寫檔
 *   node scripts/add-armor-resistances.mjs         # 實際寫回 armors.json
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Phase 1c（多遊戲改造）：Rise 資料已搬至 src/data/rise/。此腳本輸出/讀取一律指向 rise/，
// 避免在已搬空的 src/data/ 重建孤兒檔污染新結構（Rise TU5 已凍結，正常不會重跑）。
const DATA_DIR = path.join(__dirname, "..", "src", "data", "rise");
const BASE = "https://mhrise.kiranico.com/zh-Hant/data";
const UA = { "User-Agent": "Mozilla/5.0 (data import for personal armor builder)" };

/** Kiranico ElementType 編號 → 本專案屬性鍵（與 import-kiranico.mjs 一致）。 */
const ELEMENT = { 1: "fire", 2: "water", 3: "thunder", 4: "ice", 5: "dragon" };

async function fetchText(url, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { headers: UA });
      if (res.ok) return await res.text();
      console.warn(`  ${res.status} ${url} (retry ${i + 1})`);
    } catch (e) {
      console.warn(`  err ${url}: ${e.message} (retry ${i + 1})`);
    }
    await new Promise((r) => setTimeout(r, 800));
  }
  throw new Error(`failed: ${url}`);
}

/** 深度計數切出每個頂層 <tr>（沿用 import-kiranico.mjs 的作法）。 */
function tableRows(html) {
  const tb = html.match(/<tbody[\s\S]*?<\/tbody>/);
  if (!tb) return [];
  const body = tb[0];
  const rows = [];
  const tagRe = /<tr\b[^>]*>|<\/tr>/g;
  let depth = 0;
  let start = -1;
  let m;
  while ((m = tagRe.exec(body))) {
    if (m[0].startsWith("</")) {
      depth--;
      if (depth === 0 && start !== -1) {
        rows.push(body.slice(start, tagRe.lastIndex));
        start = -1;
      }
    } else {
      if (depth === 0) start = m.index;
      depth++;
    }
  }
  return rows;
}

/**
 * 解析單列的 5 屬性耐性。耐性以
 *   <span data-key="element" data-value="N"> … <span data-key="elementAttack" data-value="X">
 * 表示：N 為屬性編號、X 為耐性值（可為負）。以 data-value 對應屬性，不靠出現順序。
 */
function parseRow(row) {
  const idM = row.match(/data\/armors\/(\d+)"/);
  if (!idM) return null;
  const id = `armor_${idM[1]}`;
  const res = { fire: 0, water: 0, thunder: 0, ice: 0, dragon: 0 };
  let found = 0;
  const re =
    /data-key="element" data-value="(\d)"[\s\S]*?data-key="elementAttack" data-value="(-?\d+)"/g;
  let m;
  while ((m = re.exec(row))) {
    const key = ELEMENT[Number(m[1])];
    if (!key) continue;
    res[key] = Number(m[2]);
    found++;
  }
  if (found === 0) return null; // 沒抓到任何屬性欄 → 視為解析失敗，不覆蓋
  return { id, res };
}

async function main() {
  const dry = process.argv.includes("--dry");
  const armorsPath = path.join(DATA_DIR, "armors.json");
  const armors = JSON.parse(fs.readFileSync(armorsPath, "utf8"));

  console.log("→ 抓取防具耐性（RARE 1-10）");
  const resById = new Map();
  for (let view = 0; view <= 9; view++) {
    const html = await fetchText(`${BASE}/armors?view=${view}`);
    let n = 0;
    for (const row of tableRows(html)) {
      const parsed = parseRow(row);
      if (parsed) {
        resById.set(parsed.id, parsed.res);
        n++;
      }
    }
    console.log(`  RARE${view + 1}: ${n} 件有耐性`);
  }
  console.log(`  抓到 ${resById.size} 件的耐性`);

  // 合併：把 elementRes 插在 defense 之後（維持既有欄位順序，只新增一欄）。
  let matched = 0;
  const missing = [];
  const merged = armors.map((a) => {
    const res = resById.get(a.id);
    if (!res) {
      missing.push(a.id);
      return a;
    }
    matched++;
    const out = {};
    for (const [k, v] of Object.entries(a)) {
      out[k] = v;
      if (k === "defense") out.elementRes = res; // defense 後緊接 elementRes
    }
    if (!("elementRes" in out)) out.elementRes = res; // 沒有 defense 欄時補在尾端
    return out;
  });

  console.log(
    `  比對：${matched}/${armors.length} 件成功併入 elementRes，${missing.length} 件無對應`
  );
  if (missing.length) {
    console.log(`  無對應 id（前 20）：${missing.slice(0, 20).join(", ")}`);
  }
  // 抽樣顯示（含有非零耐性的例子）
  const sample = merged.find(
    (a) => a.elementRes && Object.values(a.elementRes).some((v) => v !== 0)
  );
  if (sample)
    console.log(
      `  抽樣：${sample.nameZh} → ${JSON.stringify(sample.elementRes)}`
    );

  if (dry) {
    console.log("（--dry：未寫檔）");
    return;
  }
  fs.writeFileSync(armorsPath, JSON.stringify(merged, null, 2) + "\n");
  console.log("✓ 已更新 src/data/armors.json（新增 elementRes）");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
