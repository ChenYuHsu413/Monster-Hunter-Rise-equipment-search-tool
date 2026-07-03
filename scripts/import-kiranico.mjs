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

/** 取出 <tbody>…</tbody> 內的每個 <tr>…</tr> 原始 HTML。 */
function tableRows(html) {
  const tb = html.match(/<tbody[\s\S]*?<\/tbody>/);
  if (!tb) return [];
  return [...tb[0].matchAll(/<tr[\s\S]*?<\/tr>/g)].map((m) => m[0]);
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
  for (const row of tableRows(html)) {
    const p = parseArmorRow(row, rarity);
    if (!p) continue;
    const kw = classifyPartKW(p.nameZh);
    const part = kw || PARTS[cursor];
    if (kw) cursor = PARTS.indexOf(kw);
    cursor = (cursor + 1) % 5;
    pieces.push({
      id: p.id,
      nameZh: p.nameZh,
      part,
      rarity: p.rarity,
      slots: p.slots,
      skills: p.skills,
      ...(p.defense != null ? { defense: p.defense } : {}),
    });
  }
  return pieces;
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
  console.log("✓ 已寫入 src/data/{skills,decorations,armors}.json");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
