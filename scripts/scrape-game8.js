#!/usr/bin/env node
/**
 * Game8 推薦配裝爬蟲 — 離線建置腳本，只在本機手動執行，網站 runtime 絕不爬取外站。
 *
 * 來源設定：scripts/game8-sources.json（14 武種 × 6 類文章 URL，人工維護；
 * --hub 可對照 hub 頁驗證 URL 是否仍有效）。
 * 輸出：data/recommended-builds.json（schema 詳見輸出檔 meta.schemaDoc）。
 *
 * 名稱解析：所有技能/防具/裝飾珠/武器引用一律存專案內部 ID
 * （data/jp-name-map.json 日文名→內部 ID；檔案不存在或比對不到時 id=null
 * 並列入 unresolved 清單，補齊對照表後重跑即回填）。日文原文保留於
 * rawNameJa 供除錯，Game8 連結數字 ID 保留於 game8Id 作人工補表穩定鍵。
 *
 * 解析策略：表頭驅動（不依賴文章版型）——
 *   武器|装飾品/百竜スロ → 完整武器表（MR最強裝格式）
 *   武器名|スロ|攻撃力|会心 → 候選武器表
 *   防具|傀異錬成|装飾品 → MR 防具表（含護石/発動スキル列）
 *   防具|スロ|スキル → 簡易防具表（上位/下位；尾部可能有護石/装飾品/発動スキル列）
 *   派生|おすすめ百竜スキル、百竜スキル → 百龍技能表
 * 已知的非配裝表（関連記事/入れ替え/攻略班/代替案等）靜默略過；
 * 其餘認不得的表頭不硬猜，進 errors 清單供人工處理。
 *
 * 用法：node scripts/scrape-game8.js [--only=great_sword,bow] [--categories=mrEndgame]
 *       [--refresh] [--hub]
 * 禮貌原則：頁面間隔 config.requestDelayMs（預設 2500ms），正常瀏覽器 UA，
 * HTML 磁碟快取（scripts/.game8-cache/，gitignore）重跑零抓取。
 */
const fs = require("node:fs");
const path = require("node:path");
const { normalizeJa } = require("./game8-normalize.js");

const ROOT = path.join(__dirname, "..");
const CONFIG = JSON.parse(fs.readFileSync(path.join(__dirname, "game8-sources.json"), "utf8"));
const CACHE_DIR = path.join(__dirname, ".game8-cache");
const MAP_FILE = path.join(ROOT, "data", "jp-name-map.json");
const OUT_FILE = path.join(ROOT, CONFIG.outputPath);

const args = process.argv.slice(2);
const argOf = (name) => {
  const a = args.find((x) => x.startsWith(`--${name}=`));
  return a ? a.slice(name.length + 3).split(",") : null;
};
const ONLY = argOf("only");
const CATEGORIES = argOf("categories");
const REFRESH = args.includes("--refresh");
const CHECK_HUB = args.includes("--hub");

// ---------- 名稱對照 ----------
const nameMap = (() => {
  try {
    return JSON.parse(fs.readFileSync(MAP_FILE, "utf8"));
  } catch {
    console.warn("⚠ data/jp-name-map.json 不存在，所有 id 將為 null（建表後重跑回填）");
    return { skills: {}, armors: {}, decorations: {}, weapons: {}, alternatives: {} };
  }
})();
const unresolved = new Map(); // `${type}:${ja}` -> {type, rawNameJa, game8Id, count, examples}
let currentBuildId = null;
function resolve(type, ja, game8Id) {
  const id = nameMap[type]?.[normalizeJa(ja)];
  if (id != null) return id;
  const key = `${type}:${ja}`;
  const u = unresolved.get(key) ?? { type, rawNameJa: ja, game8Id: game8Id ?? null, count: 0, examples: [] };
  u.count++;
  if (game8Id != null) u.game8Id = game8Id;
  if (currentBuildId && u.examples.length < 3 && !u.examples.includes(currentBuildId)) u.examples.push(currentBuildId);
  unresolved.set(key, u);
  return null;
}

// ---------- HTML 工具 ----------
const decodeEntities = (s) =>
  s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&nbsp;/g, " ");
