/**
 * World（MHW: Iceborne）資料匯入管線（PLAN-iceborne Phase 2）。
 *
 * 主源＝MHWorldData raw CSV（scripts/world/.cache/mhwd/，由 fetch-mhwd.mjs 下載）。
 * 產出 src/data/world/{skills,decorations,charms,setBonuses,armors,weapons,weaponTypes}.json，
 * schema 同 rise + Phase 1 新欄位。產出檔一律機械產生，**絕不手改**；
 * 人工裁決（zh 缺漏 G2）一律進 scripts/world/zh-name-overrides.json，重跑安全。
 *
 *   node scripts/world/fetch-mhwd.mjs      # 先備妥快取
 *   node scripts/world/import-world.mjs      # 產出 7 檔
 *   node scripts/world/import-world.mjs --report-gaps   # 額外印出未映射清單
 */
import { writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { loadMhwd, isBlank } from "./lib-csv.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..", "..");
const OUT = path.join(REPO, "src", "data", "world");
mkdirSync(OUT, { recursive: true });

const REPORT_GAPS = process.argv.includes("--report-gaps");

// ---- zh 覆寫檔（G2 人工裁決；缺漏 EN→{zh,src}）----
const OVERRIDE_FILE = path.join(HERE, "zh-name-overrides.json");
const overrides = existsSync(OVERRIDE_FILE)
  ? JSON.parse(readFileSync(OVERRIDE_FILE, "utf8"))
  : {};
const ov = (kind, en) => overrides[kind]?.[en]?.zh;

// 收集未映射（gap）
const gaps = { skills: [], setBonuses: [], armorSets: [], armors: [], weapons: [], charms: [], decorations: [] };
function resolveZh(kind, en, csvZh) {
  const o = ov(kind, en);
  if (!isBlank(o)) return o;
  if (!isBlank(csvZh)) return csvZh;
  if (!gaps[kind].includes(en)) gaps[kind].push(en);
  return en; // fallback：暫用 EN，待 override 補
}

