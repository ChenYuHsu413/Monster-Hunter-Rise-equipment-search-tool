#!/usr/bin/env node
/**
 * Altema 配裝爬蟲 — 離線建置腳本，只在本機手動執行，網站 runtime 絕不爬取外站。
 * 復刻 scripts/scrape-game8.js 的管線慣例（快取＋2.5s 間隔＋表頭驅動解析），但產出
 * 進「社群配裝」管線（schema v2，validate-community-builds.mjs），platform:"altema"，
 * 不進 Game8 的 data/recommended-builds.json。
 *
 * 產出定位（與社群管線一致）：必填＝防具五件＋目標技能＋source；護石／逐孔珠／武器選填。
 * 細節缺失由配裝器 solver 以使用者資源代入計算，這是管線的設計前提。名稱一律存
 * 「日文原文」，解析交給驗證器（jp-name-map → suggestions）；本腳本不自行解析 ID，
 * 讓未解析名稱集中在一個裁決面（scripts/output/altema-candidates.suggestions.json）。
 *
 * 表格啟發式（偵察＋實測 taikentemplate 確認）：每頁多表——
 *   具體配裝表：表頭含「部位」＋「防具名」、且 ≥4 個 seriesbogu 連結、資料列非 ×/-。
 *   発動スキル表：表頭第一格＝「発動スキル」→ targetSkills（技能總表）。
 *   武器名表：表頭第一格＝「武器名」→ 武器（收進 notes/_extraction，不結構化）。
 *   互動模擬器表（投稿樣板）：全 ×/- 佔位、seriesbogu=0 → 剔除（且 scan 於「投稿」段止步）。
 *   其餘（必要素材／スキル解説／入れ替え技／百竜スキル）表頭不符 → 靜默略過。
 *
 * 武器與逐孔珠為何走 notes 而非結構化：兩者皆選填；若結構化，未解析的武器名／無法裝孔
 * 的珠會讓「純骨架完好」的檔整檔驗證失敗，汙染通過率語意。故收進 _extraction／notes 原文，
 * 由使用者日後以 override 升格；required 骨架維持乾淨。
 *
 * 用法：node scripts/scrape-altema.mjs [--list] [--refresh] [--only=taiken,kantuulight]
 *   --list    只讀快取索引、印出候選配裝頁清單（不抓內文）
 *   --refresh 忽略快取重抓（預設吃 scripts/.cache/altema/ 快取，重跑零請求）
 *   --only    只跑指定 cb 基名（逗號分隔）
 * 禮貌原則：頁面間隔 REQUEST_DELAY_MS（2500ms），正常瀏覽器 UA，HTML 快取重跑零抓取。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const CACHE_DIR = path.join(__dirname, ".cache", "altema");
const OUT_DIR = path.join(ROOT, "scripts", "output", "altema-candidates");

const BASE = "https://altema.jp/mhrize";
const INDEX_SLUG = "jouitemplate";
const REQUEST_DELAY_MS = 2500;
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

// ---------- 第一輪核可爬取集（A：14 武器別テンプレ；C：6 特定流派；B 最強装備暫緩）----------
// cb＝候選檔基名（→ slug "altema-<cb>"、檔名 cb_altema-<cb>.json）；wt＝weaponTypes.json id（選填）。
const PAGES = [
  // A：武器別テンプレ（1:1 對應 14 武種）
  { slug: "taikentemplate", cb: "taiken", wt: "great-sword" },
  { slug: "tachitemplate", cb: "tachi", wt: "long-sword" },
  { slug: "katatekentemplate", cb: "katateken", wt: "sword-and-shield" },
  { slug: "soukentemplate", cb: "souken", wt: "dual-blades" },
  { slug: "hammertemplate", cb: "hammer", wt: "hammer" },
  { slug: "syuryouhuetemplate", cb: "syuryouhue", wt: "hunting-horn" },
  { slug: "lancetemplate", cb: "lance", wt: "lance" },
  { slug: "gunlancetemplete", cb: "gunlance", wt: "gunlance" }, // slug 拼字如站上（templete）
  { slug: "slashaxetemplate", cb: "slashaxe", wt: "switch-axe" },
  { slug: "chargeaxetemplate", cb: "chargeaxe", wt: "charge-blade" },
  { slug: "souchukontemplate", cb: "souchukon", wt: "insect-glaive" },
  { slug: "raitotemplate", cb: "raito", wt: "light-bowgun" },
  { slug: "heavytemplate", cb: "heavy", wt: "heavy-bowgun" },
  { slug: "yumitemplate", cb: "yumi", wt: "bow" },
  // C：特定流派配裝
  { slug: "kantuulight", cb: "kantuulight", wt: "light-bowgun" },
  { slug: "zanreturaito", cb: "zanreturaito", wt: "light-bowgun" },
  { slug: "kantuuyumi", cb: "kantuuyumi", wt: "bow" },
  { slug: "kaihukubue", cb: "kaihukubue", wt: "hunting-horn" },
  { slug: "reijineiru", cb: "reijineiru" }, // 武種不確定 → 不標 weaponType（選填）
  { slug: "teligatachi", cb: "teligatachi", wt: "long-sword" },
];

const args = process.argv.slice(2);
const REFRESH = args.includes("--refresh");
const LIST = args.includes("--list");
const ONLY = (() => {
  const a = args.find((x) => x.startsWith("--only="));
  return a ? a.slice("--only=".length).split(",") : null;
})();

// ---------- 抓取（快取 + 延遲） ----------
let lastFetch = 0;
async function fetchPage(slug) {
  const file = path.join(CACHE_DIR, `${slug}.html`);
  if (!REFRESH && fs.existsSync(file)) return fs.readFileSync(file, "utf8");
  const wait = lastFetch + REQUEST_DELAY_MS - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  const url = `${BASE}/${slug}`;
  console.log(`  ↓ ${url}`);
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  lastFetch = Date.now();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
  const html = await res.text();
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(file, html);
  return html;
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
/**
 * cell 內防具/武器名（比 cell 純文字精確）。Altema 把一件名字拆進多個 <a> 或夾 <br>：
 *   ① 單一 <a> 內含 <br>（カムラノ装<br>【上衣】覇）→ textOf 生空白 → 去除 → 一件；
 *   ② <br> 把一件拆成兩 <a>（ウツシ裏 ＋ 【御面】覇）→ 後綴段以「【」起 → 接回前一件；
 *   ③ 同格多件 A/B（…覇 ＋ 神凪・願【元結】）→ 後件不以「【」起 → 各自一件（首件為主、餘 altNames）。
 * href 不可靠（A/B 常共用系列頁 href）；改以「片段是否以【起」判定後綴 vs 新件。
 * 日文防具/武器名無內部空白，每段去空白後判斷。回 [每件完整名]。
 */
