import type { EfrInput, EfrResult } from "./efr";

/**
 * efr-world.ts — MHW: Iceborne 版 EFR（期望有效傷害）模型（PLAN-iceborne Phase 4）。
 *
 * 與 efr.ts（Rise）**完全同介面**：`computeEfr(EfrInput): EfrResult`、`EFR_RELEVANT_SKILLS`、
 * 斬味倍率表。用途相同：**同一武器種類內**為配裝排序提供客觀傷害指標，略去招式倍率/肉質
 * （同武器種為常數）；攻擊力採 Kiranico 顯示值（膨脹，同武器種可比）。
 *
 * ── 數值來源（禁止憑記憶硬編；KNOWN_MAX 半數錯的教訓）──
 * 逐級數值**機械抽取自 MHWorldData `skills/skill_levels.csv` 的 EN 描述**（Phase 2 快取源，
 * 與 world skills.json 同源）；描述無明確數字者（會心擊【屬性】倍率、龍脈覺醒）逐條對
 * **社群傷害公式 / Fextralife** 核對，每條在該常數上方附來源。所有近似假設見
 * `docs/efr-world-notes.md`。
 *
 * ── World 與 Rise 的機制差異（已逐條反映，不沿用 Rise 數字）──
 * - 攻擊 Attack Boost：World L4–7 給「flat + 會心 +5%」（非 Rise 的攻擊 %）。
 * - 挑戰者/看破/拔刀術【技】/屬性攻擊強化 逐級表與 Rise 不同（見各常數）。
 * - 會心擊【屬性】：World 為單級（會心攻擊【屬性】）+ set bonus 版（真‧會心擊【屬性】），
 *   倍率**依武器種**不同（GS/鎚/笛/重弩 較高）。
 * - 死裡逃生 Resuscitate：World 版為**迴避/耐力**（無傷害），故**不計入 EFR**（見 notes 與
 *   EFR_RELEVANT_SKILLS 未納入之說明）。低血攻擊技在 World 是「火場怪力 Heroics」。
 * - secret 解放（挑戰者 5→7、火場怪力 5→7、力量解放 5→7、精神抖擻 3→5）：本模型直接吃
 *   傳入 skills 的最終等級（已由 profile.resolveSkillMax 於 skill-calculator 截斷），逐級表
 *   涵蓋到解放後的最高級。
 */

/** 斬味段索引：0紅 1橙 2黃 3綠 4藍 5白 6紫。 */
// 來源：Fextralife「Sharpness」（MHW:IB）。raw/element 兩表與 Rise 一致（跨作沿用），
// 已對外部源核對（非憑記憶）：raw 紫1.39/白1.32/藍1.20；element 紫1.25/白1.15/藍1.0625。
const RAW_SHARP_MULT = [0.5, 0.75, 1.0, 1.05, 1.2, 1.32, 1.39];
const ELEM_SHARP_MULT = [0.25, 0.5, 0.75, 1.0, 1.0625, 1.15, 1.25];
const SHARP_COLOR_ZH = ["紅", "橙", "黃", "綠", "藍", "白", "紫"];

/**
 * 期望斬味消耗單位：一輪輸出視窗（一段不中斷連段/一次磨刀間隔內）約消耗的斬味單位數，
 * 用作「從色帶頂端往下取多長來加權平均倍率」的視窗寬度。**可調校準常數，非遊戲硬常數**。
 * 依據見 `docs/efr-world-notes.md` 第五節：CSV 斬味尺度下多數近戰每命中約耗 1 單位，
 * 一段主力連段約 30–60 命中；取 60 使「頂端主色主導、但薄層尖端（如 Fatalis base 紫10）
 * 仍與其下一色顯著混合」，正是讓匠在物理 EFR 上重新可見的關鍵寬度。
 */
const EXPECTED_SHARPNESS_USE = 60;

