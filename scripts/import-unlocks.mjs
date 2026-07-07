// @ts-nocheck
/**
 * 解放條件匯入器 — 從 Kiranico 任務清單（村莊 / 集會所初階 / 進階 / Master）
 * 解析「每隻魔物首次出現的星級」，再以現有裝備資料的 sourceMonster 推導
 * 每件裝備的解放里程碑，產出 src/data/unlocks.json（獨立檔，以 id 關聯）。
 *
 * 信心度三層（詳見 README 信心度標註慣例）：
 * - confirmed：TU/後期魔物的 MR 等級門檻（Game8 攻略確認的遊戲常數）
 * - inferred ：sourceMonster × 任務星級推導（非官方逐件標註）
 * - unverified：無來源魔物可推導，退回 rarity 近似映射
 *
 * 里程碑欄位（entries[id]）：
 * - v : 村莊任務★（1-6），達到即可獵到素材
 * - h : 集會所任務★（1-3 初階＝低位、4-8 進階＝上位）
 * - m : Master 集會所任務★（1-6，MR 劇情章節）
 * - mr: MR 等級門檻（10+，TU 魔物）
 * 多軸並存時任一軸達標即視為可製作（素材在哪條線打到都能做裝）。
 *
 * 用法：node scripts/import-unlocks.mjs
 * 前置：src/data/{armors,weapons}.json 需已由 import-kiranico.mjs 產出。
 * 注意：此為建置時腳本，不進 app bundle。重跑即可更新資料。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "src", "data");
const BASE = "https://mhrise.kiranico.com/zh-Hant/data";
const UA = { "User-Agent": "Mozilla/5.0 (data import for personal armor builder)" };

/**
 * TU / 後期魔物的 MR 等級解放門檻（遊戲常數，Game8 攻略確認）。
 * 這些魔物的任務雖列在 Master 6★，實際要打到指定 MR 等級才解鎖，
 * 以此表覆蓋星級推導。鍵名需與 Kiranico 魔物名單完全一致（匯入時驗證）。
 */
const TU_MONSTER_MR = {
  // TU1
  月迅龍: 10,
  紅蓮爆鱗龍: 10,
  銀火龍: 10,
  金火龍: 10,
  // TU2（棘茶龍＝棘龍亞種 Flaming Espinas）
  棘茶龍: 10,
  焰狐龍: 10,
  "霞龍（傀異克服）": 110,
  // TU3
  混沌黑蝕龍: 10,
  "鋼龍（傀異克服）": 120,
  "炎王龍（傀異克服）": 140,
  // TU4
  冰呪龍: 10,
  "天彗龍（傀異克服）": 160,
  // TU5
  嵐龍: 10,
  "天迴龍（傀異克服）": 180,
  // Bonus Update
  原初爵銀龍: 10,
  // 破曉本篇後期（非 TU，但同為 MR 等級門檻）
  激昂金獅子: 50,
  嗟怨轟天怨虎龍: 100,
};

/**
 * 名稱樣式 → 來源魔物覆寫（依序比對，先中先贏）。
 * 變種/傀異克服魔物的素材名稱前綴與 Kiranico 魔物名單不一致，
 * sourceMonster 啟發式會誤判為基底魔物（例：混沌黑蝕裝備被判成黑蝕龍、
 * 禍鎧/鎧怨鬼被判成怨虎龍、赫耀・曆來源判定失敗落到 rarity 近似），
 * 造成解放章節嚴重低估（社群實測回報）。此表以裝備名稱樣式強制指定來源。
 * 注意「･曆」要在「赫耀」之前（傀異克服天彗龍 vs 秘紅赫耀）。
 */
const NAME_MONSTER_OVERRIDES = [
  [/曆/, "天彗龍（傀異克服）"], // 赫耀・曆（Risen 天彗龍裝）
  [/霞龍醒/, "霞龍（傀異克服）"],
  [/脈動鋼龍/, "鋼龍（傀異克服）"],
  [/脈動帝王/, "炎王龍（傀異克服）"],
  // 混沌黑蝕防具 + 「○or○」武器（混沌or法律等 14 把）。
  // 不可用寬鬆的 /混沌/：奇怪龍的混沌之弓系列、村裝「混沌的」系列會誤中。
  [/混沌黑蝕|or/, "混沌黑蝕龍"],
  // 僅「・怨」是嗟怨轟天裝：基底怨虎龍裝本身就叫 禍鎧（村）/ 禍鎧・霸（上位）。
  [/鎧怨鬼|鎧幽鬼|禍鎧･怨/, "嗟怨轟天怨虎龍"],
  // 僅「鳴神○○真」是百龍之源（Allmother）裝：基底鳴神/雷鳴神武器屬一般雷神龍。
  [/^鳴神.*真$/, "百龍之源雷神龍"],
  [/赫耀/, "秘紅赫耀的天彗龍"], // 基底 R7 赫耀（集8★）與 R10 赫耀・真（M6）；・曆已被上面攔截
  [/原初/, "原初爵銀龍"], // 原初頭盔等（Bonus Update，MR10）；一般爵銀龍裝不含「原初」
  [/怒天/, "激昂金獅子"], // 怒天系列；一般金獅子 MR 裝為齊天・真
  [/矜持/, "紅蓮爆鱗龍"], // 矜持（Pride）系列；一般爆鱗龍 MR 裝為爆鱗龍X
];