const linkTexts = (html) => {
  const parts = [];
  for (const m of html.matchAll(/<a[^>]*>([\s\S]*?)<\/a>/g)) {
    const name = textOf(m[1]).replace(/\s+/g, "");
    if (!name) continue;
    if (parts.length && name.startsWith("【")) parts[parts.length - 1] += name;
    else parts.push(name);
  }
  return parts;
};

/** table HTML → rows: [{cells:[{html,text}]}]；附 seriesbogu 連結數。 */
function parseTableRows(tableHtml) {
  const rows = [];
  for (const r of tableHtml.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)) {
    const cells = [...r[1].matchAll(/<(th|td)[^>]*>([\s\S]*?)<\/\1>/g)].map((c) => ({
      html: c[2],
      text: textOf(c[2]),
    }));
    if (cells.length) rows.push({ cells });
  }
  const seriesbogu = (tableHtml.match(/seriesbogu/g) || []).length;
  return { rows, seriesbogu };
}

/** 文章主體切出 H2/H3/table 序列；於「投稿／関連記事／注目記事／書き込み」段止步（其後皆為
 *  使用者投稿空樣板與導覽，非編輯部配裝）。 */
const STOP_HEADING = /投稿|関連記事|注目記事|書き込み|コメント|関連リンク/;
function articleTokens(html) {
  const tokens = [];
  const re = /<h2[^>]*>([\s\S]*?)<\/h2>|<h3[^>]*>([\s\S]*?)<\/h3>|<table[^>]*>[\s\S]*?<\/table>/g;
  let m;
  while ((m = re.exec(html))) {
    if (m[1] != null) {
      const t = textOf(m[1]);
      if (STOP_HEADING.test(t)) break;
      tokens.push({ kind: "h2", text: t });
    } else if (m[2] != null) {
      tokens.push({ kind: "h3", text: textOf(m[2]) });
    } else {
      tokens.push({ kind: "table", html: m[0] });
    }
  }
  return tokens;
}

