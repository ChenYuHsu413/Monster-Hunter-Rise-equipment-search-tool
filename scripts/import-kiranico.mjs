// @ts-nocheck
/**
 * Kiranico 匯入器 — 從 mhrise.kiranico.com（正體中文、Sunbreak Ver16 / TU5）
 * 抓取「技能 / 裝飾珠 / 防具」的權威資料,轉成本專案 JSON 格式。
 *
 * 資料來源均為公開 HTML（伺服器渲染的表格),以純 regex 解析（結構穩定)。
 * 部位（head/chest/arms/waist/legs)Kiranico 未文字標註,以「後綴/【】token 關鍵字
 * + 系列內位置游標」混合判定（詳見 classifyPart)。
 *
 * 用法：node scripts/import-kiranico.mjs
 * 產出：src/data/skills.json, decorations.json, armors.json
 *
 * 注意：此為建置時腳本,不進 app bundle。重跑即可更新資料。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "src", "data");
const BASE = "https://mhrise.kiranico.com/zh-Hant/data";
const UA = { "User-Agent": "Mozilla/5.0 (data import for personal armor builder)" };

/**
 * Kiranico 對部分技能（多為套裝加成/新技能)未提供逐級說明,頁面推不出上限。
 * 這裡以「穩定且眾所周知的遊戲常數」補上這些技能的最大等級（僅補頁面缺漏者)。
 */
const KNOWN_MAX = {
  連擊: 5,
  寒氣鍊成: 3,
  天衣無縫: 3,
  伏魔響命: 3,
  血氣: 3,
  巧擊: 3,
  攻勢: 3,
  奇襲: 3,
  緩衝: 3,
  堅若磐石: 3,
  蓄力大師: 3,
  款待: 3,
  "研磨術【銳】": 3,
  "業鎧【修羅】": 1,
  "狂龍症【蝕】": 1,
  "狂龍症【翔】": 1,
  粉塵飛舞: 1,
  暴風纏身: 1,
  剛心: 1,
  合氣: 1,
  刃鱗研磨: 1,
  迅疾吐納: 1,
  "飛簷走壁【翔】": 1,
  龍氣轉換: 1,
  血氣覺醒: 1,
  激勵: 1,
};

/** 高風險 / 高價值特殊技能（影響評分)。以名稱子字串比對。 */
const SPECIAL_SKILLS = [
  "業鎧", "修羅", "狂龍症", "伏魔", "狂化", "冰氣鍊成", "粉塵",
  "風纏", "天衣無崩", "血氣", "催眠獸", "鋼殼", "整備", "災禍",
  "鎧【", "煉獄", "赫耀", "災厄",
];

/**
 * 依稀有度推算的階級標籤（村 / HR / MR）。
 * 這是 Sunbreak 稀有度慣例的推算值：1-3 通常為村莊/初期任務,4-7 為集會所（HR),
 * 8-10 為傀異/傀異克服等 Master Rank 內容。並非精確的「第幾星緊急任務解放」資訊——
 * Kiranico 的防具/武器列表頁不提供逐怪物解放任務資料，若要更精確需另外對照任務資料。
 */
function rankByRarity(rarity) {
  if (rarity == null) return undefined;
  if (rarity <= 3) return "村";
  if (rarity <= 7) return "HR";
  return "MR";
}