function monsterOverrideFor(nameZh) {
  for (const [re, mon] of NAME_MONSTER_OVERRIDES) {
    if (re.test(nameZh)) return mon;
  }
  return undefined;
}

/**
 * rarity → 里程碑近似映射（unverified 後備）。
 * 沿用 rankByRarity 的三段劃分再細分：R1-3 村/低位、R4-7 上位、R8-10 MR。
 */
const RARITY_FALLBACK = {
  1: { v: 1, h: 1 },
  2: { v: 2, h: 1 },
  3: { v: 3, h: 2 },
  4: { h: 4 },
  5: { h: 5 },
  6: { h: 6 },
  7: { h: 7 },
  8: { m: 1 },
  9: { m: 3 },
  10: { m: 5 },
};

/**
 * 傀異素材 → 解放門檻（Game8 傀異任務指南確認的遊戲常數）。
 * A1-A4 為明確 MR 門檻；A5+ 由傀異研究等級把關（無對應 MR 軸），
 * 記為 MR50 下限並以 note 標註研究等級需求（誠實標註，不假裝精確）。
 */
const AFFLICTED_TIERS = [
  [/傀異化之[骨皮]/, 10, null], // A1
  [/傀異化(血液|龍骨)/, 20, null], // A2
  [/傀異化(甲殼|鱗片)/, 30, null], // A3
  [/傀異化之[牙爪]/, 50, null], // A4
  [/傀異化凶[骨角鱗]/, 50, "另需傀異研究 Lv81+（A5★素材）"],
  [/傀異化凶[殼爪]/, 50, "另需傀異研究 Lv111+（A6★素材）"],
  [/傀異化凶(翼|龍血|牙)/, 50, "另需傀異研究 Lv181+（A7★素材）"],
  [/傀異調查票劵/, 10, "另需傀異調查任務"], // 調查任務產物（活動/趣味武器常用）
];
/** 未知傀異素材的保守後備（並列印警告供補表）。 */
const AFFLICTED_FALLBACK = [50, "另需傀異研究等級（A5★+ 素材）"];

/** 一段素材清單的傀異門檻：[mr 門檻, note]；無傀異素材回傳 [0, null]。 */
function afflictedGate(materialNames, warnSet) {
  let mr = 0;
  let note = null;
  let noteRank = -1; // note 取最高研究等級素材者（依 AFFLICTED_TIERS 順序）
  for (const name of materialNames) {
    if (!name.includes("傀異")) continue;
    const idx = AFFLICTED_TIERS.findIndex(([re]) => re.test(name));
    const [gate, tierNote] =
      idx >= 0 ? [AFFLICTED_TIERS[idx][1], AFFLICTED_TIERS[idx][2]] : AFFLICTED_FALLBACK;
    if (idx < 0) warnSet?.add(name);
    if (gate > mr) mr = gate;
    const rank = idx >= 0 ? idx : 99;
    if (tierNote && rank > noteRank) {
      note = tierNote;
      noteRank = rank;
    }
  }
  return [mr, note];
}

