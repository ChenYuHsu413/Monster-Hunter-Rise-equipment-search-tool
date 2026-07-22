/**
 * Rise 搜尋回歸基準（PLAN-iceborne Phase 1a）。
 *
 * 最高原則：多遊戲改造期間 Rise 現有行為零改變。本腳本以固定的 10 組搜尋條件
 * 呼叫真實 searchBuilds，把完整結果（build id 序列 + 每套 EFR + 珠子配置 +
 * finalSkills + meta）序列化，逐位元比對。
 *
 *   node scripts/regression-baseline.mjs           # 印出摘要（不寫檔）
 *   node scripts/regression-baseline.mjs --write    # 建立/更新 baseline.json
 *   node scripts/regression-baseline.mjs --check     # 對比 baseline.json，逐位元
 *
 * 執行方式：本腳本自行 register 專用 loader（scripts/regression-loader.mjs），
 * 讓 Node 能載入 app 的 TS 原始碼與 `@/` alias、JSON import。不需額外 flag。
 *
 * 註（Phase 1c 資料搬移相容）：Rise 大資料（armors/weapons）優先讀 @/data/rise/，
 * 不存在時 fallback @/data/（1c 之前）。git mv 為逐位元搬移，故 baseline 值不受影響。
 */
import { register } from "node:module";
import { pathToFileURL, fileURLToPath } from "node:url";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
register(
  "./scripts/regression-loader.mjs",
  pathToFileURL(REPO_ROOT + path.sep).href
);

const BASELINE_DIR = path.join(REPO_ROOT, "scripts", ".regression");
const BASELINE_FILE = path.join(BASELINE_DIR, "baseline.json");

// ---- 動態載入 app 程式碼（須在 register 之後）----
const { searchBuilds, createSearchDeps } = await import("@/lib/build-search");

async function riseJSON(name) {
  for (const base of ["@/data/rise", "@/data"]) {
    try {
      return (await import(`${base}/${name}.json`)).default;
    } catch {
      /* try next */
    }
  }
  throw new Error(`cannot load Rise data: ${name}`);
}

const armors = await riseJSON("armors");
const weapons = await riseJSON("weapons");

function indexById(items) {
  const m = {};
  for (const it of items) m[it.id] = it;
  return m;
}
const gameData = {
  armors,
  weapons,
  armorById: indexById(armors),
  weaponById: indexById(weapons),
};
const deps = createSearchDeps(gameData);

