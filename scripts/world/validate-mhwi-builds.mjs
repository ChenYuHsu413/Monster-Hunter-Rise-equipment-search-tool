/**
 * World 推薦配裝驗證（Phase 6 Task C）。比照 Rise validate-recommended-builds.js：
 *   (1) 用我方資料重算每套 skillTotals（防具/珠/護石/set bonus）對 Game8 宣稱值，
 *       不符先分「Game8 錯 vs 我方資料錯」。
 *   (2) 核心技能 N 校準：抽畢業裝（worldEndgame/worldMeta），以 top-N 核心技能跑 World 搜尋，
 *       數幾筆有結果，找最佳 N（Rise 的 N=4 不可未驗照抄）。
 *
 *   node scripts/world/validate-mhwi-builds.mjs
 */
import { register } from "node:module";
import { pathToFileURL, fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import path from "node:path";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
register("./scripts/regression-loader.mjs", pathToFileURL(REPO + path.sep).href);
const { searchBuilds } = await import("@/lib/build-search");
const { loadWorldSearchDeps, ensureWorldRegistered } = await import("@/lib/world-registry");
const { selectWorldCoreSkillRows } = await import("@/lib/builder-import");

const load = (p) => JSON.parse(readFileSync(path.join(REPO, p), "utf8"));
const builds = load("src/data/world/recommended-builds.json").builds;
const armors = load("src/data/world/armors.json");
const decos = load("src/data/world/decorations.json");
const charms = load("src/data/world/charms.json");
const setBonuses = load("src/data/world/setBonuses.json");
const armorById = Object.fromEntries(armors.map((a) => [a.id, a]));
const decoById = Object.fromEntries(decos.map((d) => [d.id, d]));
const charmById = Object.fromEntries(charms.map((c) => [c.id, c]));
const sbById = Object.fromEntries(setBonuses.map((b) => [b.id, b]));

const world = await ensureWorldRegistered();
const deps = await loadWorldSearchDeps();
const profile = deps.world.profile;

const add = (m, k, v) => { m[k] = (m[k] ?? 0) + v; };

/** 用我方資料重算一套配裝的技能總表（未 clamp）。 */
function recompute(build) {
  const skills = {};
  for (const a of build.armor) {
    const ar = a.id ? armorById[a.id] : null;
    if (ar) for (const [k, v] of Object.entries(ar.skills || {})) add(skills, k, v);
    for (const d of a.decorations || []) {
      const dd = d.id ? decoById[d.id] : null;
      if (dd) for (const [k, v] of Object.entries(dd.skills || {})) add(skills, k, v * (d.count || 1));
    }
  }
  for (const w of build.weapons) for (const d of w.decorations || []) {
    const dd = d.id ? decoById[d.id] : null;
    if (dd) for (const [k, v] of Object.entries(dd.skills || {})) add(skills, k, v * (d.count || 1));
  }
  if (build.charm?.id) { const c = charmById[build.charm.id]; if (c) for (const [k, v] of Object.entries(c.skills || {})) add(skills, k, v); }
  // set bonus（防具 setBonusId 件數觸發）
  const counts = {};
  for (const a of build.armor) { const ar = a.id ? armorById[a.id] : null; if (ar?.setBonusId) add(counts, ar.setBonusId, 1); }
  const active = {};
  for (const [id, cnt] of Object.entries(counts)) { const sb = sbById[id]; if (!sb) continue; for (const r of sb.ranks) if (cnt >= r.pieces) { add(skills, r.skillName, r.skillLevel); add(active, r.skillName, r.skillLevel); } }
  // clamp（動態上限：依 active set bonus 解 secret）
  const clamped = {};
  for (const [k, v] of Object.entries(skills)) clamped[k] = Math.min(v, profile.resolveSkillMax(k, active));
  return { clamped, active };
}

// ═══ (1) 重算 vs Game8 ═══
console.log("━━━ (1) skillTotals 重算 vs Game8 宣稱 ━━━");
let exact = 0, off = 0, offUnmodeled = 0, offOther = 0;
const offExamples = [];
for (const b of builds) {
  const { clamped } = recompute(b);
  const claim = {};
  for (const s of b.skillTotals) if (s.id) claim[s.id] = Math.max(claim[s.id] ?? 0, s.level);
  let bad = 0, badLower = 0;
  for (const [k, lv] of Object.entries(claim)) {
    const got = clamped[k] ?? 0;
    if (Math.abs(got - lv) <= 1) continue; // ±1 容忍
    bad++;
    if (got < lv) badLower++; // 我方重算「低於」Game8 → 多為未模擬（覺醒/客製強化）貢獻
    if (offExamples.length < 10) offExamples.push(`${b.id} ${k}: 重算${got} vs Game8${lv}${(b.unmodeled?.awakened||b.unmodeled?.kjarr)?" [覺醒/Kjarr]":""}`);
  }
  if (bad === 0) exact++;
  else { off++; if ((b.unmodeled?.awakened || b.unmodeled?.kjarr) && badLower > 0) offUnmodeled++; else offOther++; }
}
console.log(`  ${exact}/${builds.length} 套核心技能重算與 Game8 相符（±1 容忍珠位/顯示差）；${off} 套有 >1 級差`);
console.log(`  分類：${offUnmodeled} 套為覺醒/Kjarr 未模擬武器貢獻（我方重算<Game8，非資料錯，屬引擎不模擬）；`);
console.log(`        ${offOther} 套其他（珠位計數/防具 skill 欄差；多為 Game8 宣稱含覺醒之非覺醒旗標建，或防具技能欄小差）`);
console.log("  樣本：");
for (const e of offExamples) console.log("    " + e);

// ═══ (2) N 校準 ═══
// 固定抽樣 10 筆（依 id 排序取樣，避免隨機不可複現），對每個 N 跑 World 搜尋數有無結果。
function sample10(pool) {
  return pool.filter((_, i) => i % Math.max(1, Math.floor(pool.length / 10)) === 0).slice(0, 10);
}
function calibrateN(label, pool) {
  console.log(`\n━━━ (2) 核心技能 N 校準（${label}，top-N → World 搜尋有無結果）━━━`);
  const sample = sample10(pool);
  for (const N of [3, 4, 5, 6]) {
    let hit = 0;
    const zero = [];
    for (const b of sample) {
      const { active } = recompute(b);
      const resolveMax = (name) => profile.resolveSkillMax(name, active);
      const rows = selectWorldCoreSkillRows(b, resolveMax, N);
      const req = {};
      for (const r of rows.rows) req[r.name] = r.level;
      const { results } = searchBuilds({
        weaponType: b.weaponType, weaponSearchMode: "search",
        charms: [], fixedParts: {}, excludedItems: { armorIds: [], weaponIds: [] },
        requiredSkills: req, excludedSkills: [], reservedSlots: { 4: 0, 3: 0, 2: 0, 1: 0 },
        searchMode: "fast", resultLimit: 5,
      }, deps);
      if (results.length > 0) hit++; else zero.push(`${b.weaponType}/${b.buildName}`);
    }
    console.log(`  N=${N}: ${hit}/${sample.length} 有結果` + (zero.length ? `  零結果: ${zero.join(" ; ")}` : ""));
  }
  console.log(`  抽樣: ${sample.map((b) => b.weaponType).join(", ")}`);
}
calibrateN("畢業裝 worldEndgame+worldMeta", builds.filter((b) => b.category === "worldEndgame" || b.category === "worldMeta"));
// A2：上位 worldHighRank 洞位/技能複雜度較畢業低，N 需獨立抽驗（畢業 N=5 未必適用）。
calibrateN("上位 worldHighRank（A2 base-game HR）", builds.filter((b) => b.category === "worldHighRank"));
