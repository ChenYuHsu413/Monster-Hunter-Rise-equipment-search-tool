#!/usr/bin/env node
/**
 * 社群配裝驗證器 — 驗證 data/community-builds/cb_*.json（一檔一套，schema v2）。
 *
 * 社群來源（巴哈／Altema／NGA／人工收錄）多半只有「文字骨架」＝防具＋目標技能；
 * 精確孔位／珠子／護石由使用者匯入配裝器後、以自身資源用 decoration-solver 計算。
 * 故 schema 以骨架為必填、細節為選填；『選填欄位缺失是合法狀態，不是資料錯誤』。
 *
 * 檢查：
 *  (1) 必填齊全（防具五件／目標技能／source）。
 *  (2) 名稱解析到專案 ID：繁中直接比 → 日文過 data/jp-name-map.json →
 *      簡中過 data/cn-name-map.json + data/cn-name-overrides.json（命中後對映射值再解析一次）。
 *  (3) 技能等級 ≤ maxLevel（skills.json）。
 *  (4) 若有填孔位／裝飾品才驗合法性（珠解析＋裝進孔位）；沒填就跳過。
 *
 * 比不到的名稱『絕不猜測』：彙整進 <掃描目錄>.suggestions.json（附幾個子字串候選當提示，非裁決）；
 * 人工裁決收進 data/cn-name-overrides.json（簡中）／既有 data/jp-name-overrides.json（日文）。
 *
 * 任一檔不過 → 列出檔名＋逐條原因，退出碼 1。
 * 用法：node scripts/validate-community-builds.mjs [--dir <目錄>]（預設 data/community-builds）
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeJa } from "./game8-normalize.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const SRC = path.join(ROOT, "src", "data");
const DATA = path.join(ROOT, "data");

// ---------- schemaDoc（唯一真相來源；src/types/community.ts 引用本常數） ----------
const SCHEMA_DOC = {
  file: "一檔一套配裝，路徑 data/community-builds/cb_{slug}.json；slug 須與檔名一致。",
  philosophy:
    "社群來源多為文字骨架（防具＋目標技能）。精確孔位／珠子／護石由使用者匯入配裝器後、以自身資源用 decoration-solver 計算。故骨架必填、細節選填；選填缺失＝合法，不得當資料錯誤。",
  required: {
    schemaVersion: "固定為 2。",
    slug: "字串，須等於檔名的 {slug}（cb_{slug}.json）。",
    buildName: "顯示標題（字串，非空）。",
    armor:
      "具體防具件陣列，每件 { slot: head|chest|arms|waist|legs, name }；不得重複部位。name 可為專案內部 id（armor_*）或可解析的繁中／日文／簡中名。搭配 flexSlots：armor 的部位 ＋ flexSlots 須『恰覆蓋五部位、不重不漏』。無 flexSlots 時即恰 5 件。",
    targetSkills:
      "目標技能列表（≥1），每筆 { name, level }；name 解析到專案技能、level 為 1..maxLevel。這是匯出到配裝器的核心輸入（技能條件）。",
    source:
      "{ platform, author, url, collectedAt }。platform ∈ bahamut|altema|nga|bilibili|youtube|other；author／url／collectedAt 皆非空字串。",
  },
  optional: {
    placeholder: "true＝示範／佔位資料，UI 標『示範資料』。",
    flexSlots:
      "彈性孔部位陣列（B 最強系列的『自由枠(任意)』部位）。這些部位不指定固定防具、匯出時不鎖，留給 solver 以使用者資源填。armor 部位 ＋ flexSlots 須恰覆蓋五部位（不重不漏）。",
    weaponType: "武器類別 id（weaponTypes.json）；泛用防具骨架可不綁武器而省略。",
    weapon:
      "{ name, slots?, rampageDecorations? }。name 解析到武器 id；slots＝洞位等級陣列；rampageDecorations＝[{ name, count? }]（百龍裝飾品，解析到 rampage-decorations id）。",
    "armor[].decorations":
      "該部位逐孔裝飾品 [{ name, count? }]。有填才驗：珠解析到 deco id、且能裝進該防具（專案資料）的孔位。",
    "armor[].augment": "傀異錬成內容，原文字串照抄（專案不模擬，不驗）。",
    talisman:
      "{ skills?, slots?, decorations? }。skills=[{name,level}]（level≤maxLevel）；slots＝孔位等級陣列；decorations 有填才驗裝孔合法性。",
    gameVersion: "遊戲版本字串（如 TU5）。",
    publishedAt: "原文發布日期字串。",
    notes: "原文重點摘記。",
  },
  resolution:
    "名稱解析序：專案 id 直接命中 → 繁中直接比（armors/weapons/decorations 比 nameZh、skills 比 name）→ 日文過 data/jp-name-map.json → 簡中過 data/cn-name-overrides.json（優先）＋ data/cn-name-map.json。命中映射後對映射值『再解析一次』，故映射值可填 id 或繁中名皆可。日文名沿用既有 jp-name-overrides，不另立；簡中裁決收進 cn-name-overrides。",
  suggestions:
    "比不到的名稱彙整進 <掃描目錄>.suggestions.json（附子字串候選當提示，非裁決；絕不自動填入）。",
};

// ---------- 載入專案資料，建索引 ----------
const readJson = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
const armors = readJson(path.join(SRC, "armors.json"));
const weapons = readJson(path.join(SRC, "weapons.json"));
const decorations = readJson(path.join(SRC, "decorations.json"));
const skills = readJson(path.join(SRC, "skills.json"));
const rampageDecos = readJson(path.join(SRC, "rampage-decorations.json"));
const weaponTypeIds = new Set(readJson(path.join(SRC, "weaponTypes.json")).map((x) => x.id));

const skillMax = new Map(skills.map((s) => [s.name, s.maxLevel]));
const decoSlotLevel = new Map(decorations.map((d) => [d.id, d.slotLevel]));
const armorSlots = new Map(armors.map((a) => [a.id, a.slots ?? []]));
const weaponSlots = new Map(weapons.map((w) => [w.id, w.slots ?? []]));

// 名稱正規化＝共用 scripts/game8-normalize.js 的 normalizeJa（NFKC＋去所有空白＋盤→磐 異體字
// ＋latin 大寫）。★關鍵：build-jp-name-map.js 建 jp-name-map 的鍵就是用 normalizeJa，故查表這端
// 必須用同一套，否則「建表 vs 查表」正規化漂移（曾因此 nfkc 少了盤→磐折疊，Altema 顕如盤石(U+76E4)
// 對不到 jp-map 的 顕如磐石(U+78D0)→堅若磐石）。src/lib/community-builds.ts 的 nfkc 為 app 端鏡像，
// 規則須與本函式逐條同步（見該檔交叉註解與 battery case）。
const nfkc = (s) => normalizeJa(s);

// type → NFKC(名稱鍵) → 專案標準身分（skills=原始技能名、其餘=id）。id 與繁中名皆入鍵，
// 兩側都 NFKC 正規化（如全形羅馬數字 Ⅱ→II），映射值保留原始身分供 skillMax/slot 查表。
// zhList＝(顯示名, id) 供 suggestions 子字串提示（用原始未正規化名顯示）。
function buildIndex(rows, idOf, zhOf) {
  const map = new Map();
  const zhList = [];
  for (const r of rows) {
    const id = idOf(r);
    map.set(nfkc(id), id);
    const zh = zhOf(r);
    if (zh != null) {
      map.set(nfkc(zh), id);
      zhList.push([zh, id]);
    }
  }
  return { map, zhList };
}
const IDX = {
  skills: buildIndex(skills, (s) => s.name, () => null),
  armors: buildIndex(armors, (a) => a.id, (a) => a.nameZh),
  weapons: buildIndex(weapons, (w) => w.id, (w) => w.nameZh),
  decorations: buildIndex(decorations, (d) => d.id, (d) => d.nameZh),
  rampageDecorations: buildIndex(rampageDecos, (d) => d.id, (d) => d.nameZh),
};

const jpMap = readJson(path.join(DATA, "jp-name-map.json"));
const cnMap = readJson(path.join(DATA, "cn-name-map.json"));
const cnOverrides = readJson(path.join(DATA, "cn-name-overrides.json"));

/** 把映射值收斂成專案標準身分（id／技能名）；比不到回 null。 */
function canonicalize(type, v) {
  return IDX[type].map.get(nfkc(v)) ?? null;
}