const textOf = (html) => decodeEntities(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
const game8IdOf = (html) => {
  const m = html.match(/href="(?:https:\/\/game8\.jp)?\/mhrise\/(\d+)"/);
  return m ? Number(m[1]) : null;
};
const CIRCLED = { "①": 1, "②": 2, "③": 3, "④": 4 };
/** 「④②ー」→ [4,2,0]；無孔位符號回傳 null。 */
function parseSlots(s) {
  const out = [];
  for (const ch of s) {
    if (CIRCLED[ch]) out.push(CIRCLED[ch]);
    else if (ch === "ー" || ch === "―" || ch === "−") out.push(0);
  }
  return out.length ? out : null;
}

// ---------- 抓取（快取 + 延遲） ----------
let lastFetch = 0;
async function fetchPage(url) {
  const id = url.match(/mhrise\/(\d+)/)[1];
  const file = path.join(CACHE_DIR, `${id}.html`);
  if (!REFRESH && fs.existsSync(file)) return fs.readFileSync(file, "utf8");
  const wait = lastFetch + CONFIG.requestDelayMs - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  console.log(`  ↓ ${url}`);
  const res = await fetch(url, { headers: { "User-Agent": CONFIG.userAgent } });
  lastFetch = Date.now();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
  const html = await res.text();
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(file, html);
  return html;
}

// ---------- 文章結構化 ----------
/** 文章主體切出 H2/H3/table 序列（至 関連リンク H2 止）。 */
function articleTokens(html) {
  const tokens = [];
  const re = /<h2[^>]*>([\s\S]*?)<\/h2>|<h3[^>]*>([\s\S]*?)<\/h3>|<table[^>]*>[\s\S]*?<\/table>/g;
  let m;
  while ((m = re.exec(html))) {
    if (m[1] != null) {
      const t = textOf(m[1]);
      if (/関連リンク|コメント|権利表記/.test(t)) break;
      tokens.push({ kind: "h2", text: t });
    } else if (m[2] != null) {
      tokens.push({ kind: "h3", text: textOf(m[2]) });
    } else {
      tokens.push({ kind: "table", html: m[0] });
    }
  }
  return tokens;
}

/** table HTML → rows: [{cells:[{html,text,game8Id}]}] */
function parseTableRows(tableHtml) {
  const rows = [];
  for (const r of tableHtml.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)) {
    const cells = [...r[1].matchAll(/<(th|td)[^>]*>([\s\S]*?)<\/\1>/g)].map((c) => ({
      html: c[2],
      text: textOf(c[2]),
      game8Id: game8IdOf(c[2]),
    }));
    if (cells.length) rows.push({ cells });
  }
  return rows;
}

const SILENT_SKIP =
  /関連記事|おすすめポイント|早見表|^入れ替え|攻略班|代替案|立ち回り|^\d+位$|^スキル$|使用率|調合アイテム|抽選おすすめ|必要素材|入手場所|強化パーツ|新アクション|入れ替え技|生産素材|おすすめ装飾品|^旋律$|^猟虫$|納刀速度/;

/** 表頭 → 表格類型；認不得回傳 null（進 errors）。 */
function classifyTable(rows) {
  const h = rows[0].cells.map((c) => c.text);
  if (SILENT_SKIP.test(h[0]) || (h[1] && SILENT_SKIP.test(h[1]))) return "skip";
  if (rows.some((r) => /立ち回り/.test(r.cells[0].text))) return "skip"; // 立回解說表
  if (h.length >= 2 && h.every((x) => /属性$|^(通常|放射|拡散)型$/.test(x))) return "skip"; // 屬性/砲擊型跳轉導覽
  if (/^[▼①②③④⑤⑥⑦⑧⑨]/.test(h[0])) return "skip"; // 跳轉選單/製作步驟表
  if (h[0].includes("：")) return "skip"; // 「火属性：○○」式文字指南表
  if (/【\d】$/.test(h[0])) return "skip"; // 裝飾珠推薦清單（火炎珠【1】|…）
  if (h.some((x) => x.includes("属性別"))) return "skip"; // 站內屬性別跳轉導覽表
  if (rows.some((r) => r.cells[0].text === "猟虫ボーナス")) return "kinsect"; // 操蟲棍獵蟲表
  if (h[0] === "武器" && h[1] && h[1].includes("装飾品")) return "weaponFull";
  if (h[0].startsWith("武器名")) return "weaponCandidate"; // 含弓的「武器名 / ビン」
  if (h[1] === "レア度") return "weaponVertical"; // 直式規格表（笛/弩推薦頁）
  if (h[0].startsWith("最終派生")) return "weaponHH"; // 狩獵笛 最終派生/切れ味 表
  if (h[0] === "防具" && h[1] && h[1].includes("錬成")) return "armorMR";
  if (h[0] === "防具" && h.some((x) => x === "スキル")) return "armorSimple";
  if (h[0] === "派生" || h.some((x) => x.includes("百竜スキル"))) return "rampage";
  if (h[0] === "護石") return "skip"; // 獨立護石說明表（罕見），非配裝主體
  return null;
}