// ══ 無條件傷害技能（依等級索引，index 0 = 未持有）══
// Attack Boost（skill_levels：L1-3 flat +3/6/9；L4-7 flat +12/15/18/21 且 會心 +5%）。
const ATTACK_FLAT = [0, 3, 6, 9, 12, 15, 18, 21];
const ATTACK_AFF = [0, 0, 0, 0, 5, 5, 5, 5]; // World 攻擊在 L4+ 給會心（非攻擊 %）
// Critical Eye（Affinity +5/10/15/20/25/30/40%）。
const CRIT_EYE_AFF = [0, 5, 10, 15, 20, 25, 30, 40];
// Critical Boost（會心傷害倍率；基礎會心 1.25，L1-3 → 1.30/1.35/1.40）。
const CRIT_BOOST_DMG = [1.25, 1.3, 1.35, 1.4];
// Weakness Exploit（弱點 +10/15/30%，傷口再 +5/15/20%）。v1 **假設已軟化/傷口計滿**
// → 取弱點+傷口合計 15/30/50（見 efr-world-notes「弱點特效傷口加成」）。
const WEX_AFF = [0, 15, 30, 50];
// 屬性攻擊強化（Fire/Water/Thunder/Ice/Dragon 同表；顯示值尺度，L1-3 flat +30/60/100，
// L4-6 為 +5/10/20% 且「Bonus: +100」flat）。**v1 不建模屬性上限（elemental cap）**，
// 為已知高估來源（見 notes）。
const ELEM_ATK_FLAT = [0, 30, 60, 100, 100, 100, 100];
const ELEM_ATK_PCT = [0, 0, 0, 0, 0.05, 0.1, 0.2];

// ══ 條件型傷害技能（× 觸發率 CONDITIONAL_UPTIME）══
// Agitator 挑戰者（發怒時；max5，挑戰者‧極意解放 →7）：flat +4/8/12/16/20/24/28、
// 會心 +5/5/7/7/10/15/20%。
const AGITATOR_ATK = [0, 4, 8, 12, 16, 20, 24, 28];
const AGITATOR_AFF = [0, 5, 5, 7, 7, 10, 15, 20];
// Peak Performance 無傷（HP 全滿）：flat +5/10/20。
const PEAK_FLAT = [0, 5, 10, 20];
// Maximum Might 精神抖擻（耐力滿；max3，渾身‧極意解放 →5）：會心 +10/20/30/40/40%
// （L5 與 L4 同 40%，僅觸發更易）。
const MAX_MIGHT_AFF = [0, 10, 20, 30, 40, 40];
// Latent Power 力量解放（受傷/時間累積；max5，力量解放‧極意解放 →7）：會心
// +10/20/30/40/50/50/60%。
const LATENT_POWER_AFF = [0, 10, 20, 30, 40, 50, 50, 60];
// Critical Draw 拔刀術【技】（拔刀攻擊後）：會心 +30/60/100%。
const DRAW_TECH_AFF = [0, 30, 60, 100];
// Heroics 火場怪力（HP 低時；max5，火場怪力‧極意解放 →7）：攻擊 %。L1 僅防禦，
// L2-7 攻擊 +5/5/10/15/25/40%。
const HEROICS_ATK_PCT = [0, 0, 0.05, 0.05, 0.1, 0.15, 0.25, 0.4];
// Resentment 怨恨（有可回復紅血時）：flat +5/10/15/20/25。
const RESENTMENT_FLAT = [0, 5, 10, 15, 20, 25];
// Offensive Guard 攻擊守勢（成功防禦後）：攻擊 +5/10/15%。
const OFFENSIVE_GUARD_PCT = [0, 0.05, 0.1, 0.15];
// Coalescence 轉禍為福（狀態異常恢復後）：flat +12/15/18、屬性 +30/60/90（顯示值尺度）。
const COALESCENCE_FLAT = [0, 12, 15, 18];
const COALESCENCE_ELEM = [0, 30, 60, 90];