/** 解析名稱到專案 id：id 直命 → 繁中 → 日文 → 簡中。回 id 或 null。 */
function resolveName(type, name) {
  const raw = nfkc(name);
  const direct = canonicalize(type, raw); // id 直命 + 繁中
  if (direct) return direct;
  const jp = jpMap[type]?.[raw];
  if (jp != null) return canonicalize(type, jp);
  const cnO = cnOverrides[type]?.[raw]; // 覆寫優先
  if (cnO != null) return canonicalize(type, cnO);
  const cn = cnMap[type]?.[raw];
  if (cn != null) return canonicalize(type, cn);
  return null;
}

/** 貪婪裝孔：每顆珠（依 slotLevel 由大到小）塞進最小可容納的空孔。裝不下回 false。 */
function decosFit(availableSlots, decoSlotLevels) {
  const slots = [...availableSlots].sort((a, b) => b - a);
  const need = [...decoSlotLevels].sort((a, b) => b - a);
  for (const lvl of need) {
    // 由小到大找第一個 ≥ lvl 的空孔
    let pick = -1;
    for (let i = slots.length - 1; i >= 0; i--) {
      if (slots[i] >= lvl) pick = i;
    }
    if (pick === -1) return false;
    slots.splice(pick, 1);
  }
  return true;
}