// ---------- 欄位解析 ----------
/** 裝飾珠 cell →（珠/自由枠/百龍珠系）清單。名稱含孔位（守勢珠【3】）與專案 nameZh 同形。 */
function parseDecoCell(cell) {
  const decos = [];
  const rampage = [];
  for (const m of cell.text.matchAll(/([^\s／・]+?)【(\d)】(?:\s*x(\d+))?/g)) {
    const raw = `${m[1]}【${m[2]}】`;
    const count = m[3] ? Number(m[3]) : 1;
    if (m[1] === "自由枠") {
      decos.push({ free: true, slotSize: Number(m[2]), count });
    } else if (m[1].endsWith("系") || m[1].endsWith("竜珠")) {
      // ○系＝武器百龍珠、○竜珠＝百龍装飾品；專案無此資料，比照獵蟲留原文
      rampage.push({ rawNameJa: raw, count });
    } else if (m[1].startsWith("各属性")) {
      // Game8 元素佔位符（各属性珠／各属性強化の装飾品）＝「配你武器屬性選對應珠」，
      // 非單一珠、無法對 ID；標 placeholder，顯示端提示玩家依屬性自選。
      decos.push({ placeholder: true, rawNameJa: raw, count });
    } else {
      decos.push({ id: resolve("decorations", raw, cell.game8Id ? null : null), rawNameJa: raw, count });
    }
  }
  // game8Id 逐珠取：cell 內多個 <a> 依序對應
  const links = [...cell.html.matchAll(/href="(?:https:\/\/game8\.jp)?\/mhrise\/(\d+)"[^>]*>([\s\S]*?)<\/a>/g)];
  for (const d of decos) {
    if (d.free || d.placeholder) continue;
    const link = links.find((l) => textOf(l[2]) === d.rawNameJa);
    if (link) d.game8Id = Number(link[1]);
  }
  return { decos, rampage };
}

/** 「・ 攻撃 2 ・ 見切り 2」/「弱点特効 2」→ [{id,rawNameJa,level}]。
 *  收合傀異錬成升級記法「攻撃 0→1」為最終值（否則箭頭混入技能名）。 */
function parseSkillList(cell) {
  const out = [];
  const text = cell.text.replace(/\d*\s*→\s*/g, "");
  for (const m of text.matchAll(/(?:・\s*)?([^・\s／][^・／]*?)\s+(\d+)(?=\s|$)/g)) {
    const ja = m[1].trim();
    out.push({ id: resolve("skills", ja), rawNameJa: ja, level: Number(m[2]) });
  }
  return out;
}

/**
 * 発動スキル總表。結構：每技能為 <a>名稱</a><b>LvN[→LvM]</b>，紅字必須技能
 * 外包 <span class="a-red">。以結構解析（比 ／ 文字切割穩健，正確處理
 * Lv4→Lv5 升級記法，不會把箭頭誤判為技能名）。required 判定：該 <a> 之前
 * 最近的是 a-red span 開啟而非 </span> 關閉 → 位於紅字區。
 */
function parseSkillTotals(cell) {
  const out = [];
  const re = /<a[^>]*>([^<]+)<\/a>\s*<b[^>]*>\s*Lv(\d+)(?:\s*→\s*Lv(\d+))?/g;
  let m;
  while ((m = re.exec(cell.html))) {
    const name = decodeEntities(m[1]).trim();
    const entry = { id: resolve("skills", name), rawNameJa: name, level: Number(m[2]) };
    if (m[3]) entry.augmentedLevel = Number(m[3]);
    const before = cell.html.slice(0, m.index);
    if (before.lastIndexOf('a-red') > before.lastIndexOf("</span>")) entry.required = true;
    out.push(entry);
  }
  return out;
}

const ARMOR_SLOTS = ["head", "chest", "arms", "waist", "legs"];

/**
 * 防具表 → { pieces, talisman, buildDecorations, skillTotals }
 * 列序固定：5 部位 →（護石）→（装飾品總表）→（発動スキル）。
 * 部位列版面三種（由表頭第二欄判定）：
 *  - mr     ：防具|傀異錬成|装飾品 → [名稱, 錬成, 珠]
 *  - mr-slot：防具|スロット/傀異錬成 → [名稱, 孔位, 錬成]，珠在獨立装飾品總表
 *  - simple ：防具|スロ|スキル → [名稱, 孔位, 技能]
 */