// ---- 決定性武器挑選：同類型內以 attack 降冪、id 升冪 tie-break，取第 n 名 ----
function pickWeapon(weaponType, n = 0) {
  const arr = weapons
    .filter((w) => w.weaponType === weaponType)
    .sort((a, b) => b.attack - a.attack || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return arr[n]?.id;
}
// 決定性防具挑選（排除清單用）：某部位 id 升冪前 n 個
function pickArmorIds(part, n) {
  return armors
    .filter((a) => a.part === part)
    .map((a) => a.id)
    .sort()
    .slice(0, n);
}

const RESERVED0 = { 4: 0, 3: 0, 2: 0, 1: 0 };
const NO_EXCL = { armorIds: [], weaponIds: [] };

// ---- 10 組固定情境（涵蓋 PLAN 要求的各軸）----
const SCENARIOS = [
  {
    name: "01_fixed-weapon_atk5_nocharm_fast",
    req: {
      weaponType: "long-sword",
      weaponSearchMode: "fixed",
      fixedWeaponId: pickWeapon("long-sword", 0),
      charms: [],
      fixedParts: {},
      excludedItems: NO_EXCL,
      requiredSkills: { 攻擊: 5 },
      excludedSkills: [],
      reservedSlots: RESERVED0,
      searchMode: "fast",
      resultLimit: 20,
    },
  },
  {
    name: "02_search-ls_atk4-crit3_fast",
    req: {
      weaponType: "long-sword",
      weaponSearchMode: "search",
      charms: [],
      fixedParts: {},
      excludedItems: NO_EXCL,
      requiredSkills: { 攻擊: 4, 看破: 3 },
      excludedSkills: [],
      reservedSlots: RESERVED0,
      searchMode: "fast",
      resultLimit: 20,
    },
  },
  {
    name: "03_search-gs_wex3-critboost3_charm_exact",
    req: {
      weaponType: "great-sword",
      weaponSearchMode: "search",
      charms: [{ id: "charm_wex", skills: { 弱點特效: 2 }, slots: [1] }],
      fixedParts: {},
      excludedItems: NO_EXCL,
      requiredSkills: { 弱點特效: 3, 超會心: 3 },
      excludedSkills: [],
      reservedSlots: RESERVED0,
      searchMode: "exact",
      resultLimit: 20,
    },
  },
  {
    name: "04_search-bow_firefilter_atk4_fast",
    req: {
      weaponType: "bow",
      weaponSearchMode: "search",
      elementFilter: "fire",
      charms: [],
      fixedParts: {},
      excludedItems: NO_EXCL,
      requiredSkills: { 攻擊: 4 },
      excludedSkills: [],
      reservedSlots: RESERVED0,
      searchMode: "fast",
      resultLimit: 20,
    },
  },
  {
    name: "05_search-db_handi3-atk4_reserved2x1_fast",
    req: {
      weaponType: "dual-blades",
      weaponSearchMode: "search",
      charms: [],
      fixedParts: {},
      excludedItems: NO_EXCL,
      requiredSkills: { 匠: 3, 攻擊: 4 },
      excludedSkills: [],
      reservedSlots: { 4: 0, 3: 0, 2: 1, 1: 0 },
      searchMode: "fast",
      resultLimit: 20,
    },
  },
  {
    name: "06_search-ls_heavy-req_charm_exact",
    req: {
      weaponType: "long-sword",
      weaponSearchMode: "search",
      charms: [{ id: "charm_atk", skills: { 攻擊: 2 }, slots: [1] }],
      fixedParts: {},
      excludedItems: NO_EXCL,
      requiredSkills: { 攻擊: 5, 看破: 5, 超會心: 3 },
      excludedSkills: [],
      reservedSlots: RESERVED0,
      searchMode: "exact",
      resultLimit: 20,
    },
  },
  {
    name: "07_search-gs_excluded-armor_atk4_fast",
    req: {
      weaponType: "great-sword",
      weaponSearchMode: "search",
      charms: [],
      fixedParts: {},
      excludedItems: { armorIds: pickArmorIds("head", 3), weaponIds: [] },
      requiredSkills: { 攻擊: 4 },
      excludedSkills: [],
      reservedSlots: RESERVED0,
      searchMode: "fast",
      resultLimit: 20,
    },
  },
  {
    name: "08_search-hammer_excludedskill_atk4_fast",
    req: {
      weaponType: "hammer",
      weaponSearchMode: "search",
      charms: [],
      fixedParts: {},
      excludedItems: NO_EXCL,
      requiredSkills: { 攻擊: 4 },
      excludedSkills: ["業物"],
      reservedSlots: RESERVED0,
      searchMode: "fast",
      resultLimit: 20,
    },
  },
  {
    name: "09_search-ls_maxed_2charms_greedy",
    req: {
      weaponType: "long-sword",
      weaponSearchMode: "search",
      charms: [
        { id: "charm_a", skills: { 攻擊: 3 }, slots: [1] },
        { id: "charm_b", skills: { 看破: 3 }, slots: [2] },
      ],
      fixedParts: {},
      excludedItems: NO_EXCL,
      requiredSkills: { 攻擊: 7, 看破: 7 },
      excludedSkills: [],
      reservedSlots: RESERVED0,
      searchMode: "greedy",
      resultLimit: 20,
    },
  },
  {
    name: "10_search-cb_focus3-atk4_mindef_fast",
    req: {
      weaponType: "charge-blade",
      weaponSearchMode: "search",
      minDefense: 300,
      charms: [],
      fixedParts: {},
      excludedItems: NO_EXCL,
      requiredSkills: { 集中: 3, 攻擊: 4 },
      excludedSkills: [],
      reservedSlots: RESERVED0,
      searchMode: "fast",
      resultLimit: 20,
    },
  },
];

// ---- 每套結果的精簡序列化（保留所有影響行為的欄位）----
function serializeResult(r) {
  return {
    id: r.id,
    efr: r.efr, // 已 Math.round 為整數
    finalSkills: r.finalSkills,
    remainingSlots: r.remainingSlots,
    totalDefense: r.totalDefense,
    decorations: r.decorations.map((d) => ({
      decorationId: d.decorationId,
      skillName: d.skillName,
      skillLevel: d.skillLevel,
      slotLevel: d.slotLevel,
      placedInSlotLevel: d.placedInSlotLevel,
      source: d.source,
    })),
  };
}

function runAll() {
  const out = {};
  for (const sc of SCENARIOS) {
    const { results, meta } = searchBuilds(sc.req, deps); // now 預設 ()=>0，決定性
    out[sc.name] = {
      fixedWeaponId: sc.req.fixedWeaponId ?? null,
      meta: {
        combosEvaluated: meta.combosEvaluated,
        validBuilds: meta.validBuilds,
        truncated: meta.truncated,
        mode: meta.mode,
        candidatesPerPart: meta.candidatesPerPart,
        weaponsTried: meta.weaponsTried,
        charmsTried: meta.charmsTried,
      },
      resultCount: results.length,
      results: results.map(serializeResult),
    };
  }
  return out;
}

// ---- 逐位元比對 ----
function deepFindDiff(a, b, pathStr = "") {
  const sa = JSON.stringify(a);
  const sb = JSON.stringify(b);
  if (sa === sb) return null;
  if (
    a && b && typeof a === "object" && typeof b === "object" &&
    !Array.isArray(a) && !Array.isArray(b)
  ) {
    const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])];
    for (const k of keys) {
      const d = deepFindDiff(a[k], b[k], pathStr ? `${pathStr}.${k}` : k);
      if (d) return d;
    }
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length)
      return `${pathStr}: array length ${a.length} → ${b.length}`;
    for (let i = 0; i < a.length; i++) {
      const d = deepFindDiff(a[i], b[i], `${pathStr}[${i}]`);
      if (d) return d;
    }
  }
  return `${pathStr}: ${sa?.slice(0, 120)} → ${sb?.slice(0, 120)}`;
}