// ---------- 逐檔驗證 ----------
const ARMOR_SLOTS = ["head", "chest", "arms", "waist", "legs"];
const PLATFORMS = new Set(["bahamut", "altema", "nga", "bilibili", "youtube", "other"]);

const argDir = (() => {
  const i = process.argv.indexOf("--dir");
  return i >= 0 && process.argv[i + 1] ? path.resolve(process.argv[i + 1]) : path.join(DATA, "community-builds");
})();

const unresolved = new Map(); // `${type}:${raw}` -> { type, rawName, files:Set }

function noteUnresolved(type, rawName, file) {
  const key = `${type}:${nfkc(rawName)}`;
  const e = unresolved.get(key) ?? { type, rawName: nfkc(rawName), files: new Set() };
  e.files.add(file);
  unresolved.set(key, e);
}

/** 解析並在失敗時記錯＋記 suggestion。回 id 或 null。 */
function resolveOrError(type, name, file, errs, ctx) {
  if (typeof name !== "string" || !name.trim()) {
    errs.push(`${ctx}：名稱缺失或非字串`);
    return null;
  }
  const id = resolveName(type, name);
  if (id == null) {
    errs.push(`${ctx}：名稱「${name}」解析不到專案 ${type}（見 suggestions）`);
    noteUnresolved(type, name, file);
  }
  return id;
}