function parseArmorTable(rows, type) {
  const h1 = rows[0].cells[1]?.text ?? "";
  const layout = type === "armorSimple" ? "simple" : /スロ/.test(h1) ? "mr-slot" : "mr";
  const pieces = [];
  let talisman = null;
  let buildDecorations = null;
  let skillTotals = null;
  let mode = "pieces";
  for (let i = 1; i < rows.length; i++) {
    const cells = rows[i].cells;
    const c0 = cells[0].text;
    // 護石列：cell1 為「スロ(ット)」字樣＝表頭，資料在下一列；否則為單列資料（簡易格式）
    if (c0 === "護石") {
      if (/^スロ/.test(cells[1]?.text ?? "")) {
        mode = "talisman-next";
      } else {
        talisman = {
          skills: cells[2] ? parseSkillList(cells[2]) : [],
          slots: parseSlots(cells[1]?.text ?? ""),
          decorations: [],
        };
      }
      continue;
    }
    if (mode === "talisman-next") {
      const talismanText = cells[0].text.replace(/\d*\s*→\s*/g, ""); // 收合傀異錬成升級記法
      const skills = [...talismanText.matchAll(/(\S+?)\s+(\d+)/g)].map((m) => ({
        id: resolve("skills", m[1], cells[0].game8Id),
        rawNameJa: m[1],
        level: Number(m[2]),
      }));
      talisman = {
        skills,
        slots: parseSlots(cells[1]?.text ?? ""),
        decorations: cells[2] ? parseDecoCell(cells[2]).decos : [],
      };
      mode = "pieces";
      continue;
    }
    if (c0 === "装飾品") {
      mode = "decos-next";
      continue;
    }
    if (mode === "decos-next") {
      buildDecorations = parseDecoCell(cells[0]).decos;
      mode = "pieces";
      continue;
    }
    if (c0.startsWith("発動スキル")) {
      mode = "skills-next";
      continue;
    }
    if (mode === "skills-next") {
      skillTotals = parseSkillTotals(cells[0]);
      mode = "pieces";
      continue;
    }
    // 註解/區段列（部分 MR 表把傀異錬成獨立成列，或夾帶 ※ 說明句），非防具。
    // 「技能名 空格 數字」= 護石技能列在無標準表頭時漏抓（防具名不會以 空格+數字 結尾）。
    if (c0 === "傀異錬成" || /※/.test(c0) || c0.length > 18 || /\s\d+$/.test(c0)) continue;
    // 部位列
    // A/B 二擇一防具（Game8「Aスロ/Bスロ ヘルム」）：若 override 已定 alternatives，
    // 展開為 alternatives 陣列（第一個為主裝備）；未定則照常 resolve（→null→待人工）
    const altIds = c0.includes("/") ? nameMap.alternatives?.[normalizeJa(c0)] : null;
    const piece = {
      slot: null, // 5 件成套時由組裝階段依列序填 head→legs
      id: altIds ? altIds[0] : resolve("armors", c0, cells[0].game8Id),
      rawNameJa: c0,
      game8Id: cells[0].game8Id,
      ...(altIds ? { alternatives: altIds.map((id) => ({ id })) } : {}),
    };
    if (layout === "mr") {
      piece.augmentRaw = cells[1]?.text || null; // 傀異錬成，原樣保留日文
      piece.decorations = parseDecoCell(cells[2] ?? { text: "", html: "" }).decos;
    } else if (layout === "mr-slot") {
      piece.slots = parseSlots(cells[1]?.text ?? "");
      piece.augmentRaw = cells[2]?.text || null; // 珠在獨立総表（buildDecorations）
    } else {
      piece.slots = parseSlots(cells[1]?.text ?? "");
      piece.skills = cells[2] ? parseSkillList(cells[2]) : [];
    }
    pieces.push(piece);
  }
  return { pieces, talisman, buildDecorations, skillTotals };
}

/** 完整武器表（武器|装飾品/百竜スロ）→ 武器物件。 */
function parseWeaponFull(rows) {
  const c = rows[1]?.cells;
  if (!c) return null;
  const name = textOf(c[0].html.match(/<a[^>]*>([\s\S]*?)<\/a>/)?.[1] ?? "").trim() || c[0].text.split("【攻")[0].trim();
  const { decos, rampage } = parseDecoCell(c[1] ?? { text: "", html: "" });
  return {
    id: resolve("weapons", name, c[0].game8Id),
    rawNameJa: name,
    game8Id: c[0].game8Id,
    statsRaw: c[0].text.replace(name, "").trim() || null,
    decorations: decos,
    rampageDecos: rampage,
  };
}

/**
 * 候選武器表 → 武器物件。欄位以表頭文字定位（武器名|スロ|攻撃力|会心 與
 * 弓的 武器名/ビン|攻撃|会心|スロ|溜め 皆適用）。
 */