/** 一組字串的最長共同前綴（用於推算防具/武器系列名）。 */
function longestCommonPrefix(strs) {
  if (strs.length === 0) return "";
  let prefix = strs[0];
  for (const s of strs.slice(1)) {
    let i = 0;
    while (i < prefix.length && i < s.length && prefix[i] === s[i]) i++;
    prefix = prefix.slice(0, i);
    if (!prefix) break;
  }
  // 去除尾端懸空的連接字/半個括號（例如「冥淵纏鎧憤怒之」「神火裝【」）。
  return prefix.replace(/[之的【（(]+$/, "").trim();
}

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

/**
 * 取出 <tbody>…</tbody> 內的每個 <tr>…</tr> 原始 HTML（以深度計數處理巢狀 <tr>，
 * 例如弩槍頁彈藥表本身也有 <tr>，naive 的 non-greedy regex 會在內層就提早截斷)。
 */
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

// ---------------- 技能 ----------------
function parseSkills(html) {
  const out = [];
  for (const row of tableRows(html)) {
    // 技能清單頁：名稱在 skills/ 連結內的巢狀 <p> 裡（非 anchor 文字)
    const name = row.match(/data\/skills\/\d+"[\s\S]*?<p[^>]*>([^<]+)<\/p>/);
    if (!name) continue;
    // 只有「有填等級說明」的 LvN 可信（Kiranico 把每個技能都補滿 8 列空 <small>）。
    const levels = [...row.matchAll(/Lv(\d+)/g)].map((m) => Number(m[1]));
    const pageMax = levels.length ? Math.max(...levels) : 0; // 0 = 頁面未提供
    const nm = name[1].trim();
    out.push({
      name: nm,
      maxLevel: pageMax, // 之後與裝備實際觀察到的最高等級取大值
      special: SPECIAL_SKILLS.some((s) => nm.includes(s)) || undefined,
    });
  }
  // 去重（保留較大 maxLevel)
  const map = new Map();
  for (const s of out) {
    const cur = map.get(s.name);
    if (!cur || s.maxLevel > cur.maxLevel) map.set(s.name, s);
  }
  return [...map.values()];
}

// ---------------- 裝飾珠 ----------------
function slug(s) {
  return s.replace(/[^\w一-鿿]+/g, "_").replace(/^_|_$/g, "");
}

function parseDecorations(html) {
  const out = [];
  for (const row of tableRows(html)) {
    const deco = row.match(/data\/decorations\/(\d+)">([^<]+)<\/a>/);
    if (!deco) continue;
    const skill = row.match(/data\/skills\/\d+">([^<]+)<\/a>\s*Lv(\d+)/);
    if (!skill) continue;
    const nameZh = deco[2].trim();
    const slotMatch = nameZh.match(/【(\d)】/);
    const slotLevel = slotMatch ? Number(slotMatch[1]) : 1;
    out.push({
      id: `deco_${deco[1]}`,
      nameZh,
      slotLevel,
      skillName: skill[1].trim(),
      skillLevel: Number(skill[2]),
      craftable: true,
    });
  }
  return out;
}

// ---------------- 防具 ----------------
const PARTS = ["head", "chest", "arms", "waist", "legs"];
const PART_KW = [
  ["head", /頭|首|帽|兜|面|髮|冠|角|耳|盔|額|眼鏡|髑|羽飾|假髮|頭巾|マスク|覆面|鉢金|羽冠/],
  ["chest", /胴|胸|鎧甲|鎧|軀|羽織|宿衣|鎖甲|胸甲|肌肉|甲冑|上衣|服|衣|外套|メイル|甲殼/],
  ["arms", /腕|臂|篭手|大袖|臂甲|手甲|雙手|棘|籠手|手套|之手/],
  ["waist", /腰|帶|臍帶|圓帶|腰具|尾|腹|フォールド/],
  ["legs", /脚|足|腿|護腿|腳跟|下裳|脚絆|靴|グリーヴ|褲|袴/],
];

/** 取部位判定用的 token：最後一組【】內容,否則名稱末 3 字。 */
function partToken(name) {
  const brackets = [...name.matchAll(/【([^】]*)】/g)];
  if (brackets.length) return brackets[brackets.length - 1][1];
  return name.slice(-3);
}
function classifyPartKW(name) {
  const t = partToken(name);
  for (const [p, re] of PART_KW) if (re.test(t)) return p;
  return null;
}

function parseArmorRow(row, rarity) {
  const nameM = row.match(/data\/armors\/(\d+)">([^<]+)<\/a>/);
  if (!nameM) return null;
  const id = `armor_${nameM[1]}`;
  const nameZh = nameM[2].trim();
  const slots = [...row.matchAll(/deco(\d)\.png/g)].map((m) => Number(m[1]));
  // 技能：<a ...>名稱</a> Lv{N}
  const skills = {};
  for (const m of row.matchAll(/data\/skills\/\d+">([^<]+)<\/a>\s*Lv(\d+)/g)) {
    skills[m[1].trim()] = (skills[m[1].trim()] ?? 0) + Number(m[2]);
  }
  // 防禦力：stats 欄第一個純數字 <div>
  const defM = row.match(/<div>\s*(\d+)\s*<\/div>/);
  const defense = defM ? Number(defM[1]) : undefined;
  return { id, nameZh, slots, skills, defense, rarity };
}

function parseArmorView(html, rarity) {
  const pieces = [];
  let cursor = 0; // 部位游標,每個 view 從 head 開始
  // 系列分組：與部位判定共用同一套「新系列從 head 開始」邏輯,
  // 每次判定為 head（不論是關鍵字或游標歸零）就視為新系列起點。
  let currentSeries = [];
  const flushSeries = () => {
    if (currentSeries.length === 0) return;
    const seriesName = longestCommonPrefix(currentSeries.map((p) => p.nameZh));
    for (const p of currentSeries) p.seriesName = seriesName || undefined;
    pieces.push(...currentSeries);
    currentSeries = [];
  };

  for (const row of tableRows(html)) {
    const p = parseArmorRow(row, rarity);
    if (!p) continue;
    const kw = classifyPartKW(p.nameZh);
    const part = kw || PARTS[cursor];
    if (part === "head") flushSeries();
    if (kw) cursor = PARTS.indexOf(kw);
    cursor = (cursor + 1) % 5;
    currentSeries.push({
      id: p.id,
      nameZh: p.nameZh,
      part,
      rarity: p.rarity,
      rankLabel: rankByRarity(p.rarity),
      slots: p.slots,
      skills: p.skills,
      ...(p.defense != null ? { defense: p.defense } : {}),
    });
  }
  flushSeries();
  return pieces;
}

// ---------------- 武器 ----------------
/** Kiranico /data/weapons?view=N 的 view 順序（與武器選單一致）。 */
const WEAPON_TYPE_BY_VIEW = [
  "great-sword", // 0 大劍
  "sword-and-shield", // 1 單手劍
  "dual-blades", // 2 雙劍
  "long-sword", // 3 太刀
  "hammer", // 4 大錘
  "hunting-horn", // 5 狩獵笛
  "lance", // 6 長槍
  "gunlance", // 7 銃槍
  "switch-axe", // 8 斬擊斧
  "charge-blade", // 9 充能斧
  "insect-glaive", // 10 操蟲棍
  "bow", // 11 弓
  "heavy-bowgun", // 12 重弩
  "light-bowgun", // 13 輕弩
];

/**
 * 屬性代碼 → 型別。1-5（火水雷冰龍）已以武器名稱交叉驗證（例如「王刀雷切」= 雷）。
 * 6-9（毒/睡眠/麻痺/爆破）採用 MH 系列常見的資料排序慣例，信心度較低，
 * 但不影響搜尋硬條件（僅五屬性才觸發 autoRules），純屬顯示用途。
 */
const ELEMENT_TYPE_BY_VALUE = {
  1: "fire",
  2: "water",
  3: "thunder",
  4: "ice",
  5: "dragon",
  6: "poison",
  7: "sleep",
  8: "paralysis",
  9: "blast",
};
const ELEMENT_LABEL_ZH = {
  fire: "火",
  water: "水",
  thunder: "雷",
  ice: "冰",
  dragon: "龍",
  poison: "毒",
  sleep: "睡眠",
  paralysis: "麻痺",
  blast: "爆破",
};

const SHELLING_TYPE_BY_LABEL = { 通常型: "normal", 放射型: "long", 擴散型: "wide" };
const PHIAL_TYPE_BY_LABEL = {
  強擊瓶: "power",
  強屬性瓶: "element",
  減氣瓶: "exhaust",
  滅龍瓶: "dragon",
  毒瓶: "poison",
  麻痺瓶: "paralysis",
  榴彈瓶: "impact",
};
const BOW_SHOT_BY_LABEL = { 連射: "rapid", 貫通: "pierce", 擴散: "spread" };

/** 武器系列/線：去除強化階數羅馬數字（Ⅰ Ⅱ …）與「改」尾綴。 */
function weaponSeriesName(name) {
  return name.replace(/[ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩ]+$/, "").replace(/改$/, "").trim();
}

function parseWeaponRow(row, weaponType) {
  const nameM = row.match(/data\/weapons\/(\d+)">([^<]+)<\/a>/);
  if (!nameM) return null;
  const id = `weapon_${nameM[1]}`;
  const nameZh = nameM[2].trim();

  // 洞位：以「百龍鑲嵌槽」切開前後兩段，各自抓 deco{N}.png（洞等級)。
  const rampageIdx = row.indexOf("百龍鑲嵌槽");
  const slotSection = rampageIdx >= 0 ? row.slice(0, rampageIdx) : row;
  const rampageSection = rampageIdx >= 0 ? row.slice(rampageIdx) : "";
  const slots = [...slotSection.matchAll(/deco(\d)\.png/g)].map((m) => Number(m[1]));
  const rampageMatch = rampageSection.match(/deco(\d)\.png/);
  const rampageSlot = rampageMatch ? Number(rampageMatch[1]) : undefined;

  const atkM = row.match(/data-key="attack">(\d+)</);
  const attack = atkM ? Number(atkM[1]) : 0;

  let element;
  const elM = row.match(
    /data-key="element" data-value="(\d)"[\s\S]{0,500}?data-key="elementAttack" data-value="(\d+)"/
  );
  if (elM && Number(elM[2]) > 0) {
    const type = ELEMENT_TYPE_BY_VALUE[elM[1]];
    if (type) element = { type, value: Number(elM[2]) };
  }

  let affinity = 0;
  const affM = row.match(/會心率\s*<span class="text-(?:red|green)-\d+">([+-]?\d+)%<\/span>/);
  if (affM) affinity = Number(affM[1]);

  const rareM = row.match(/Rare (\d+)/);
  const rarity = rareM ? Number(rareM[1]) : undefined;

  const weapon = {
    id,
    nameZh,
    weaponType,
    attack,
    affinity,
    slots,
    ...(rampageSlot ? { rampageSlot } : {}),
    ...(element ? { element } : {}),
    tags: element ? [`${ELEMENT_LABEL_ZH[element.type]}屬性`] : [],
    rarity,
    seriesName: weaponSeriesName(nameZh),
    rankLabel: rankByRarity(rarity),
  };

  if (weaponType === "gunlance") {
    const m = row.match(/columns-3">\s*<div>\s*(通常型|放射型|擴散型)\s*(\d+)\s*<\/div>/);
    if (m) weapon.shelling = { type: SHELLING_TYPE_BY_LABEL[m[1]], level: Number(m[2]) };
  } else if (weaponType === "switch-axe" || weaponType === "charge-blade") {
    const m = row.match(
      /columns-3">\s*<div>\s*(強擊瓶|強屬性瓶|減氣瓶|滅龍瓶|毒瓶|麻痺瓶|榴彈瓶)/
    );
    if (m) weapon.phial = { type: PHIAL_TYPE_BY_LABEL[m[1]] };
  } else if (weaponType === "insect-glaive") {
    const m = row.match(/獵蟲Lv\s*(\d+)/);
    if (m) weapon.kinsectLevel = Number(m[1]);
  } else if (weaponType === "bow") {
    const shotM = row.match(/(連射|貫通|擴散)Lv\d+/);
    if (shotM) {
      weapon.bow = { shotType: BOW_SHOT_BY_LABEL[shotM[1]] };
    }
    const chargeDivs = [...row.matchAll(/<div(?: class="([^"]*)")?>((?:連射|貫通|擴散)Lv\d+)<\/div>/g)];
    const reachedCharges = chargeDivs
      .filter((m) => !(m[1] ?? "").includes("text-gray-400"))
      .map((m) => m[2]);
    if (reachedCharges.length) {
      weapon.bow = weapon.bow ?? {};
      weapon.bow.chargeLevels = reachedCharges;
    }
    const coatSection = row.match(/columns-3">([\s\S]*?)<\/small>/);
    if (coatSection) {
      const coatDivs = [...coatSection[1].matchAll(/<div class="([^"]*)">([^<]+)<\/div>/g)];
      const coatings = coatDivs
        .filter((m) => !m[1].includes("text-gray-400"))
        .map((m) => m[2].trim())
        .filter(Boolean);
      if (coatings.length) {
        weapon.bow = weapon.bow ?? {};
        weapon.bow.coatings = coatings;
      }
    }
  }

  return weapon;
}

function parseWeaponsView(html, weaponType) {
  const out = [];
  for (const row of tableRows(html)) {
    const w = parseWeaponRow(row, weaponType);
    if (w) out.push(w);
  }
  return out;
}

// ---------------- 主流程 ----------------
async function main() {
  console.log("→ 技能");
  const skillsHtml = await fetchText(`${BASE}/skills`);
  const skills = parseSkills(skillsHtml);
  console.log(`  ${skills.length} 技能`);

  console.log("→ 裝飾珠");
  const decoHtml = await fetchText(`${BASE}/decorations`);
  const decorations = parseDecorations(decoHtml);
  console.log(`  ${decorations.length} 裝飾珠`);

  console.log("→ 防具（RARE 1-10）");
  const armors = [];
  for (let view = 0; view <= 9; view++) {
    const html = await fetchText(`${BASE}/armors?view=${view}`);
    const pieces = parseArmorView(html, view + 1);
    armors.push(...pieces);
    console.log(`  RARE${view + 1}: ${pieces.length} 件`);
  }
  console.log(`  合計 ${armors.length} 件防具`);

  console.log("→ 武器（14 類全武器）");
  const weapons = [];
  for (let view = 0; view <= 13; view++) {
    const weaponType = WEAPON_TYPE_BY_VIEW[view];
    const html = await fetchText(`${BASE}/weapons?view=${view}`);
    const list = parseWeaponsView(html, weaponType);
    weapons.push(...list);
    console.log(`  ${weaponType}: ${list.length} 把`);
  }
  console.log(`  合計 ${weapons.length} 把武器`);

  // 補：確保裝飾珠引用的技能都在 skills 內（有些技能只出現在珠子)
  const skillNames = new Set(skills.map((s) => s.name));
  for (const d of decorations) {
    if (!skillNames.has(d.skillName)) {
      skills.push({ name: d.skillName, maxLevel: 0 });
      skillNames.add(d.skillName);
    }
  }

  // maxLevel 修正：頁面等級 vs 裝備/珠子實際觀察到的最高等級,取大值（至少 1）。
  const observed = {};
  const bump = (name, lv) => {
    observed[name] = Math.max(observed[name] ?? 0, lv);
  };
  for (const a of armors)
    for (const [n, lv] of Object.entries(a.skills)) bump(n, lv);
  for (const d of decorations) bump(d.skillName, d.skillLevel);
  for (const s of skills) {
    s.maxLevel = Math.max(
      s.maxLevel || 0,
      observed[s.name] ?? 0,
      KNOWN_MAX[s.name] ?? 0,
      1
    );
  }

  fs.writeFileSync(
    path.join(DATA_DIR, "skills.json"),
    JSON.stringify(skills, null, 2) + "\n"
  );
  fs.writeFileSync(
    path.join(DATA_DIR, "decorations.json"),
    JSON.stringify(decorations, null, 2) + "\n"
  );
  fs.writeFileSync(
    path.join(DATA_DIR, "armors.json"),
    JSON.stringify(armors, null, 2) + "\n"
  );
  fs.writeFileSync(
    path.join(DATA_DIR, "weapons.json"),
    JSON.stringify(weapons, null, 2) + "\n"
  );
  console.log("✓ 已寫入 src/data/{skills,decorations,armors,weapons}.json");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
