#!/usr/bin/env node
/**
 * 日文名稱對照表產生器 — 為 Game8 推薦配裝（scrape-game8.js）建立
 * 「日文名 → 專案內部 ID」對照，供顯示端一律透過內部 ID 查現有繁中資料。
 *
 * 原理：專案內部 ID（weapon_/armor_/deco_ 的數字段）就是 Kiranico 的數字 ID，
 * 跨語言一致。故抓 Kiranico **日文版**列表頁取（數字ID, 日文名），組出
 * 日文名→內部ID；技能因內部 ID 就是繁中名（無數字 ID），改抓 ja+zh 兩版
 * 以數字 ID join（ja名→zh名）。只輸出「內部 ID 確實存在於專案資料」的條目。
 *
 * 比對哲學（依使用者指示）：
 * 1. 先正規化（NFKC + 去空白 + 大寫，見 game8-normalize.js）再精確比對，
 *    吸收全形/半形、羅馬數字 Ⅰ/Ⅱ vs I/II 等格式差異。
 * 2. 精確比對失敗者「不自動猜」——輸出建議檔（每筆附編輯距離最近的 2-3 個
 *    Kiranico 候選名＋其內部 ID）供人工勾選，不默默採用最相近者。
 *
 * 產出：data/jp-name-map.json（人工可增補）、data/jp-name-map.suggestions.json。
 * 禮貌抓取：2.5s 間隔＋正常 UA，列表頁 HTML 快取到 scripts/.cache/（gitignore）。
 * 用法：node scripts/build-jp-name-map.js [--refresh]
 */
const fs = require("node:fs");
const path = require("node:path");
const { normalizeJa } = require("./game8-normalize.js");

const ROOT = path.join(__dirname, "..");
const SRC = path.join(ROOT, "src", "data");
const CACHE = path.join(__dirname, ".cache");
const MAP_FILE = path.join(ROOT, "data", "jp-name-map.json");
const SUGGEST_FILE = path.join(ROOT, "data", "jp-name-map.suggestions.json");
const BUILDS_FILE = path.join(ROOT, "data", "recommended-builds.json");

const HOST = "https://mhrise.kiranico.com";
const UA = { "User-Agent": "Mozilla/5.0 (data import for personal armor builder)" };
const DELAY = 2500;
const REFRESH = process.argv.includes("--refresh");

// ---------- 禮貌抓取（快取） ----------
let last = 0;
async function fetchCached(url, key) {
  const file = path.join(CACHE, `${key}.html`);
  if (!REFRESH && fs.existsSync(file)) return fs.readFileSync(file, "utf8");
  const wait = last + DELAY - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  console.log(`  ↓ ${url}`);
  let html = null;
  for (let i = 0; i < 3 && html == null; i++) {
    try {
      const res = await fetch(url, { headers: UA });
      last = Date.now();
      if (res.ok) html = await res.text();
      else console.warn(`  ${res.status} ${url} (retry ${i + 1})`);
    } catch (e) {
      console.warn(`  err ${e.message} (retry ${i + 1})`);
    }
    if (html == null) await new Promise((r) => setTimeout(r, 800));
  }
  if (html == null) throw new Error(`failed: ${url}`);
  fs.mkdirSync(CACHE, { recursive: true });
  fs.writeFileSync(file, html);
  return html;
}

/** 列表頁 → [{numId, name}]。skills 名稱在巢狀 <p>，其餘在 anchor 文字。 */
function parseList(html, kind) {
  const out = [];
  if (kind === "skills") {
    for (const m of html.matchAll(/data\/skills\/(\d+)"[\s\S]{0,120}?<p[^>]*>([^<]+)<\/p>/g)) {
      out.push({ numId: m[1], name: m[2].trim() });
    }
  } else {
    const re = new RegExp(`data/${kind}/(\\d+)">([^<]+)</a>`, "g");
    for (const m of html.matchAll(re)) out.push({ numId: m[1], name: m[2].trim() });
  }
  return out;
}

// ---------- 專案內部 ID / 名稱集合 ----------
const projWeapons = new Set(JSON.parse(fs.readFileSync(path.join(SRC, "weapons.json"), "utf8")).map((x) => x.id));
const projArmors = new Set(JSON.parse(fs.readFileSync(path.join(SRC, "armors.json"), "utf8")).map((x) => x.id));
const projDecos = new Set(JSON.parse(fs.readFileSync(path.join(SRC, "decorations.json"), "utf8")).map((x) => x.id));
const projSkills = new Set(JSON.parse(fs.readFileSync(path.join(SRC, "skills.json"), "utf8")).map((x) => x.name));

// ---------- 編輯距離（建議檔用） ----------
function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  if (Math.abs(m - n) > 8) return Math.abs(m - n) + Math.min(m, n); // 早剪枝
  const dp = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j];
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return dp[n];
}