/** 最終更新日：<time>最終更新：2024年1月10日(水) …。回原文摘要或 null。 */
function extractUpdateStamp(html) {
  const m = html.match(/<time[^>]*>([\s\S]*?)<\/time>/);
  if (!m) return null;
  const t = textOf(m[1]);
  return /更新|20\d\d/.test(t) ? t : null;
}

// ---------- 表格分類與解析 ----------
const PART_TO_SLOT = { 頭: "head", 胴: "chest", 腕: "arms", 腰: "waist", 脚: "legs" };
const PLACEHOLDER_RE = /^[×\-ー―−]?$/; // ×／- 佔位（模擬器空樣板）

const NAME_COL_RE = /防具名|武器名/; // 名稱欄可標「防具名」（分離式）或「武器名」（武器＋防具合表式）

function classifyTable(rows, seriesbogu) {
  if (!rows.length) return null;
  const h = rows[0].cells.map((c) => c.text);
  if (h[0] === "発動スキル") return "skills";
  if (h[0] === "武器名") return "weapon"; // 獨立武器表（h[0] 即「武器名」）
  // 具體配裝表：表頭第一格＝部位、含名稱欄、且有真實 seriesbogu 連結（排除全 ×/- 模擬器樣板）。
  // 兩種版面：分離式（部位|防具名|…）與合表式（部位|武器名|…，含一列 部位＝武器）。
  const hasPart = h[0] === "部位";
  const nameIdx = h.findIndex((x) => NAME_COL_RE.test(x));
  if (hasPart && nameIdx >= 0 && seriesbogu >= 4) {
    // 二次確認：至少一個部位列的防具名非佔位（排除 ×/- 空樣板）
    const real = rows
      .slice(1)
      .some((r) => PART_TO_SLOT[r.cells[0]?.text] && !PLACEHOLDER_RE.test((r.cells[nameIdx]?.text ?? "").trim()));
    if (real) return "armor";
  }
  return null;
}

// ○○／〇〇＝Altema 元素／弾種佔位符（○○属性攻撃強化／〇〇弾・〇〇矢強化）＝「配你武器屬性／
// 主用弾種自選對應強化」，非單一技能、無法對 ID。比照 Game8 placeholder：不進 targetSkills（否則
// 必然解析失敗、拖垮通過率），改收進 _extraction 供顯示端提示。
const PLACEHOLDER_SKILL_RE = /[○〇]{2}/;
/** 発動スキル表 → { skills:[{name,level}], placeholders:[string] }（原文技能名，交驗證器解析）。 */
function parseSkillTotals(rows) {
  const skills = [];
  const placeholders = [];
  for (const r of rows.slice(1)) {
    for (const c of r.cells) {
      const m = c.text.match(/^(.+?)\s*Lv\.?\s*(\d+)$/);
      if (!m) continue;
      const name = m[1].trim();
      if (PLACEHOLDER_SKILL_RE.test(name)) placeholders.push(`${name}Lv${m[2]}`);
      else skills.push({ name, level: Number(m[2]) });
    }
  }
  return { skills, placeholders };
}