/** 併發跑 items，同時最多 limit 個（同 import-kiranico）。 */
async function mapConcurrent(items, limit, fn, onProgress) {
  const results = new Array(items.length);
  let idx = 0;
  let done = 0;
  async function worker() {
    while (idx < items.length) {
      const cur = idx++;
      results[cur] = await fn(items[cur], cur);
      done++;
      if (onProgress && done % 250 === 0) onProgress(done, items.length);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

/** 詳細頁某區段（startLabel 起、endLabel 止）內的素材名清單。 */
function sectionMaterials(html, startLabel, endLabel) {
  const s = html.indexOf(startLabel);
  if (s < 0) return [];
  const end = endLabel ? html.indexOf(endLabel, s) : -1;
  const seg = html.slice(s, end < 0 ? s + 6000 : end);
  return [...seg.matchAll(/data\/items\/\d+">([^<]+)</g)].map((m) => m[1].trim());
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

/** 同 import-kiranico：抓大型 + 小型魔物名單，依名稱長度遞減排序。 */
async function fetchMonsterNames() {
  const names = new Set();
  for (const view of ["lg", "sm"]) {
    const html = await fetchText(`${BASE}/monsters?view=${view}`);
    for (const m of html.matchAll(/images\/icons\/em[^"]+"\s+alt="([^"]+)"/g)) {
      const n = m[1].trim();
      if (n) names.add(n);
    }
  }
  return [...names].sort((a, b) => b.length - a.length);
}

/**
 * 解析一個任務清單頁，回傳 [{star, monsters}]。
 * 版面：每筆任務為 3 個 <tr>（rowspan），星級在任務連結文字「N★ 任務名」，
 * 目標句「狩獵/討伐/捕獲…」在下一個 <tr>——故以任務連結切段，逐段配對。
 * 目標魔物只從目標句抓（任務名本身常含魔物名，不可用），以最長名優先 +
 * 遮蔽已匹配片段，處理「激昂金獅子」vs「金獅子」等變體。
 * 「狩獵所有目標」等未列名的任務自然略過（不影響首次出現統計）。
 */
function parseQuestView(html, monstersByLen) {
  const anchors = [...html.matchAll(/data\/quests\/\d+">(\d)★/g)];
  const out = [];
  for (let i = 0; i < anchors.length; i++) {
    const star = Number(anchors[i][1]);
    const seg = html
      .slice(anchors[i].index, anchors[i + 1]?.index ?? html.length)
      .replace(/<[^>]+>/g, " ")
      .replace(/&[a-z]+;/g, " ")
      .replace(/\s+/g, " ");
    const targetM = seg.match(/(?:狩獵|討伐|捕獲).+?(?=HRP:|MRP:|$)/);
    if (!targetM) continue;
    let target = targetM[0];
    const monsters = [];
    for (const mon of monstersByLen) {
      while (target.includes(mon)) {
        monsters.push(mon);
        target = target.replace(mon, "＠".repeat(mon.length));
      }
    }
    if (monsters.length) out.push({ star, monsters: [...new Set(monsters)] });
  }
  return out;
}

/** 累計每隻魔物在該軌道的最低（首次出現）星級。 */
function earliestByMonster(quests) {
  const map = {};
  for (const { star, monsters } of quests) {
    for (const mon of monsters) {
      if (map[mon] == null || star < map[mon]) map[mon] = star;
    }
  }
  return map;
}

/** 單件裝備 → 解放條目。 */
function unlockEntry(item, tracks) {
  const mon = monsterOverrideFor(item.nameZh) ?? item.sourceMonster;
  const rank = item.rankLabel; // 村 / HR / MR（rarity 推算，見 import-kiranico）
  const fallback = () => ({
    ...RARITY_FALLBACK[item.rarity] ?? { m: 6 },
    ...(mon ? { mon } : {}),
    c: "unverified",
    src: "rarity-approx",
  });

  if (!mon || !rank) return fallback();

  // TU / 後期魔物：MR 等級門檻覆蓋星級推導（僅 MR 裝備適用；
  // 低位/上位裝備照常走星級，例如金獅子低位裝與激昂金獅子無關）
  if (rank === "MR" && TU_MONSTER_MR[mon] != null) {
    return { mr: TU_MONSTER_MR[mon], mon, c: "confirmed", src: "tu-mr-const" };
  }

  if (rank === "村") {
    const v = tracks.village[mon];
    const h = tracks.hubLow[mon];
    if (v == null && h == null) return fallback();
    return { ...(v != null ? { v } : {}), ...(h != null ? { h } : {}), mon, c: "inferred", src: "quest-star" };
  }
  if (rank === "HR") {
    const h = tracks.hubHigh[mon];
    if (h == null) return fallback();
    return { h, mon, c: "inferred", src: "quest-star" };
  }
  // MR
  const m = tracks.master[mon];
  if (m == null) return fallback();
  return { m, mon, c: "inferred", src: "quest-star" };
}

async function main() {
  const armors = JSON.parse(fs.readFileSync(path.join(DATA_DIR, "armors.json"), "utf8"));
  const weapons = JSON.parse(fs.readFileSync(path.join(DATA_DIR, "weapons.json"), "utf8"));

  console.log("→ 魔物名單");
  const monstersByLen = await fetchMonsterNames();
  console.log(`  ${monstersByLen.length} 種`);

  // TU 常數表鍵名驗證：拼字與 Kiranico 名單不一致就是 bug，直接列警告
  const monsterSet = new Set(monstersByLen);
  for (const name of Object.keys(TU_MONSTER_MR)) {
    if (!monsterSet.has(name)) {
      console.warn(`  ⚠ TU_MONSTER_MR 鍵名不在魔物名單中：「${name}」（不會被套用）`);
    }
  }
  for (const [, name] of NAME_MONSTER_OVERRIDES) {
    if (!monsterSet.has(name)) {
      console.warn(`  ⚠ NAME_MONSTER_OVERRIDES 魔物名不在名單中：「${name}」`);
    }
  }

  console.log("→ 任務清單（村莊 / 集會所初階 / 進階 / Master）");
  const views = { village: "village", hubLow: "hub_low", hubHigh: "hub_high", master: "hub_master" };
  const tracks = {};
  for (const [key, view] of Object.entries(views)) {
    const html = await fetchText(`${BASE}/quests?view=${view}`);
    const quests = parseQuestView(html, monstersByLen);
    tracks[key] = earliestByMonster(quests);
    console.log(`  ${view}: ${quests.length} 筆有目標魔物的任務，${Object.keys(tracks[key]).length} 種魔物`);
  }

  const entries = {};
  for (const item of [...armors, ...weapons]) {
    entries[item.id] = unlockEntry(item, tracks);
  }

  // ---- 傀異素材門檻（詳細頁掃描）----
  // R9+ 的 MR 裝備（confirmed 除外：TU 常數已是權威門檻）逐件抓詳細頁，
  // 解析生產/強化素材。武器「生產」「強化」為兩條取得路徑，任一路徑
  // 不需傀異素材即可取得 → 取各路徑門檻的最小值；門檻 0 表示不受傀異限制。
  const candidates = [...armors, ...weapons].filter((x) => {
    const e = entries[x.id];
    return x.rankLabel === "MR" && (x.rarity ?? 0) >= 9 && e.c !== "confirmed";
  });
  console.log(`→ 傀異素材門檻掃描（R9+ MR 非 confirmed，共 ${candidates.length} 件詳細頁）`);
  const unknownMats = new Set();
  let gated = 0;
  let fetchFailed = 0;
  await mapConcurrent(
    candidates,
    10,
    async (x) => {
      const kind = x.id.startsWith("armor_") ? "armors" : "weapons";
      const numId = x.id.replace(/^(armor|weapon)_/, "");
      let html;
      try {
        html = await fetchText(`${BASE}/${kind}/${numId}`, 2);
      } catch {
        fetchFailed++;
        return;
      }
      const forge = sectionMaterials(html, "生產素材", "強化素材");
      const upgrade = kind === "weapons" ? sectionMaterials(html, "強化素材") : [];
      const paths = [forge, upgrade].filter((p) => p.length > 0);
      if (paths.length === 0) return;
      let best = Infinity;
      let bestNote = null;
      for (const p of paths) {
        const [mr, note] = afflictedGate(p, unknownMats);
        if (mr < best) {
          best = mr;
          bestNote = note;
        }
      }
      if (best === 0 || best === Infinity) return; // 存在不需傀異素材的路徑
      const e = entries[x.id];
      entries[x.id] = {
        mr: best,
        ...(bestNote ? { note: bestNote } : {}),
        ...(e.mon ? { mon: e.mon } : {}),
        c: "inferred",
        src: "anomaly-material",
      };
      gated++;
    },
    (done, total) => console.log(`  ...${done}/${total}`)
  );
  console.log(`  完成：${gated} 件套用傀異門檻，${fetchFailed} 件抓取失敗`);
  if (unknownMats.size) {
    console.warn(`  ⚠ 未知傀異素材（以 A5+ 保守處理）：${[...unknownMats].join("、")}`);
  }

  const stat = { confirmed: 0, inferred: 0, unverified: 0 };
  for (const e of Object.values(entries)) stat[e.c]++;

  const total = armors.length + weapons.length;
  const pct = (n) => `${((100 * n) / total).toFixed(1)}%`;
  console.log(`→ 解放條目 ${total} 件：confirmed ${stat.confirmed}（${pct(stat.confirmed)}）、` +
    `inferred ${stat.inferred}（${pct(stat.inferred)}）、unverified ${stat.unverified}（${pct(stat.unverified)}）`);

  const out = {
    meta: {
      source: "Kiranico 任務清單（村/集會所初階/進階/Master）× 裝備 sourceMonster 推導；TU 門檻為 Game8 確認之遊戲常數",
      fields: "v=村★ h=集會所★(1-3低位/4-8上位) m=Master★(MR章節) mr=MR等級門檻 note=附加條件(傀異研究等級) mon=推導來源魔物 c=信心度 src=推導方式",
      semantics: "多軸並存時任一軸達標即可製作",
    },
    monsters: {
      village: tracks.village,
      hubLow: tracks.hubLow,
      hubHigh: tracks.hubHigh,
      master: tracks.master,
    },
    entries,
  };
  fs.writeFileSync(path.join(DATA_DIR, "unlocks.json"), JSON.stringify(out, null, 1) + "\n");
  console.log("✓ 已寫入 src/data/unlocks.json");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