const slug = (s) =>
  "sb_" + s.toLowerCase().replace(/['’]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

// 名稱正規化（塌縮連續空白）：MHWorldData 少數 name_en 有雙空格，
// 與 translations/armorset 的單空格版不一致，會使 join 靜默失敗（假 gap / 遺失 set 連結）。
const norm = (s) => (s == null ? s : String(s).replace(/\s+/g, " ").trim());

// =====================================================================
// 0) 技能 EN→ZH map（一切引用技能名者共用；缺漏走 override，記 gap）
// =====================================================================
const skillBase = loadMhwd("skills/skill_base.csv");
const skillTr = loadMhwd("skills/skill_base_translations.csv");
const skillLevels = loadMhwd("skills/skill_levels.csv");

const skillZhByEn = {}; // key: norm(name_en)
{
  const csvZh = {};
  for (const r of skillTr) csvZh[norm(r.name_en)] = r.name_zh;
  for (const s of skillBase) {
    skillZhByEn[norm(s.name_en)] = resolveZh("skills", s.name_en, csvZh[norm(s.name_en)]);
  }
}
const zhSkill = (en) => (isBlank(en) ? null : skillZhByEn[norm(en)] ?? en);

// dataMax per skill（skill_levels 已含 secret 級數）
const dataMax = {};
for (const r of skillLevels) {
  const k = r.base_name_en;
  dataMax[k] = Math.max(dataMax[k] || 0, +r.level);
}
// unlocks：secret 技能（X Secret，unlocks==target）→ target 的解放者
const unlockerEnOf = {}; // norm(targetEn) -> secretSkillEn
for (const s of skillBase) {
  if (!isBlank(s.unlocks)) unlockerEnOf[norm(s.unlocks)] = s.name_en;
}

// 全域 secret 解放器（Fatalis「Inheritance」）：由技能逐級描述機械偵測，
// 不硬編技能名。描述含「removes the skill level cap for the skill secrets」者，
// 觸發後解除**所有** secret 技能的上限（Phase 3 resolveSkillMax 路徑 b）。
const globalUnlockEn = new Set(
  skillLevels
    .filter((r) => /removes the skill level cap for the skill secret/i.test(r.description_en || ""))
    .map((r) => norm(r.base_name_en))
);

// =====================================================================
// 1) skills.json
// =====================================================================
const skillsOut = skillBase.map((s) => {
  const en = s.name_en;
  const dMax = dataMax[en] ?? 1;
  const delta = isBlank(s.secret) ? 0 : Number(s.secret);
  const out = {
    name: zhSkill(en),
    nameEn: en,
    maxLevel: dMax - delta, // 原生上限＝dataMax − Δ（skill_levels 已含 secret 級數）
  };
  if (delta > 0) {
    out.secretMaxLevel = dMax; // 解放後上限＝dataMax
    const unlockerEn = unlockerEnOf[norm(en)];
    if (unlockerEn) out.secretUnlockedBy = zhSkill(unlockerEn);
  }
  if (globalUnlockEn.has(norm(en))) out.unlocksAllSecrets = true;
  return out;
});

// =====================================================================
// 2) decorations.json（單技能填舊欄位+skills；複合珠 skills 為雙技能、舊欄位填第一技能）
// =====================================================================
const decoBase = loadMhwd("decorations/decoration_base.csv");
const decoTr = loadMhwd("decorations/decoration_base_translations.csv");
const decoZh = {};
for (const r of decoTr) decoZh[norm(r.name_en)] = r.name_zh;

const decorationsOut = decoBase.map((d, i) => {
  const s1 = zhSkill(d.skill1_name);
  const l1 = Number(d.skill1_level);
  const skills = { [s1]: l1 };
  if (!isBlank(d.skill2_name)) skills[zhSkill(d.skill2_name)] = Number(d.skill2_level);
  return {
    id: `wdeco_${d.id}`,
    nameZh: resolveZh("decorations", d.name_en, decoZh[norm(d.name_en)]),
    slotLevel: Number(d.slot),
    skillName: s1, // 相容：第一技能
    skillLevel: l1,
    skills,
    craftable: true,
  };
});

// =====================================================================
// 3) charms.json（craftable-list：逐等級一筆；slots 一律 []）
// =====================================================================
const charmBase = loadMhwd("charms/charm_base.csv");
const charmTr = loadMhwd("charms/charm_base_translations.csv");
const charmZh = {};
for (const r of charmTr) charmZh[norm(r.name_en)] = r.name_zh;

const charmsOut = charmBase.map((c) => {
  const skills = { [zhSkill(c.skill1_name)]: Number(c.skill1_level) };
  if (!isBlank(c.skill2_name)) skills[zhSkill(c.skill2_name)] = Number(c.skill2_level);
  return {
    id: `wcharm_${c.id}`,
    name: resolveZh("charms", c.name_en, charmZh[norm(c.name_en)]),
    skills,
    slots: [],
  };
});

// =====================================================================
// 4) setBonuses.json（armorset_bonus_base：每列最多 2 組 skill@requiredPieces）
// =====================================================================
const sbBase = loadMhwd("armors/armorset_bonus_base.csv");
const sbTr = loadMhwd("armors/armorset_bonus_base_translations.csv");
const sbZh = {};
for (const r of sbTr) sbZh[norm(r.name_en)] = r.name_zh;

const setBonusIdByEn = {};
const setBonusesOut = sbBase.map((r) => {
  const id = slug(r.name_en);
  setBonusIdByEn[r.name_en] = id;
  const ranks = [
    { pieces: Number(r.skill1_required), skillName: zhSkill(r.skill1_name), skillLevel: 1 },
  ];
  if (!isBlank(r.skill2_name)) {
    ranks.push({ pieces: Number(r.skill2_required), skillName: zhSkill(r.skill2_name), skillLevel: 1 });
  }
  return {
    id,
    nameZh: resolveZh("setBonuses", r.name_en, sbZh[norm(r.name_en)]),
    nameEn: r.name_en,
    ranks,
  };
});

// =====================================================================
// 5) armors.json
// =====================================================================
const armorBase = loadMhwd("armors/armor_base.csv");
const armorTr = loadMhwd("armors/armor_base_translations.csv");
const armorSkillsExt = loadMhwd("armors/armor_skills_ext.csv");
const armorSets = loadMhwd("armors/armorset_base.csv");
const armorSetTr = loadMhwd("armors/armorset_base_translations.csv");

const armorZh = {};
for (const r of armorTr) armorZh[norm(r.name_en)] = r.name_zh;
const armorSetZh = {};
for (const r of armorSetTr) armorSetZh[norm(r.name_en)] = r.name_zh;
const skillsExtByName = {};
for (const r of armorSkillsExt) skillsExtByName[norm(r.base_name_en)] = r;

// piece name_en（正規化）→ set 資訊
const setOfPiece = {};
for (const set of armorSets) {
  for (const part of ["head", "chest", "arms", "waist", "legs"]) {
    const pieceEn = set[part];
    if (!isBlank(pieceEn)) {
      setOfPiece[norm(pieceEn)] = {
        seriesNameEn: set.name_en,
        seriesNameZh: resolveZh("armorSets", set.name_en, armorSetZh[norm(set.name_en)]),
        monster: set.monster,
        rank: set.rank,
        bonusEn: set.bonus,
      };
    }
  }
}

const RANK_ZH = { LR: "下位", HR: "上位", MR: "MR" };
function collectSlots(a) {
  return [a.slot_1, a.slot_2, a.slot_3].map(Number).filter((n) => n > 0);
}

const armorsOut = armorBase.map((a) => {
  const en = a.name_en;
  const set = setOfPiece[norm(en)];
  const ext = skillsExtByName[norm(en)];
  const skills = {};
  if (ext) {
    if (!isBlank(ext.skill1_name)) skills[zhSkill(ext.skill1_name)] = Number(ext.skill1_level);
    if (!isBlank(ext.skill2_name)) skills[zhSkill(ext.skill2_name)] = Number(ext.skill2_level);
  }
  const out = {
    id: `warmor_${a.id}`,
    nameZh: resolveZh("armors", en, armorZh[norm(en)]),
    nameEn: en,
    part: a.type,
    rarity: Number(a.rarity),
    slots: collectSlots(a),
    skills,
    defense: Number(a.defense_base), // 基礎防禦（對應 build.ts「5 件基礎防禦總和」語意）
    elementRes: {
      fire: Number(a.defense_fire),
      water: Number(a.defense_water),
      thunder: Number(a.defense_thunder),
      ice: Number(a.defense_ice),
      dragon: Number(a.defense_dragon),
    },
  };
  if (set) {
    if (!isBlank(set.rank)) out.rankLabel = RANK_ZH[set.rank] ?? set.rank;
    if (!isBlank(set.seriesNameZh)) out.seriesName = set.seriesNameZh;
    if (!isBlank(set.monster)) out.sourceMonster = set.monster;
    if (!isBlank(set.bonusEn)) out.setBonusId = setBonusIdByEn[set.bonusEn] ?? slug(set.bonusEn);
  }
  return out;
});

// =====================================================================
// 6) weapons.json（compact 一物件一行；斬味 base=匠0/max=匠5）
// =====================================================================
const weaponBase = loadMhwd("weapons/weapon_base.csv");
const weaponTr = loadMhwd("weapons/weapon_base_translations.csv");
const sharpRows = loadMhwd("weapons/weapon_sharpness.csv");

const weaponZh = {};
for (const r of weaponTr) weaponZh[norm(r.name_en)] = r.name_zh;

// sharpness：MHWorldData 每把近戰武器**僅一列**（2825 melee；719 遠程無斬味）。
// 欄序 red..purple 對應 Rise [紅橙黃綠藍白紫]。
//
// ★ Phase 4 考證修正（推翻 Phase 0/2 初判）：實測 7 把武器對 Kiranico World 詳細頁
//   逐段核對（Fatalis Blade / Buster Sword I / Defender GS I / Don Monstro / Ruinous
//   Atrocity / Nergal Reaver / Safi GS，見 docs/world-sharpness-audit.md）判定：
//   **該單列 = 匠5（handicraft-maxed）色帶，非匠0 base。** `maxed` 欄語意：
//     - maxed=TRUE  → base 已等於此列（匠加成 0；例 Nergal/Safi 已達 400 上限）。
//     - maxed=FALSE → 匠 Lv5 較 base 恰 +50（base = 由高色端剝除 50）。實測 Fatalis
//       purple 60→base10、Buster green/yellow、Defender green 140→90 皆恰 −50。
//   MHWorldData 以**二值（0/50）**建模匠加成——無「加不滿 +50」的中間值（連 sum=250
//   的短帶 Buster/Defender 都吃滿 +50）。故機械推導 base，max 直接取該列。
const SHARP_COLS = ["red", "orange", "yellow", "green", "blue", "white", "purple"];
const HANDI_BONUS = 50; // World 匠 Lv5 = +10/級 × 5；MHWorldData 二值建模（見上）
// 由匠5 maxed 色帶剝除 amount（自最高色端往低色扣），得匠0 base。
function peelFromTop(arr, amount) {
  const out = arr.slice();
  let rem = amount;
  for (let i = out.length - 1; i >= 0 && rem > 0; i--) {
    const take = Math.min(out[i], rem);
    out[i] -= take;
    rem -= take;
  }
  return out;
}
const sharpByName = {};
for (const r of sharpRows) {
  const maxedBar = SHARP_COLS.map((c) => Number(r[c]) || 0); // = 匠5 maxed
  const isMaxed = String(r.maxed).trim().toUpperCase() === "TRUE";
  const base = isMaxed ? maxedBar.slice() : peelFromTop(maxedBar, HANDI_BONUS);
  sharpByName[norm(r.base_name_en)] = { base, max: maxedBar };
}

const ELEM_MAP = {
  Fire: "fire", Water: "water", Thunder: "thunder", Ice: "ice", Dragon: "dragon",
  Poison: "poison", Paralysis: "paralysis", Sleep: "sleep", Blast: "blast",
};
const RANK_BY_RARITY = (r) => (r <= 4 ? "下位" : r <= 8 ? "上位" : "MR");

const weaponsOut = weaponBase.map((w) => {
  const en = w.name_en;
  const out = {
    id: `wweapon_${w.id}`,
    nameZh: resolveZh("weapons", en, weaponZh[norm(en)]),
    nameEn: en,
    weaponType: w.weapon_type,
    attack: Number(w.attack), // display 值（膨脹，同武器種內可比）
    affinity: Number(w.affinity) || 0,
  };
  const sh = sharpByName[norm(en)];
  if (sh) out.sharpness = { base: sh.base, max: sh.max };
  out.slots = [w.slot_1, w.slot_2, w.slot_3].map(Number).filter((n) => n > 0);
  if (!isBlank(w.element1) && ELEM_MAP[w.element1]) {
    out.element = { type: ELEM_MAP[w.element1], value: Number(w.element1_attack) || 0 };
  }
  out.tags = [];
  out.rarity = Number(w.rarity);
  out.rankLabel = RANK_BY_RARITY(Number(w.rarity));
  return out;
});

// =====================================================================
// 7) weaponTypes.json（14 種，沿用 Rise 的 zh 名，World 全支援）
// =====================================================================
const riseWeaponTypes = JSON.parse(
  readFileSync(path.join(REPO, "src", "data", "rise", "weaponTypes.json"), "utf8")
);
const weaponTypesOut = riseWeaponTypes.map((t) => ({ ...t, supported: true }));

// ---- 寫檔 ----
function writePretty(name, data) {
  writeFileSync(path.join(OUT, name), JSON.stringify(data, null, 2) + "\n", "utf8");
}
function writeCompactLines(name, arr) {
  const body = arr.map((o) => JSON.stringify(o)).join(",\n");
  writeFileSync(path.join(OUT, name), `[\n${body}\n]\n`, "utf8");
}
function writeTypeLines(name, arr) {
  const body = arr.map((o) => "  " + JSON.stringify(o)).join(",\n");
  writeFileSync(path.join(OUT, name), `[\n${body}\n]\n`, "utf8");
}

writePretty("skills.json", skillsOut);
writePretty("decorations.json", decorationsOut);
writePretty("charms.json", charmsOut);
writePretty("setBonuses.json", setBonusesOut);
writePretty("armors.json", armorsOut);
writeCompactLines("weapons.json", weaponsOut);
writeTypeLines("weaponTypes.json", weaponTypesOut);

// ---- 摘要 ----
console.log("[import-world] 產出 src/data/world/：");
console.log(`  skills:       ${skillsOut.length}  (secret: ${skillsOut.filter((s) => s.secretMaxLevel).length})`);
console.log(`  decorations:  ${decorationsOut.length}  (複合珠: ${decorationsOut.filter((d) => Object.keys(d.skills).length > 1).length})`);
console.log(`  charms:       ${charmsOut.length}`);
console.log(`  setBonuses:   ${setBonusesOut.length}`);
console.log(`  armors:       ${armorsOut.length}  (帶 setBonusId: ${armorsOut.filter((a) => a.setBonusId).length})`);
console.log(`  weapons:      ${weaponsOut.length}  (帶斬味: ${weaponsOut.filter((w) => w.sharpness).length})`);
console.log(`  weaponTypes:  ${weaponTypesOut.length}`);

const totalGaps = Object.values(gaps).reduce((a, g) => a + g.length, 0);
console.log(`\n[import-world] zh 未映射（fallback EN）：${totalGaps} 筆`);
for (const [kind, list] of Object.entries(gaps)) {
  if (list.length) console.log(`  ${kind} (${list.length}): ${REPORT_GAPS ? list.join(", ") : list.slice(0, 6).join(", ") + (list.length > 6 ? " …" : "")}`);
}
// 輸出未映射清單成檔（供 build-zh-name-map / 人工裁決）
writeFileSync(
  path.join(HERE, ".cache", "zh-gaps.json"),
  JSON.stringify(gaps, null, 2) + "\n",
  "utf8"
);
console.log(`\n[import-world] 未映射清單 → scripts/world/.cache/zh-gaps.json`);