function parseWeaponCandidate(rows) {
  const heads = rows[0].cells.map((x) => x.text);
  const c = rows[1]?.cells;
  if (!c) return null;
  const col = (kw) => heads.findIndex((x) => x.includes(kw));
  // 名稱取連結文字（弓的 cell0 名稱後跟著可用瓶清單）
  const linkName = textOf(c[0].html.match(/<a[^>]*>([\s\S]*?)<\/a>/)?.[1] ?? "").trim();
  const name = linkName || c[0].text;
  const extra = c[0].text.replace(name, "").trim(); // 弓：接撃/強撃等瓶
  const iSlot = col("スロ");
  const iAtk = col("攻撃");
  const iAff = col("会心");
  const iCharge = col("溜め");
  const slotsPart = iSlot > 0 ? (c[iSlot]?.text ?? "").split("百竜") : [""];
  const stats = [
    iAtk > 0 && c[iAtk] ? `攻撃力${c[iAtk].text}` : null,
    iAff > 0 && c[iAff] ? `会心${c[iAff].text}` : null,
    extra ? `ビン:${extra}` : null,
    iCharge > 0 && c[iCharge] ? `溜め:${c[iCharge].text}` : null,
  ].filter(Boolean);
  return {
    id: resolve("weapons", name, c[0].game8Id),
    rawNameJa: name,
    game8Id: c[0].game8Id,
    slots: parseSlots(slotsPart[0]),
    rampageSlot: slotsPart[1] ? parseSlots(slotsPart[1])?.[0] ?? null : null,
    statsRaw: stats.join(" ") || null,
  };
}

/** 直式規格表（<武器名>|レア度|攻撃力|会心率；笛/弩推薦頁）→ 武器物件。 */
function parseWeaponVertical(rows) {
  const h = rows[0].cells;
  const name = h[0].text;
  const v1 = rows[1]?.cells.map((x) => x.text) ?? [];
  let element = null;
  let slots = null;
  let rampageSlot = null;
  let melody = null;
  for (let i = 1; i < rows.length - 1; i++) {
    const t = rows[i].cells.map((x) => x.text);
    if (t[0] === "属性" && t[1] === "スロット") {
      const val = rows[i + 1]?.cells.map((x) => x.text) ?? [];
      element = val[0] || null;
      slots = parseSlots(val[1] ?? "");
    }
    if (t[0] === "百竜スロット") rampageSlot = parseSlots(t[1] ?? "")?.[0] ?? null;
    if (t[0] === "旋律効果") melody = t[1] || null;
  }
  return {
    id: resolve("weapons", name, h[0].game8Id),
    rawNameJa: name,
    game8Id: h[0].game8Id,
    slots,
    rampageSlot,
    statsRaw:
      [`レア${v1[0] ?? "?"}`, `攻撃力${v1[1] ?? "?"}`, `会心${v1[2] ?? "?"}%`, element ? `属性${element}` : null]
        .filter(Boolean)
        .join(" ") || null,
    ...(melody ? { melodyRaw: melody } : {}),
  };
}

/** 狩獵笛 最終派生/切れ味|攻撃／会心／スロ｜旋律 表 → 武器物件。 */
function parseWeaponHH(rows) {
  const c = rows[1]?.cells;
  if (!c) return null;
  const name = c[0].text;
  const slotsPart = (c[3]?.text ?? "").split("百竜");
  const melody = rows[2]?.cells[0]?.text || null;
  return {
    id: resolve("weapons", name, c[0].game8Id),
    rawNameJa: name,
    game8Id: c[0].game8Id,
    slots: parseSlots(slotsPart[0]),
    rampageSlot: slotsPart[1] ? parseSlots(slotsPart[1])?.[0] ?? null : null,
    statsRaw: [c[1]?.text ? `攻撃${c[1].text}` : null, c[2]?.text ? `会心${c[2].text}` : null].filter(Boolean).join(" ") || null,
    ...(melody ? { melodyRaw: melody } : {}),
  };
}

/** 操蟲棍獵蟲表 → { rawNameJa, game8Id, statsRaw }。專案無獵蟲資料，不解析 ID。 */
function parseKinsect(rows) {
  const name = rows[0].cells[0].text;
  let atkType = null;
  let kinType = null;
  for (const r of rows) {
    for (const c of r.cells) {
      if (c.text === "打撃" || c.text === "切断") atkType = c.text;
      if (/型/.test(c.text) && c.text !== "タイプ" && c.text.length <= 14) kinType = kinType || c.text;
    }
  }
  return {
    rawNameJa: name,
    game8Id: rows[0].cells[0].game8Id,
    statsRaw: [atkType, kinType].filter(Boolean).join(" ") || null,
  };
}