function validateFile(file) {
  const errs = [];
  let build;
  try {
    build = readJson(file);
  } catch (e) {
    return [`JSON 解析失敗：${e.message}`];
  }
  const base = path.basename(file);

  // --- schemaVersion / slug ---
  if (build.schemaVersion !== 2) errs.push(`schemaVersion 必須為 2（實得 ${JSON.stringify(build.schemaVersion)}）`);
  const expectSlug = base.replace(/^cb_/, "").replace(/\.json$/, "");
  if (typeof build.slug !== "string" || !build.slug.trim()) errs.push("缺 slug");
  else if (build.slug !== expectSlug) errs.push(`slug「${build.slug}」與檔名不符（應為「${expectSlug}」）`);

  // --- buildName ---
  if (typeof build.buildName !== "string" || !build.buildName.trim()) errs.push("缺 buildName");

  // --- source ---
  const s = build.source;
  if (!s || typeof s !== "object") errs.push("缺 source 物件");
  else {
    if (!PLATFORMS.has(s.platform)) errs.push(`source.platform「${s.platform}」不在允許值（${[...PLATFORMS].join("/")}）`);
    for (const k of ["author", "url", "collectedAt"]) {
      if (typeof s[k] !== "string" || !s[k].trim()) errs.push(`缺 source.${k}`);
    }
  }

  // --- armor + flexSlots（必填：五部位齊；具體防具件 + 自由枠彈性孔恰覆蓋 head/chest/arms/waist/legs，
  //     不重不漏）。flexSlots＝作者標「自由枠(任意)」的部位（B 最強系列常見）：不指定固定防具、
  //     匯出時該部位不鎖，留給 solver 以使用者資源填。 ---
  const flexSlots = Array.isArray(build.flexSlots) ? build.flexSlots : [];
  if (build.flexSlots != null && !Array.isArray(build.flexSlots)) errs.push("flexSlots 須為部位名陣列");
  if (!Array.isArray(build.armor)) {
    errs.push("armor 必須為陣列");
  } else {
    const seen = new Set();
    for (let i = 0; i < build.armor.length; i++) {
      const p = build.armor[i] ?? {};
      if (!ARMOR_SLOTS.includes(p.slot)) errs.push(`armor[${i}].slot「${p.slot}」非法（須 ${ARMOR_SLOTS.join("/")}）`);
      else if (seen.has(p.slot)) errs.push(`armor 部位「${p.slot}」重複`);
      else seen.add(p.slot);
      const id = resolveOrError("armors", p.name, file, errs, `armor[${i}]`);
      // 逐孔裝飾品（選填）：有填才驗
      if (id && Array.isArray(p.decorations) && p.decorations.length) {
        const levels = [];
        for (let j = 0; j < p.decorations.length; j++) {
          const d = p.decorations[j];
          const did = resolveOrError("decorations", d?.name, file, errs, `armor[${i}].decorations[${j}]`);
          if (did) for (let c = 0; c < (d.count ?? 1); c++) levels.push(decoSlotLevel.get(did));
        }
        const slots = armorSlots.get(id) ?? [];
        if (levels.length && !decosFit(slots, levels))
          errs.push(`armor[${i}]「${p.name}」的裝飾品裝不進孔位（孔 [${slots.join(",")}]、珠等級 [${levels.join(",")}]）`);
      }
    }
    // 自由枠部位：須為合法部位、且與 armor 或自身不重複
    for (let i = 0; i < flexSlots.length; i++) {
      const s = flexSlots[i];
      if (!ARMOR_SLOTS.includes(s)) errs.push(`flexSlots[${i}]「${s}」非法（須 ${ARMOR_SLOTS.join("/")}）`);
      else if (seen.has(s)) errs.push(`flexSlots 部位「${s}」與 armor 或自身重複`);
      else seen.add(s);
    }
    // 五部位齊：具體件 + 自由枠 = 恰 5 相異部位
    if (seen.size !== 5)
      errs.push(
        `防具部位不齊：armor(${build.armor.length}) ＋ flexSlots(${flexSlots.length}) 須恰覆蓋 5 部位（實得相異 ${seen.size}）`
      );
  }

  // --- targetSkills（必填）---
  if (!Array.isArray(build.targetSkills) || build.targetSkills.length === 0) {
    errs.push("缺 targetSkills（至少 1 筆）");
  } else {
    for (let i = 0; i < build.targetSkills.length; i++) {
      const t = build.targetSkills[i] ?? {};
      const id = resolveOrError("skills", t.name, file, errs, `targetSkills[${i}]`);
      if (id != null) {
        const max = skillMax.get(id);
        if (!Number.isInteger(t.level) || t.level < 1) errs.push(`targetSkills[${i}]「${t.name}」level 須為 ≥1 整數`);
        else if (t.level > max) errs.push(`targetSkills[${i}]「${t.name}」level ${t.level} 超過 maxLevel ${max}`);
      }
    }
  }

  // --- weaponType（選填）---
  if (build.weaponType != null && !weaponTypeIds.has(build.weaponType))
    errs.push(`weaponType「${build.weaponType}」非法`);

  // --- weapon（選填）---
  if (build.weapon != null) {
    const w = build.weapon;
    const wid = resolveOrError("weapons", w.name, file, errs, "weapon");
    for (let j = 0; j < (w.rampageDecorations ?? []).length; j++) {
      resolveOrError("rampageDecorations", w.rampageDecorations[j]?.name, file, errs, `weapon.rampageDecorations[${j}]`);
    }
    // 武器珠（選填）：有填才驗（slots 取檔內 weapon.slots，否則專案武器 slots）
    if (wid && Array.isArray(w.decorations) && w.decorations.length) {
      const levels = [];
      for (let j = 0; j < w.decorations.length; j++) {
        const did = resolveOrError("decorations", w.decorations[j]?.name, file, errs, `weapon.decorations[${j}]`);
        if (did) for (let c = 0; c < (w.decorations[j].count ?? 1); c++) levels.push(decoSlotLevel.get(did));
      }
      const slots = Array.isArray(w.slots) ? w.slots : weaponSlots.get(wid) ?? [];
      if (levels.length && !decosFit(slots, levels))
        errs.push(`weapon 的裝飾品裝不進孔位（孔 [${slots.join(",")}]、珠等級 [${levels.join(",")}]）`);
    }
  }

  // --- talisman（選填）---
  if (build.talisman != null) {
    const tal = build.talisman;
    for (let i = 0; i < (tal.skills ?? []).length; i++) {
      const t = tal.skills[i] ?? {};
      const id = resolveOrError("skills", t.name, file, errs, `talisman.skills[${i}]`);
      if (id != null) {
        const max = skillMax.get(id);
        if (!Number.isInteger(t.level) || t.level < 1) errs.push(`talisman.skills[${i}]「${t.name}」level 須為 ≥1 整數`);
        else if (t.level > max) errs.push(`talisman.skills[${i}]「${t.name}」level ${t.level} 超過 maxLevel ${max}`);
      }
    }
    if (Array.isArray(tal.decorations) && tal.decorations.length) {
      const levels = [];
      for (let j = 0; j < tal.decorations.length; j++) {
        const did = resolveOrError("decorations", tal.decorations[j]?.name, file, errs, `talisman.decorations[${j}]`);
        if (did) for (let c = 0; c < (tal.decorations[j].count ?? 1); c++) levels.push(decoSlotLevel.get(did));
      }
      const slots = Array.isArray(tal.slots) ? tal.slots : [];
      if (levels.length && !decosFit(slots, levels))
        errs.push(`talisman 的裝飾品裝不進孔位（孔 [${slots.join(",")}]、珠等級 [${levels.join(",")}]）`);
    }
  }

  return errs;
}