/** 具體配裝表 → { armor:[{slot,name}], charmRaw, piecesRaw, weaponFromRow }
 *  合表式含一列 部位＝武器（武器與防具同表）→ 抽成 weaponFromRow（原文，不結構化）。 */
function parseArmorTable(rows) {
  const h = rows[0].cells.map((c) => c.text);
  const nameIdx = Math.max(0, h.findIndex((x) => NAME_COL_RE.test(x)));
  const slotColIdx = h.findIndex((x) => x.includes("スロ"));
  // 中欄（性能/斬れ味/パーツ/百竜強化…）＝名稱與孔位以外的欄，當作 per-piece 原文備註。
  const midColIdx = h.findIndex((x, i) => i > 0 && i !== nameIdx && !/スロ/.test(x));
  const armor = [];
  const piecesRaw = [];
  let charmRaw = null;
  let weaponFromRow = null;
  for (const r of rows.slice(1)) {
    const part = r.cells[0]?.text ?? "";
    if (part === "護石") {
      // 護石列版位左移（無名稱格）：其餘格皆原文摘要
      charmRaw = r.cells.slice(1).map((c) => c.text).filter(Boolean).join(" ／ ") || null;
      continue;
    }
    const nameCell = r.cells[nameIdx] ?? { text: "", html: "" };
    const links = linkTexts(nameCell.html); // 同格多件 A/B 時，取首件為主、其餘記 altNames
    const name = (links[0] ?? nameCell.text ?? "").trim();
    if (part === "武器") {
      if (name && !PLACEHOLDER_RE.test(name)) {
        const extra = [midColIdx >= 0 ? r.cells[midColIdx]?.text : null, slotColIdx >= 0 ? r.cells[slotColIdx]?.text : null]
          .filter((x) => x && !PLACEHOLDER_RE.test(x))
          .join(" ");
        weaponFromRow = { name, statsRaw: extra || null };
      }
      continue;
    }
    const slot = PART_TO_SLOT[part];
    if (!slot) continue;
    if (!name || PLACEHOLDER_RE.test(name)) continue;
    armor.push({ slot, name });
    piecesRaw.push({
      slot,
      name,
      ...(links.length > 1 ? { altNames: links.slice(1) } : {}),
      skillsRaw: midColIdx >= 0 ? r.cells[midColIdx]?.text ?? null : null,
      slotsRaw: slotColIdx >= 0 ? r.cells[slotColIdx]?.text ?? null : null,
    });
  }
  return { armor, charmRaw, piecesRaw, weaponFromRow };
}

/** 武器名表 → { name, statsRaw }（原文，不結構化）。結構：r0=武器名, r1=名稱, r2=規格表頭, r3=值。 */
function parseWeapon(rows) {
  const c0 = rows[1]?.cells[0] ?? { text: "", html: "" };
  const name = (linkTexts(c0.html)[0] ?? c0.text ?? "").trim() || null;
  if (!name) return null;
  // 後續列常為 切れ味/攻撃力/会心率 的表頭+值，拼成原文規格摘要
  const statsPairs = [];
  for (let i = 2; i + 1 < rows.length; i += 2) {
    const heads = rows[i].cells.map((c) => c.text);
    const vals = rows[i + 1].cells.map((c) => c.text);
    for (let j = 0; j < heads.length; j++) {
      if (heads[j] && vals[j]) statsPairs.push(`${heads[j]}${vals[j]}`);
    }
  }
  return { name, statsRaw: statsPairs.join(" ") || null };
}