async function main() {
  // ---- 抓列表、組對照 ----
  const map = { skills: {}, armors: {}, decorations: {}, weapons: {} };
  const pool = { skills: [], armors: [], decorations: [], weapons: [] }; // {name, norm, id}
  const collisions = [];

  // 命名衝突（同名→不同 ID）幾乎全為防具性別雙胞胎（男/女版同名同技能同數值，
  // 僅外觀不同）。以列表順序 first-wins 取一件即可（功能等價），衝突記錄供稽核。
  const add = (type, name, id) => {
    const norm = normalizeJa(name);
    if (map[type][norm] != null && map[type][norm] !== id) {
      collisions.push({ type, norm, name, existing: map[type][norm], incoming: id });
      return;
    }
    map[type][norm] = id;
    pool[type].push({ name, norm, id });
  };

  console.log("→ Kiranico ja 武器（14 類）");
  for (let v = 0; v <= 13; v++) {
    const html = await fetchCached(`${HOST}/ja/data/weapons?view=${v}`, `ja-weapons-${v}`);
    for (const { numId, name } of parseList(html, "weapons")) {
      const id = `weapon_${numId}`;
      if (projWeapons.has(id)) add("weapons", name, id);
    }
  }
  console.log("→ Kiranico ja 防具（RARE 1-10）");
  for (let v = 0; v <= 9; v++) {
    const html = await fetchCached(`${HOST}/ja/data/armors?view=${v}`, `ja-armors-${v}`);
    for (const { numId, name } of parseList(html, "armors")) {
      const id = `armor_${numId}`;
      if (projArmors.has(id)) add("armors", name, id);
    }
  }
  console.log("→ Kiranico ja 裝飾珠");
  {
    const html = await fetchCached(`${HOST}/ja/data/decorations`, "ja-decorations");
    for (const { numId, name } of parseList(html, "decorations")) {
      const id = `deco_${numId}`;
      if (projDecos.has(id)) add("decorations", name, id);
    }
  }
  console.log("→ Kiranico ja+zh 技能（以數字 ID join）");
  {
    const jaHtml = await fetchCached(`${HOST}/ja/data/skills`, "ja-skills");
    const zhHtml = await fetchCached(`${HOST}/zh-Hant/data/skills`, "zh-skills");
    const zhById = {};
    for (const { numId, name } of parseList(zhHtml, "skills")) zhById[numId] = name;
    for (const { numId, name } of parseList(jaHtml, "skills")) {
      const zh = zhById[numId];
      if (zh && projSkills.has(zh)) add("skills", name, zh);
    }
  }

  const counts = Object.fromEntries(Object.entries(map).map(([k, v]) => [k, Object.keys(v).length]));
  console.log(`  對照條目：${JSON.stringify(counts)}；命名衝突 ${collisions.length}（防具性別雙胞胎，first-wins 取一件）`);

  // ---- 寫對照表（保留既有人工增補：既存檔的鍵若不在自動結果中則保留）----
  let existing = {};
  try {
    existing = JSON.parse(fs.readFileSync(MAP_FILE, "utf8"));
  } catch {}
  const manualKept = { skills: 0, armors: 0, decorations: 0, weapons: 0 };
  for (const type of Object.keys(map)) {
    for (const [k, v] of Object.entries(existing[type] ?? {})) {
      if (map[type][k] == null) {
        map[type][k] = v; // 人工增補的鍵（自動抓不到者）保留
        manualKept[type]++;
      }
    }
  }
  const keptTotal = Object.values(manualKept).reduce((a, b) => a + b, 0);
  fs.writeFileSync(MAP_FILE, JSON.stringify(map, null, 1) + "\n");
  console.log(`✓ data/jp-name-map.json（保留人工增補 ${keptTotal} 筆）`);

  // ---- 建議檔：對 recommended-builds.json 仍比不到者，附最近候選 ----
  let builds;
  try {
    builds = JSON.parse(fs.readFileSync(BUILDS_FILE, "utf8"));
  } catch {
    console.log("（尚無 recommended-builds.json，略過建議檔）");
    return;
  }
  const still = builds.unresolved.filter((u) => map[u.type]?.[normalizeJa(u.rawNameJa)] == null);
  const suggestions = still.map((u) => {
    const norm = normalizeJa(u.rawNameJa);
    const ranked = pool[u.type]
      .map((c) => ({ name: c.name, id: c.id, distance: levenshtein(norm, c.norm) }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 3);
    return {
      type: u.type,
      rawNameJa: u.rawNameJa,
      game8Id: u.game8Id,
      count: u.count,
      examples: u.examples,
      candidates: ranked,
    };
  });
  suggestions.sort((a, b) => a.type.localeCompare(b.type) || b.count - a.count);
  fs.writeFileSync(
    SUGGEST_FILE,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString().slice(0, 10),
        note: "精確比對（正規化後）仍失敗者，多為 Game8 暱稱/簡稱。candidates 為 Kiranico 名稱中編輯距離最近的 2-3 個候選＋內部 ID，供人工勾選。確認後把「日文名: 內部ID」加進 data/jp-name-map.json 對應 type，重跑 scrape-game8.js 即回填。",
        counts: still.reduce((a, u) => ((a[u.type] = (a[u.type] ?? 0) + 1), a), {}),
        items: suggestions,
      },
      null,
      1
    ) + "\n"
  );
  console.log(`✓ data/jp-name-map.suggestions.json：${suggestions.length} 筆待人工（${JSON.stringify(
    still.reduce((a, u) => ((a[u.type] = (a[u.type] ?? 0) + 1), a), {})
  )}）`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