// ---------- 主流程 ----------
if (!fs.existsSync(argDir)) {
  console.error(`✗ 找不到目錄：${argDir}`);
  process.exit(1);
}
const files = fs
  .readdirSync(argDir)
  .filter((f) => f.startsWith("cb_") && f.endsWith(".json"))
  .sort()
  .map((f) => path.join(argDir, f));

console.log(`掃描 ${argDir}：${files.length} 檔`);
let failCount = 0;
for (const file of files) {
  const errs = validateFile(file);
  const base = path.basename(file);
  if (errs.length) {
    failCount++;
    console.log(`\n✗ ${base}（${errs.length} 條）`);
    for (const e of errs) console.log(`    · ${e}`);
  } else {
    console.log(`  ✓ ${base}`);
  }
}

// suggestions 檔（附子字串候選當提示，不裁決）
const sugPath = path.join(path.dirname(argDir), path.basename(argDir) + ".suggestions.json");
if (unresolved.size) {
  const items = [...unresolved.values()].map(({ type, rawName, files }) => {
    const raw = nfkc(rawName);
    const hints = IDX[type].zhList
      .filter(([zh]) => zh.includes(raw) || raw.includes(zh))
      .slice(0, 3)
      .map(([zh, id]) => ({ nameZh: zh, id }));
    return { type, rawName: raw, files: [...files].map((f) => path.basename(f)), hints };
  });
  fs.writeFileSync(
    sugPath,
    JSON.stringify(
      { $comment: "社群配裝比不到的名稱。hints 僅為子字串提示、非裁決。人工確認後：簡中填 data/cn-name-overrides.json、日文填 data/jp-name-overrides.json。", items },
      null,
      2
    ) + "\n"
  );
  console.log(`\n未解析名稱 ${items.length} 種 → ${path.relative(ROOT, sugPath)}`);
} else if (fs.existsSync(sugPath)) {
  fs.rmSync(sugPath);
}

if (failCount) {
  console.error(`\n✗ ${failCount}/${files.length} 檔未過驗證。`);
  process.exit(1);
}
console.log(`\n✓ 全部 ${files.length} 檔通過。`);