// ---------- 頁面 → builds ----------
function parsePage(html, page, url, collectedAt, stats) {
  const tokens = articleTokens(html);
  const updateStamp = extractUpdateStamp(html);

  // 依文件順序組裝：武器表在前、配裝表、発動スキル表在後。
  // buildName 取 H2（配裝節標題，如「龍気活性装備:ナルガ武器」）——H3 多為 武器／防具／
  // 発動スキル 等通用子標籤，不適合當名。
  let h2 = null;
  let h3 = null;
  let pendingWeapon = null;
  let awaiting = null; // 等待 skills 表的 build
  const builds = [];

  for (const tk of tokens) {
    if (tk.kind === "h2") {
      h2 = tk.text;
      h3 = null;
      continue;
    }
    if (tk.kind === "h3") {
      h3 = tk.text;
      continue;
    }
    const heading = h2 || h3;
    const { rows, seriesbogu } = parseTableRows(tk.html);
    const type = classifyTable(rows, seriesbogu);
    if (stats) {
      stats.tables[type ?? "skipped"] = (stats.tables[type ?? "skipped"] ?? 0) + 1;
      if (type == null && rows.length) {
        const hdr = rows[0].cells.map((c) => c.text).join("｜").slice(0, 40) || "(空)";
        stats.skippedHeaders[hdr] = (stats.skippedHeaders[hdr] ?? 0) + 1;
      }
    }
    if (type === "weapon") {
      pendingWeapon = parseWeapon(rows);
    } else if (type === "armor") {
      const { armor, charmRaw, piecesRaw, weaponFromRow } = parseArmorTable(rows);
      const b = {
        heading,
        armor,
        charmRaw,
        piecesRaw,
        weapon: weaponFromRow || pendingWeapon, // 合表式優先取同表武器列
        targetSkills: [],
        placeholderSkills: [],
      };
      builds.push(b);
      awaiting = b;
      pendingWeapon = null;
    } else if (type === "skills") {
      if (awaiting && awaiting.targetSkills.length === 0) {
        const { skills, placeholders } = parseSkillTotals(rows);
        awaiting.targetSkills = skills;
        awaiting.placeholderSkills = placeholders;
        awaiting = null;
      }
    }
  }

  // builds → cb 物件
  const multi = builds.length > 1;
  return builds.map((b, i) => {
    const slug = `altema-${page.cb}${multi && i > 0 ? `-${i + 1}` : ""}`;
    const buildName = b.heading ? `${b.heading}` : `${page.cb} テンプレ装備`;
    const altPieces = b.piecesRaw.filter((p) => p.altNames?.length);
    const notesParts = [];
    if (b.weapon) notesParts.push(`武器：${b.weapon.name}${b.weapon.statsRaw ? `（${b.weapon.statsRaw}）` : ""}`);
    if (b.charmRaw) notesParts.push(`護石：${b.charmRaw}`);
    for (const p of altPieces) notesParts.push(`${p.slot} 可替換：${p.altNames.join(" / ")}`);
    if (b.placeholderSkills.length)
      notesParts.push(`屬性／弾種依武器自選：${b.placeholderSkills.join("、")}`);
    notesParts.push("逐孔珠與護石為 Altema 原文摘錄，精確孔位／珠子由配裝器 solver 以使用者資源計算。");

    const cb = {
      schemaVersion: 2,
      slug,
      buildName,
      ...(page.wt ? { weaponType: page.wt } : {}),
      armor: b.armor,
      targetSkills: b.targetSkills,
      ...(updateStamp ? { publishedAt: updateStamp } : {}),
      notes: notesParts.join("\n"),
      source: {
        platform: "altema",
        author: "アルテマ",
        url,
        collectedAt,
      },
      // 中繼欄位（驗證忽略、上架前刪）：原文段落與抽取自評。
      _extraction: {
        pageSlug: page.slug,
        heading: b.heading,
        weaponRaw: b.weapon,
        charmRaw: b.charmRaw,
        placeholderSkills: b.placeholderSkills,
        pieces: b.piecesRaw,
        confidence: {
          armor: b.armor.length === 5 ? "high" : `low(${b.armor.length}/5)`,
          targetSkills: b.targetSkills.length ? "high" : "missing",
        },
      },
    };
    return cb;
  });
}