// ══ set bonus 賦予之傷害技能 ══
// True Critical Element 真‧會心擊【屬性】（set bonus，如銀火龍的真髓@4）：屬性會心強化版。
// Dragonvein Awakening 龍脈覺醒（Safi 3件）：會心 +20%、屬性 +80（顯示值）。
// True Dragonvein Awakening 真‧龍脈覺醒（Safi 5件）：會心 +40%、屬性 +150。
// 來源：Fextralife「(True) Dragonvein Awakening」。自傷/回復（生存面）不計入 EFR；
// 屬性上限提升 v1 不建模（見 notes）。「拔刀後/weapon drawn」近似為恆定（戰鬥中常態）。
const DRAGONVEIN_AFF = 20;
const DRAGONVEIN_ELEM = 80;
const TRUE_DRAGONVEIN_AFF = 40;
const TRUE_DRAGONVEIN_ELEM = 150;

// 會心擊【屬性】on-crit 屬性倍率：**依武器種**（來源：Fextralife/社群傷害公式；Kiranico
// 只暴露 on/off 旗標）。GS/鎚/笛/重弩：會心擊 1.50、真會心擊 1.70；其餘：1.35 / 1.55。
const HIGH_ELEM_CRIT_TYPES = new Set([
  "great-sword",
  "hammer",
  "hunting-horn",
  "heavy-bowgun",
]);
function critElemFactor(weaponType: string, critLv: number, trueCrit: boolean): number {
  const high = HIGH_ELEM_CRIT_TYPES.has(weaponType);
  if (trueCrit) return high ? 1.7 : 1.55;
  if (critLv > 0) return high ? 1.5 : 1.35;
  return 1.0; // 無會心擊【屬性】：會心不提升屬性傷害
}

const at = (arr: number[], lv: number) =>
  arr[Math.max(0, Math.min(lv, arr.length - 1))];

/**
 * 所有會影響 World EFR（物理或屬性期望傷害）的技能名稱（World zh 命名）。
 * 護石支配剪枝在 World 停用，但此集合仍供搜尋端判定「相關技能」與結果卡顯示。
 * 新增/移除 computeEfr 中參照的技能時，務必同步維護此集合。
 * **注意**：`死裡逃生`（World=Resuscitate，迴避/耐力，無傷害）**刻意未納入**。
 */
export const EFR_RELEVANT_SKILLS: ReadonlySet<string> = new Set([
  // 無條件傷害
  "攻擊", "看破", "超會心", "弱點特效", "匠",
  "火屬性攻擊強化", "水屬性攻擊強化", "雷屬性攻擊強化", "冰屬性攻擊強化", "龍屬性攻擊強化",
  "會心攻擊【屬性】",
  // 條件型傷害
  "挑戰者", "無傷", "精神抖擻", "力量解放", "拔刀術【技】",
  "火場怪力", "怨恨", "攻擊守勢", "轉禍為福",
  // set bonus 賦予之傷害技能
  "真‧會心擊【屬性】", "龍脈覺醒", "真‧龍脈覺醒",
]);

/**
 * 期望斬味倍率（尾巴：紫斬長度模型）。取代舊「最高填色 color-only」做法。
 *
 * 舊模型只取匠插值後的最高色乘數，故「base 已達最高色」的武器（Fatalis：base 已有薄紫 10）
 * 匠0/匠5 生效色同為紫、物理 EFR 不隨匠變（見 world-sharpness-audit 第四節的已知限制）。
 * 本模型改為**期望斬味倍率**：在匠決定的色帶上，自頂端（最高色）往下取
 * `EXPECTED_SHARPNESS_USE` 單位，依落入各色段的長度**加權平均** raw/element 倍率。
 * 匠愈高 → 頂端高色段愈長 → 視窗內高色佔比愈大 → 期望倍率單調不減（Fatalis 薄紫增厚即反映）。
 *
 * 匠等級仍如舊模型在 base↔max 間**依總長插值**求 reach、再以 max 色帶形狀截斷定出各色段長度
 * （與 activeSharpIndex 同一插值基礎，僅把「取頂色」換成「取頂端 60 單位加權」）。
 *
 * 回傳 { raw, elem, tipIdx }：raw/elem 為期望乘數；tipIdx 為最高填色段（供顯示 sharpColor）。
 * 無斬味資料（弩/弓）→ 中性黃(idx2)：raw 1.0、elem 0.75。
 *
 * **未建模**：剃刀銳利/砥石類（磨刀速度/斬味回復）技能不影響本視窗計算——它們改變的是磨刀
 * 頻率與紫斬耗損速率，非某一輪視窗內的色段構成，屬另一層近似（見 notes）。利刃 World 無此技能。
 */
