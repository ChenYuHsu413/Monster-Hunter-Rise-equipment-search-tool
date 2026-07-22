/**
 * World 引擎冒煙測試（PLAN Phase 3）。以 world profile + world 資料驅動 searchBuilds，
 * 驗證機制正確（搜得出、動態上限對、珠子累計對、護石來源對），
 * **不對 EFR 數值排序下結論**（efr-world 為 Phase 4；目前 efr 為 rise 佔位，
 * 故「首套」順序無意義，測試改為在結果集中掃描符合機制的配裝）。
 *
 *   node scripts/world/smoke-world.mjs [1|2|3|4|all]
 */
import { register } from "node:module";
import { pathToFileURL, fileURLToPath } from "node:url";
import path from "node:path";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
register("./scripts/regression-loader.mjs", pathToFileURL(REPO + path.sep).href);

const { searchBuilds } = await import("@/lib/build-search");
const { loadWorldSearchDeps, ensureWorldRegistered } = await import("@/lib/world-registry");

const deps = await loadWorldSearchDeps();
const world = await ensureWorldRegistered();

const RESERVED0 = { 4: 0, 3: 0, 2: 0, 1: 0 };
const NO_EXCL = { armorIds: [], weaponIds: [] };
const pick = (pred) => deps.weapons.find(pred);
const armorsBy = (fn) => deps.armors.filter(fn);
const PARTS = ["head", "chest", "arms", "waist", "legs"];

function countSetBonus(build) {
  const counts = {};
  for (const part of PARTS) {
    const id = build.armor[part]?.setBonusId;
    if (id) counts[id] = (counts[id] ?? 0) + 1;
  }
  return counts;
}
function setBonusStatus(build) {
  const out = [];
  for (const [id, cnt] of Object.entries(countSetBonus(build))) {
    const sb = world.setBonusById[id];
    if (!sb) continue;
    const triggered = sb.ranks.filter((r) => cnt >= r.pieces);
    if (triggered.length)
      out.push(`${sb.nameZh}×${cnt} → ${triggered.map((r) => `${r.skillName}(${r.pieces}件)`).join("、")}`);
  }
  return out;
}
function printBuild(r, label = "配裝") {
  console.log(`  ${label}：武器 ${r.weapon?.nameZh ?? r.weapon?.nameEn}`);
  for (const part of PARTS) {
    const p = r.armor[part];
    console.log(`    ${part}: ${p.nameZh}${p.setBonusId ? ` [${p.setBonusId}]` : ""}`);
  }
  console.log(`    護石: ${r.charm?.name ?? r.charm?.id ?? "無"} ${JSON.stringify(r.charm?.skills ?? {})}`);
  const sb = setBonusStatus(r);
  console.log(`    set bonus: ${sb.length ? sb.join(" ／ ") : "無"}`);
  console.log(`    finalSkills: ${JSON.stringify(r.finalSkills)}`);
  const dc = {};
  for (const d of r.decorations) dc[d.decorationName] = (dc[d.decorationName] ?? 0) + 1;
  console.log(`    珠子: ${Object.entries(dc).map(([n, c]) => (c > 1 ? `${n}×${c}` : n)).join("、") || "無"}`);
}

const which = process.argv[2] ?? "all";
const run = (n) => which === "all" || which === String(n);
const gsW = () => pick((w) => w.weaponType === "great-sword" && w.rarity === 12);
let pass = 0, fail = 0;
const assert = (cond, msg) => { if (cond) { pass++; console.log("  ✅ " + msg); } else { fail++; console.log("  ❌ " + msg); } };

// ═══ 測① Inheritance 全域解放（不固定防具，引擎自行湊出 Fatalis ≥2 件）═══
if (run(1)) {
  console.log("\n━━━ 測① Inheritance 全域解放：要求 挑戰者 Lv7（原生 5），不指定防具 ━━━");
  const { results, meta } = searchBuilds({
    weaponType: "great-sword", weaponSearchMode: "fixed", fixedWeaponId: gsW().id,
    charms: [], fixedParts: {}, excludedItems: NO_EXCL,
    requiredSkills: { 挑戰者: 7 }, excludedSkills: [], reservedSlots: RESERVED0,
    searchMode: "exact", resultLimit: 100,
  }, deps);
  console.log(`  結果數 ${results.length} / valid ${meta.validBuilds} / combos ${meta.combosEvaluated}`);
  // 掃描：存在含 Fatalis ≥2 件、經 Inheritance 使 挑戰者=7 的合法配裝
  const hit = results.find((r) => (countSetBonus(r)["sb_fatalis-legend"] ?? 0) >= 2 && r.finalSkills["挑戰者"] === 7);
  assert(!!hit, "結果集含『Fatalis ≥2 件 + 挑戰者=7』配裝（引擎無人工提示自組）");
  if (hit) { printBuild(hit, "命中"); assert(hit.finalSkills["挑戰者"] === 7, "挑戰者原生上限 5 → Inheritance 解放至 7"); }
}