// ---------- --list：只讀快取索引印候選 ----------
function runList() {
  const idxFile = path.join(CACHE_DIR, "_index_jouitemplate.html");
  if (!fs.existsSync(idxFile)) {
    console.error(`✗ 索引快取不存在：${idxFile}（先跑一次抓取，或 --refresh）`);
    process.exit(1);
  }
  const html = fs.readFileSync(idxFile, "utf8");
  const re = /href="(?:https:\/\/altema\.jp)?\/mhrize\/([a-z0-9_-]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  const seen = new Map();
  let m;
  while ((m = re.exec(html))) if (!seen.has(m[1])) seen.set(m[1], textOf(m[2]));
  console.log(`索引 ${idxFile}：${seen.size} distinct /mhrize/ slugs`);
  console.log(`核可爬取集（A+C，${PAGES.length} 頁）：`);
  for (const p of PAGES) console.log(`  ${p.slug}  ::  ${(seen.get(p.slug) ?? "(索引未見)").slice(0, 40)}`);
}

// ---------- main ----------
async function main() {
  if (LIST) return runList();
  const collectedAt = new Date().toISOString().slice(0, 10);
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const pages = PAGES.filter((p) => !ONLY || ONLY.includes(p.cb));
  const written = [];
  const perPage = [];
  const stats = { tables: {}, skippedHeaders: {} };
  for (const page of pages) {
    let html;
    try {
      html = await fetchPage(page.slug);
    } catch (e) {
      console.error(`  ✗ ${page.slug}: ${e.message}`);
      perPage.push({ page: page.slug, builds: 0, error: e.message });
      continue;
    }
    const url = `${BASE}/${page.slug}`;
    const cbs = parsePage(html, page, url, collectedAt, stats);
    for (const cb of cbs) {
      const file = path.join(OUT_DIR, `cb_${cb.slug}.json`);
      fs.writeFileSync(file, JSON.stringify(cb, null, 2) + "\n");
      written.push(cb);
    }
    perPage.push({
      page: page.slug,
      builds: cbs.length,
      armorOk: cbs.filter((c) => c.armor.length === 5).length,
      skillsOk: cbs.filter((c) => c.targetSkills.length > 0).length,
    });
    console.log(`  ${page.slug}: ${cbs.length} build(s)`);
  }

  // 抽取率報告
  const total = written.length;
  const armor5 = written.filter((c) => c.armor.length === 5).length;
  const withSkills = written.filter((c) => c.targetSkills.length > 0).length;
  const withWeapon = written.filter((c) => c._extraction.weaponRaw).length;
  const withCharm = written.filter((c) => c._extraction.charmRaw).length;
  console.log(`\n✓ 產出 ${total} 檔 → ${path.relative(ROOT, OUT_DIR)}`);
  console.log(
    `  抽取率：防具5件 ${armor5}/${total}、目標技能≥1 ${withSkills}/${total}、` +
      `武器 ${withWeapon}/${total}、護石 ${withCharm}/${total}`
  );
  const report = {
    generatedAt: collectedAt,
    source: "Altema（altema.jp/mhrize）武器別テンプレ装備＋特定流派配裝（A+C 集）",
    pagesCrawled: pages.length,
    buildsExtracted: total,
    extractionRates: {
      armorFive: `${armor5}/${total}`,
      targetSkills: `${withSkills}/${total}`,
      weaponProse: `${withWeapon}/${total}`,
      charmProse: `${withCharm}/${total}`,
    },
    // 表格分類統計：armor/skills/weapon＝採用；skipped＝表頭不符（必要素材／解説／入れ替え技等）與
    // 「投稿」段後的空樣板（於 STOP_HEADING 止步前不計）。skippedHeaders＝被略過表的表頭樣本＋次數。
    tableStats: stats.tables,
    skippedHeaders: Object.fromEntries(
      Object.entries(stats.skippedHeaders).sort((a, b) => b[1] - a[1])
    ),
    perPage,
  };
  fs.writeFileSync(path.join(OUT_DIR, "_extraction-report.json"), JSON.stringify(report, null, 2) + "\n");
  console.log(`  報告 → ${path.relative(ROOT, path.join(OUT_DIR, "_extraction-report.json"))}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