const WEAPON_TYPES = new Set(["weaponFull", "weaponCandidate", "weaponVertical", "weaponHH"]);
function parseWeaponAny(it) {
  if (it.type === "weaponFull") return parseWeaponFull(it.rows);
  if (it.type === "weaponVertical") return parseWeaponVertical(it.rows);
  if (it.type === "weaponHH") return parseWeaponHH(it.rows);
  return parseWeaponCandidate(it.rows);
}

const parseRampage = (rows) =>
  rows
    .slice(rows[0].cells[0].text === "派生" || rows[0].cells.some((c) => c.text.includes("百竜スキル")) ? 1 : 0)
    .flatMap((r) => r.cells.map((c) => c.text))
    .filter((t) => t && t !== "派生" && !t.includes("百竜スキル"))
    .map((t) => ({ rawNameJa: t }));

// ---------- 文章 → builds ----------
function parseArticle(html, weapon, category, url, errors) {
  const tokens = articleTokens(html);
  const weaponType = weapon.id.replace(/_/g, "-");
  // 依 H2 分節，節內保存 H3 與分類後的表格
  const sections = [];
  let cur = null;
  let curH3 = null;
  for (const tk of tokens) {
    if (tk.kind === "h2") {
      cur = { h2: tk.text, items: [] };
      curH3 = null;
      sections.push(cur);
    } else if (tk.kind === "h3") {
      curH3 = tk.text;
    } else if (cur) {
      if (/おすすめスキル/.test(cur.h2)) continue; // 技能說明段，非配裝資料
      const rows = parseTableRows(tk.html);
      if (!rows.length) continue;
      const type = classifyTable(rows);
      if (type === "skip") continue;
      if (type == null) {
        errors.push({
          sourceUrl: url,
          weaponType,
          category,
          h2: cur.h2,
          h3: curH3,
          reason: "無法辨識的表頭",
          headerPreview: rows[0].cells.map((c) => c.text).join(" | ").slice(0, 80),
        });
        continue;
      }
      cur.items.push({ type, rows, h3: curH3 });
    }
  }

  const builds = [];
  let seq = 0;
  const mkId = () => `${weaponType}:${category}:${seq++}`;

  for (const sec of sections) {
    if (!sec.items.length) continue;
    const armorTables = sec.items.filter((x) => x.type === "armorMR" || x.type === "armorSimple");
    const kinsects = sec.items.filter((x) => x.type === "kinsect").map((x) => parseKinsect(x.rows));
    if (armorTables.length === 0) {
      // 純武器節（おすすめ武器/候選清單）→ weapon-list；純獵蟲節 → kinsect-list
      const weapons = [];
      for (const it of sec.items) {
        currentBuildId = `${weaponType}:${category}:${seq}`;
        if (WEAPON_TYPES.has(it.type)) {
          const w = parseWeaponAny(it);
          if (w) weapons.push({ ...w, noteRaw: it.h3 || null });
        }
      }
      if (!weapons.length) {
        if (kinsects.length) {
          builds.push({
            id: mkId(),
            weaponType,
            category,
            kind: "kinsect-list",
            buildName: sec.h2,
            stageName: sec.h2,
            kinsect: kinsects,
            sourceUrl: url,
          });
        }
        continue;
      }
      const rampages = sec.items.filter((x) => x.type === "rampage").flatMap((x) => parseRampage(x.rows));
      builds.push({
        id: mkId(),
        weaponType,
        category,
        kind: "weapon-list",
        buildName: sec.h2,
        stageName: sec.h2,
        weapons: weapons.filter(Boolean),
        ...(kinsects.length ? { kinsect: kinsects } : {}),
        rampageSkills: rampages.length ? rampages : null,
        sourceUrl: url,
      });
      continue;
    }
    // 有防具表：依文件順序配對——武器/百龍表歸屬「其後最近的防具表」
    // （屬性配裝節是多組 武器→防具 交錯排列；簡易格式則是武器 H3 全部在防具表前）
    const paired = [];
    let pendingW = [];
    let pendingR = [];
    for (const it of sec.items) {
      if (WEAPON_TYPES.has(it.type)) pendingW.push(it);
      else if (it.type === "rampage") pendingR.push(it);
      else if (it.type === "armorMR" || it.type === "armorSimple") {
        paired.push({ at: it, wsrc: pendingW, rsrc: pendingR });
        pendingW = [];
        pendingR = [];
      }
    }
    const allW = sec.items.filter((x) => WEAPON_TYPES.has(x.type));
    const h3Count = {};
    for (const { at } of paired) h3Count[at.h3 ?? ""] = (h3Count[at.h3 ?? ""] ?? 0) + 1;
    for (const { at, wsrc, rsrc } of paired) {
      currentBuildId = `${weaponType}:${category}:${seq}`;
      const parsed = parseArmorTable(at.rows, at.type);
      const weapons = (wsrc.length ? wsrc : allW).map(parseWeaponAny).filter(Boolean);
      const rampages = rsrc.flatMap((x) => parseRampage(x.rows));
      const isSet = parsed.pieces.length === 5 && category !== "mrEarly";
      if (isSet) parsed.pieces.forEach((p, i) => (p.slot = ARMOR_SLOTS[i]));
      // 同 H3 多組（屬性變體）時以武器名消歧
      const base = at.h3 || sec.h2;
      const buildName =
        h3Count[at.h3 ?? ""] > 1 && weapons[0] ? `${base}（${weapons[0].rawNameJa}）` : base;
      builds.push({
        id: mkId(),
        weaponType,
        category,
        kind: isSet ? "full-build" : "armor-pieces",
        buildName,
        stageName: sec.h2,
        weapons,
        armor: parsed.pieces,
        talisman: parsed.talisman,
        buildDecorations: parsed.buildDecorations,
        skillTotals: parsed.skillTotals,
        rampageSkills: rampages.length ? rampages : null,
        sourceUrl: url,
      });
    }
  }
  currentBuildId = null;
  return builds;
}