// ═══ 測② 專屬極意路徑（排除 Fatalis，隔離 Inheritance）═══
if (run(2)) {
  console.log("\n━━━ 測② 專屬極意：排除 Fatalis，要求 力量解放 Lv7（原生 5）→ 應走 雷狼龍‧極意 ━━━");
  const fatalisIds = armorsBy((a) => a.setBonusId === "sb_fatalis-legend").map((a) => a.id);
  const { results, meta } = searchBuilds({
    weaponType: "great-sword", weaponSearchMode: "fixed", fixedWeaponId: gsW().id,
    charms: [], fixedParts: {}, excludedItems: { armorIds: fatalisIds, weaponIds: [] },
    requiredSkills: { 力量解放: 7 }, excludedSkills: [], reservedSlots: RESERVED0,
    searchMode: "exact", resultLimit: 100,
  }, deps);
  console.log(`  結果數 ${results.length} / valid ${meta.validBuilds} / combos ${meta.combosEvaluated}`);
  const hit = results.find((r) => (countSetBonus(r)["sb_zinogre-essence"] ?? 0) >= 3 && r.finalSkills["力量解放"] === 7);
  assert(!!hit, "結果集含『雷狼龍(Zinogre) ≥3 件 + 力量解放=7』配裝（專屬極意，非 Inheritance）");
  if (hit) { printBuild(hit, "命中"); assert(hit.finalSkills["力量解放"] === 7, "力量解放原生 5 → 力量解放‧極意 解放至 7"); }
  assert(results.every((r) => (countSetBonus(r)["sb_fatalis-legend"] ?? 0) === 0), "所有結果皆不含 Fatalis（排除生效，確為專屬極意路徑）");
}

// ═══ 測③ 複合珠 2-in-1 ═══
if (run(3)) {
  console.log("\n━━━ 測③ 複合珠 2-in-1（固定 Fatalis α+，要求 攻擊1 + 奪取耐力1）━━━");
  const byPart = {};
  for (const a of armorsBy((a) => a.setBonusId === "sb_fatalis-legend" && /α\+$/.test(a.nameEn))) byPart[a.part] ??= a;
  // 排除任何覆蓋目標技能的護石，逼兩技能都靠珠子補 → 複合珠 2-in-1 才有機會被選
  const req = { 攻擊: 1, 奪取耐力: 1 };
  const blockCharms = deps.world.charmPool
    .filter((c) => Object.keys(c.skills).some((s) => req[s]))
    .map((c) => c.id);
  const { results } = searchBuilds({
    weaponType: "great-sword", weaponSearchMode: "fixed", fixedWeaponId: gsW().id,
    charms: [], fixedParts: Object.fromEntries(PARTS.map((p) => [p, byPart[p].id])),
    excludedItems: { armorIds: [], weaponIds: [], charmIds: blockCharms },
    requiredSkills: req,
    excludedSkills: [], reservedSlots: RESERVED0, searchMode: "exact", resultLimit: 3,
  }, deps);
  const r = results[0];
  if (r) printBuild(r, "首套");
  const compound = r?.decorations.find((d) => /‧/.test(d.decorationName));
  assert(!!compound, `出現雙技能 Lv4 珠：${compound?.decorationName ?? "（無）"}`);
  assert(r?.finalSkills["攻擊"] >= 1 && r?.finalSkills["奪取耐力"] >= 1, `複合珠兩技能累計正確（攻擊=${r?.finalSkills["攻擊"]}、奪取耐力=${r?.finalSkills["奪取耐力"]}）`);
}

// ═══ 測④ 護石來自 charms.json，可固定/排除 ═══
if (run(4)) {
  console.log("\n━━━ 測④ 護石候選池（craftable-list）+ 固定/排除 ━━━");
  const base = {
    weaponType: "great-sword", weaponSearchMode: "fixed", fixedWeaponId: gsW().id,
    charms: [], fixedParts: {}, excludedItems: NO_EXCL,
    requiredSkills: { 攻擊: 5 }, excludedSkills: [], reservedSlots: RESERVED0,
    searchMode: "fast", resultLimit: 20,
  };
  // (a) 一般：護石應來自 charms.json（id 前綴 wcharm_）
  const r1 = searchBuilds(base, deps);
  const withCharm = r1.results.find((r) => r.charm?.id?.startsWith("wcharm_"));
  assert(!!withCharm, `結果護石來自 charms.json：${withCharm?.charm?.name ?? "（無帶護石結果）"}（charmsTried=${r1.meta.charmsTried}）`);
  // (b) 固定護石 攻擊護石Ⅲ（wcharm_6）→ 所有結果護石皆為它
  const r2 = searchBuilds({ ...base, fixedCharmId: "wcharm_6" }, deps);
  assert(r2.results.length > 0 && r2.results.every((r) => r.charm?.id === "wcharm_6"), `固定護石生效：全部結果護石 = 攻擊護石Ⅲ（wcharm_6）`);
  if (r2.results[0]) console.log(`    固定後首套護石: ${r2.results[0].charm?.name} ${JSON.stringify(r2.results[0].charm?.skills)}`);
  // (c) 排除 攻擊護石Ⅲ/Ⅳ → 結果不得再用它們
  const r3 = searchBuilds({ ...base, excludedItems: { armorIds: [], weaponIds: [], charmIds: ["wcharm_6", "wcharm_235"] } }, deps);
  assert(r3.results.every((r) => r.charm?.id !== "wcharm_6" && r.charm?.id !== "wcharm_235"), `排除護石生效：結果不含 wcharm_6/wcharm_235（charmsTried=${r3.meta.charmsTried}）`);
}

console.log(`\n═══ 冒煙結果：PASS ${pass} / FAIL ${fail} ═══`);
process.exit(fail ? 1 : 0);