function summarize(data) {
  const lines = [];
  for (const [name, v] of Object.entries(data)) {
    lines.push(
      `  ${name}: results=${v.resultCount} valid=${v.meta.validBuilds} combos=${v.meta.combosEvaluated} weaponsTried=${v.meta.weaponsTried} charmsTried=${v.meta.charmsTried} topEFR=${v.results[0]?.efr.total ?? "-"}`
    );
  }
  return lines.join("\n");
}

const mode = process.argv.includes("--write")
  ? "write"
  : process.argv.includes("--check")
    ? "check"
    : "print";

const current = runAll();

if (mode === "write") {
  mkdirSync(BASELINE_DIR, { recursive: true });
  writeFileSync(BASELINE_FILE, JSON.stringify(current, null, 2) + "\n", "utf8");
  console.log("[regression] baseline WRITTEN:", path.relative(REPO_ROOT, BASELINE_FILE));
  console.log(summarize(current));
} else if (mode === "check") {
  if (!existsSync(BASELINE_FILE)) {
    console.error("[regression] no baseline.json — run --write first");
    process.exit(2);
  }
  const baseline = JSON.parse(readFileSync(BASELINE_FILE, "utf8"));
  const names = [...new Set([...Object.keys(baseline), ...Object.keys(current)])];
  let failed = 0;
  for (const name of names) {
    const diff = deepFindDiff(baseline[name], current[name], name);
    if (diff) {
      failed++;
      console.error(`[regression] MISMATCH ${name}\n    ${diff}`);
    } else {
      console.log(`[regression] OK       ${name}`);
    }
  }
  if (failed) {
    console.error(`\n[regression] FAILED: ${failed}/${names.length} scenario(s) differ from baseline.`);
    process.exit(1);
  }
  console.log(`\n[regression] PASS: all ${names.length} scenarios bit-for-bit identical to baseline.`);
} else {
  console.log("[regression] print mode (no baseline written). Summary:");
  console.log(summarize(current));
}