function expectedSharp(
  sharpness: { base: number[]; max: number[] } | undefined,
  handicraftLv: number
): { raw: number; elem: number; tipIdx: number } {
  const NEUTRAL = { raw: RAW_SHARP_MULT[2], elem: ELEM_SHARP_MULT[2], tipIdx: 2 };
  if (!sharpness) return NEUTRAL; // 無斬味資料（弩/弓）→ 中性黃(1.0)
  const { base, max } = sharpness;
  const sum = (a: number[]) => a.reduce((s, v) => s + v, 0);
  const baseTotal = sum(base);
  const maxTotal = sum(max);
  const reach =
    baseTotal + (Math.min(handicraftLv, 5) / 5) * (maxTotal - baseTotal);

  // 依 max 色帶形狀截斷至 reach，得目前生效各色段長度 seg[i]（低色先填、高色最後）。
  const seg = new Array(7).fill(0);
  let cum = 0; // reach 之前已累積的色段長（不含當前色段）
  let tipIdx = 2;
  for (let i = 0; i < 7; i++) {
    if (max[i] <= 0) continue;
    const room = Math.max(0, Math.min(max[i], reach - cum));
    seg[i] = room;
    if (room > 0) tipIdx = i;
    cum += max[i];
    if (cum >= reach - 1e-6) break;
  }

  // 自頂端（高色）往下取 EXPECTED_SHARPNESS_USE 單位，依落入各色段長度加權平均。
  let remaining = EXPECTED_SHARPNESS_USE;
  let rawSum = 0;
  let elemSum = 0;
  let used = 0;
  for (let i = 6; i >= 0 && remaining > 1e-9; i--) {
    if (seg[i] <= 0) continue;
    const take = Math.min(seg[i], remaining);
    rawSum += take * RAW_SHARP_MULT[i];
    elemSum += take * ELEM_SHARP_MULT[i];
    used += take;
    remaining -= take;
  }
  if (used <= 0) return NEUTRAL; // 理論上不會（有斬味即有段），保底中性
  return { raw: rawSum / used, elem: elemSum / used, tipIdx };
}

/** 期望會心倍率：正會心以會心傷害計，負會心以 0.75×（−25%）計。與 efr.ts 同。 */
function expectedCritMult(affinity: number, critDmg: number): number {
  const a = Math.min(affinity, 100) / 100;
  if (a >= 0) return 1 + a * (critDmg - 1);
  return 1 + a * 0.25; // a 為負 → 降低（World 會心負傷 −25% 同 Rise）
}