// ---------- hub 驗證 ----------
async function verifyHub() {
  console.log("→ hub 頁 URL 驗證");
  const html = await fetchPage(CONFIG.hubUrl);
  for (const w of CONFIG.weapons) {
    for (const [cat, url] of Object.entries(w.articles)) {
      if (!url) {
        // 嘗試從 hub 找候選（錨文字含武器日文名＋おすすめ武器）
        const re = new RegExp(`href="(?:https://game8\\.jp)?/mhrise/(\\d+)"[^>]*>[^<]*${w.nameJa}のおすすめ武器`, "g");
        const cands = [...html.matchAll(re)].map((m) => m[1]);
        if (cands.length) console.log(`  ${w.id}.${cat}=null，hub 候選：https://game8.jp/mhrise/${cands[0]}`);
        continue;
      }
      const id = url.match(/mhrise\/(\d+)/)[1];
      if (!html.includes(`/mhrise/${id}`)) {
        console.warn(`  ⚠ hub 頁找不到 ${w.id}.${cat} 的連結（${url}）——文章可能已改版`);
      }
    }
  }
}

// ---------- schema 文件（供三、四階 prompt 引用） ----------
const SCHEMA_DOC = {
  builds: "配裝清單。所有 skill/armor/decoration/weapon 引用一律存專案內部 ID：armors/weapons/decorations 用資料檔的 id 欄位（armor_*/weapon_*/deco_*），skills 用中文名稱字串（=skills.json 的 name，專案無獨立技能 id）。比對不到時 id=null 且列入頂層 unresolved 清單（補 data/jp-name-overrides.json 後重跑回填）。rawNameJa=Game8 日文原文，僅供除錯與人工補表；game8Id=Game8 文章數字 ID，為人工補表的穩定鍵。",
  syntheticIds: "內部 ID 可能含手工合成條目（deco_manual_* 前綴）：Kiranico 漏收但確實存在的資料由 import-kiranico 的 MANUAL_DECORATIONS 補入，id 無對應 Kiranico 數字。顯示端勿對 id 做數字解析或組 Kiranico 連結（kiranicoUrl 已白名單排除）。",
  residualRisk: "殘餘風險（可接受，不另處理）：資料完整性以 Game8 配裝(獨立外部源) vs 專案交叉核對，但『Kiranico 漏收 + Game8 也沒用到』的珠仍偵測不到。這類珠不會出現在推薦配裝、也極少是配裝關鍵珠，故列為已知殘留。",
  kind: {
    "full-build":
      "成套配裝：armor 恆為 5 件、slot 依來源列序填 head/chest/arms/waist/legs；可能含 talisman（護石：skills+slots+decorations）、buildDecorations（全裝珠總計，僅上位畢業裝格式——該格式珠不逐部位標示）、skillTotals（發動技能總表，含 required=紅字必須技能、augmentedLevel=傀異錬成後等級）。skillTotals 為 null 時=來源未提供總表（簡易格式），下游需自行從部位 skills 合成或僅顯示部位技能。匯出到配裝器＝完整套裝預選。",
    "armor-pieces":
      "單件推薦清單（MR 拓荒文常見）：armor 為不定長陣列、slot=null（同部位可能多件並列，如兩頂頭盔擇一）。非成套語義——無護石、無技能總表、無完整發動技能可算。卡片顯示需逐件列出；匯出到配裝器時只能作為部分部位預選，其餘部位留空，行為與 full-build 不同。",
    "weapon-list":
      "純武器推薦（おすすめ武器文章、簡易格式的候選武器節）：無 armor/talisman。weapons[].noteRaw 保留 H3 標題（含 MR1 等時期標註）。",
    "kinsect-list":
      "操蟲棍獵蟲推薦（おすすめ猟虫節，僅 insect-glaive）：kinsect[] 陣列。專案無獵蟲資料，故只存 rawNameJa/game8Id/statsRaw（攻撃屬性＋型），不解析內部 ID，顯示端照 fallback 顯示原文。",
  },
  kinsect:
    "選用欄位（kinsect-list 必有、weapon-list 若同節有獵蟲表則附帶）：獵蟲清單，每筆 { rawNameJa, game8Id, statsRaw }，無 ID 解析。",
  alternatives:
    "armor 部位的選用欄位：Game8「Aスロ/Bスロ ヘルム」＝兩件擇一。存在時該部位 id=alternatives[0].id（主裝備），alternatives=[{id},…] 為全部可選件。★三階 UI 需將此部位卡片顯示成「A 或 B」、四階匯出以主裝備為預選。由 data/jp-name-overrides.json 的 alternatives 段人工定義（scraper 不自動拆分）；未定義的 A/B 名 id=null 待人工。",
  categories: "階段分類鍵與中文標籤見 scripts/game8-sources.json 的 categories。",
  stageName: "文章內 H2 段落標題（如「上位おすすめ装備(集会所★4〜5)」），保留文章內的階段細分；buildName 取最貼近該配裝的標題（H3 為主），同名多組時以武器名消歧。",
  augmentRaw: "傀異錬成內容，Game8 日文原樣保留（專案無對應系統，顯示端自行決定呈現方式）。",
  rampageSkills: "百龍技能（rawNameJa 原樣，專案資料無百龍技能清單，不做 ID 解析）。",
  placeholder:
    "裝飾珠選用旗標：Game8 元素佔位符（各属性珠／各属性強化の装飾品）＝「配你武器屬性選對應珠」，非單一珠、無 ID。顯示端應提示玩家依屬性自選（如火→火炎珠），不當缺漏。",
  errors: "解析失敗的表格（不硬猜），含來源 URL 與表頭預覽，供人工處理。",
  unresolved: "比對不到內部 ID 的日文名稱彙總（type/rawNameJa/game8Id/出現次數/example builds）。",
};