/** 計算一套 World 配裝（武器 + 最終技能）的 EFR。介面與 efr.ts.computeEfr 一致。 */
export function computeEfr(input: EfrInput): EfrResult {
  const { weapon, skills } = input;
  const uptime = input.conditionalUptime ?? 0.75;
  const weakpoint = input.assumeWeakpoint ?? true;
  const lv = (name: string) => skills[name] ?? 0;

  // ── 攻擊力 ──
  const base = weapon.attack;
  let pct = 0;
  let flat = at(ATTACK_FLAT, lv("攻擊"));
  // 條件型攻擊（× 觸發率）
  flat += at(AGITATOR_ATK, lv("挑戰者")) * uptime;
  flat += at(PEAK_FLAT, lv("無傷")) * uptime;
  flat += at(RESENTMENT_FLAT, lv("怨恨")) * uptime;
  flat += at(COALESCENCE_FLAT, lv("轉禍為福")) * uptime;
  pct += at(HEROICS_ATK_PCT, lv("火場怪力")) * uptime;
  pct += at(OFFENSIVE_GUARD_PCT, lv("攻擊守勢")) * uptime;
  const effAttack = base * (1 + pct) + flat;

  // ── 會心率 ──
  let aff = weapon.affinity;
  aff += at(ATTACK_AFF, lv("攻擊")); // World 攻擊 L4+ 附會心
  aff += at(CRIT_EYE_AFF, lv("看破"));
  if (weakpoint) aff += at(WEX_AFF, lv("弱點特效"));
  aff += at(AGITATOR_AFF, lv("挑戰者")) * uptime;
  aff += at(MAX_MIGHT_AFF, lv("精神抖擻")) * uptime;
  aff += at(LATENT_POWER_AFF, lv("力量解放")) * uptime;
  aff += at(DRAW_TECH_AFF, lv("拔刀術【技】")) * uptime;
  // set bonus 龍脈覺醒（拔刀常態，不 × uptime）
  if (lv("真‧龍脈覺醒") > 0) aff += TRUE_DRAGONVEIN_AFF;
  else if (lv("龍脈覺醒") > 0) aff += DRAGONVEIN_AFF;

  const critDmg = at(CRIT_BOOST_DMG, lv("超會心"));
  const critMult = expectedCritMult(aff, critDmg);

  // ── 斬味（期望倍率：頂端 EXPECTED_SHARPNESS_USE 單位加權平均）──
  const sharp = expectedSharp(weapon.sharpness, lv("匠"));
  const sharpMult = sharp.raw;

  const raw = effAttack * sharpMult * critMult;

  // ── 屬性 ──（僅五屬性計入 EFR 屬性；狀態值 poison/blast 等不算屬性傷害）
  let element = 0;
  const TRUE_ELEMENTS: Record<string, string> = {
    fire: "火屬性攻擊強化",
    water: "水屬性攻擊強化",
    thunder: "雷屬性攻擊強化",
    ice: "冰屬性攻擊強化",
    dragon: "龍屬性攻擊強化",
  };
  if (weapon.element && weapon.element.value > 0 && TRUE_ELEMENTS[weapon.element.type]) {
    const skillName = TRUE_ELEMENTS[weapon.element.type];
    const elLv = lv(skillName);
    let elVal = weapon.element.value * (1 + at(ELEM_ATK_PCT, elLv)) + at(ELEM_ATK_FLAT, elLv);
    // set bonus 龍脈覺醒 屬性加成（顯示值 flat；v1 不建模屬性上限）
    if (lv("真‧龍脈覺醒") > 0) elVal += TRUE_DRAGONVEIN_ELEM;
    else if (lv("龍脈覺醒") > 0) elVal += DRAGONVEIN_ELEM;
    elVal += at(COALESCENCE_ELEM, lv("轉禍為福")) * uptime;
    const elSharp = sharp.elem;
    // 會心擊【屬性】：會心時屬性傷害提升（依武器種）。真‧會心擊【屬性】為強化版，優先。
    const critElem = critElemFactor(
      weapon.weaponType,
      lv("會心攻擊【屬性】"),
      lv("真‧會心擊【屬性】") > 0
    );
    const aPos = Math.max(0, Math.min(aff, 100)) / 100;
    const elCritMult = 1 + aPos * (critElem - 1);
    element = elVal * elSharp * elCritMult;
  }

  // 屬性以較小係數併入綜合指標（與 efr.ts 同：物理為主，屬性 ×4）
  const total = raw + element * 4.0;

  return {
    raw,
    element,
    total,
    effAttack,
    effAffinity: aff,
    critMult,
    sharpColor: SHARP_COLOR_ZH[sharp.tipIdx],
    sharpMult,
  };
}