// ---------- main ----------
async function main() {
  if (CHECK_HUB) await verifyHub();
  const weapons = CONFIG.weapons.filter((w) => !ONLY || ONLY.includes(w.id));
  const cats = Object.keys(CONFIG.categories).filter((c) => !CATEGORIES || CATEGORIES.includes(c));
  const builds = [];
  const errors = [];
  for (const w of weapons) {
    for (const cat of cats) {
      const url = w.articles[cat];
      if (!url) continue;
      let html;
      try {
        html = await fetchPage(url);
      } catch (e) {
        errors.push({ sourceUrl: url, weaponType: w.id.replace(/_/g, "-"), category: cat, reason: `抓取失敗: ${e.message}` });
        continue;
      }
      const got = parseArticle(html, w, cat, url, errors);
      builds.push(...got);
      console.log(`  ${w.id} ${cat}: ${got.length} builds`);
    }
  }

  const out = {
    meta: {
      source: "Game8 武器別おすすめ最強装備系列（https://game8.jp/mhrise）",
      attribution: "配裝參考：Game8（網站顯示時必須標註，各 build 附 sourceUrl）",
      scrapedAt: new Date().toISOString().slice(0, 10),
      generator: "scripts/scrape-game8.js（來源設定 scripts/game8-sources.json）",
      schemaDoc: SCHEMA_DOC,
    },
    builds,
    errors,
    unresolved: [...unresolved.values()].sort((a, b) => a.type.localeCompare(b.type) || b.count - a.count),
  };
  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify(out, null, 1) + "\n");

  const byKind = {};
  for (const b of builds) byKind[b.kind] = (byKind[b.kind] ?? 0) + 1;
  console.log(
    `✓ ${CONFIG.outputPath}：${builds.length} builds（${Object.entries(byKind)
      .map(([k, n]) => `${k} ${n}`)
      .join("、")}）、errors ${errors.length}、unresolved ${out.unresolved.length}`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
