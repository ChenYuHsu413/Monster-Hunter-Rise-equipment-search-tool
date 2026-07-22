/**
 * 跨 session 整合冒煙（尾巴 D 動了共用補珠路徑，A–C 成果各抽一條關鍵案例重驗）。
 *   (a) Session A：推薦上位卡「以此為基礎修改」→ 匯入核心技能搜尋有結果。
 *   (b) Session B：Fatalis 匠 0→5 EFR 嚴格單調上升。
 *   (c) Session C：武器追加 4 級洞 → 補珠使用該洞；特別驗「複合珠(slot4)能進追加洞」。
 *
 *   node scripts/world/smoke-cross-session.mjs
 */
import { register } from "node:module";
import { pathToFileURL, fileURLToPath } from "node:url";
import path from "node:path";
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
register("./scripts/regression-loader.mjs", pathToFileURL(REPO + path.sep).href);

const { searchBuilds } = await import("@/lib/build-search");
const { computeEfr } = await import("@/lib/efr-world");
const { loadWorldSearchDeps, ensureWorldRegistered } = await import("@/lib/world-registry");
const { buildWorldFullBuildImport } = await import("@/lib/builder-import");
const { applyWeaponAugment } = await import("@/lib/world-weapon-augment");
const { solveDecorations } = await import("@/lib/decoration-solver");
const { collectSlots } = await import("@/lib/slot-utils");
const recoRaw = (await import("@/data/world/recommended-builds.json")).default;
const recoBuilds = Array.isArray(recoRaw)
  ? recoRaw
  : recoRaw.builds ?? Object.values(recoRaw).find(Array.isArray) ?? [];

const deps = await loadWorldSearchDeps();
const world = await ensureWorldRegistered();
let pass = 0, fail = 0;
const assert = (c, m) => { if (c) { pass++; console.log("  ✅ " + m); } else { fail++; console.log("  ❌ " + m); } };

// ═══ (a) Session A：推薦「以此為基礎修改」匯入 → 搜尋有結果 ═══
console.log("\n━━━ (a) Session A：推薦上位卡匯入核心技能 → 搜尋有結果 ━━━");
{
  const build = recoBuilds.find((b) => (b.skillTotals?.length ?? 0) >= 4 && b.weaponType && b.charm);
  const resolveMax = (name) => world.data.skillMax[name] ?? Infinity;
  const imp = buildWorldFullBuildImport(build, resolveMax);
  console.log(`  匯入自 ${build.buildName ?? build.id}（${imp.weaponType}）核心技能 ${imp.importedCount}/${imp.totalCount}：${JSON.stringify(imp.requiredSkills)}`);
  const { results, meta } = searchBuilds({
    weaponType: imp.weaponType, weaponSearchMode: "search",
    charms: [], fixedParts: {}, excludedItems: { armorIds: [], weaponIds: [] },
    ...(imp.fixedCharmId ? { fixedCharmId: imp.fixedCharmId } : {}),
    requiredSkills: imp.requiredSkills, excludedSkills: [], reservedSlots: { 4: 0, 3: 0, 2: 0, 1: 0 },
    searchMode: "fast", resultLimit: 20,
  }, deps);
  console.log(`  搜尋結果 ${results.length} 套 / valid ${meta.validBuilds}`);
  assert(results.length > 0, "匯入核心技能後搜尋有結果（推薦匯入路徑經共用補珠仍正常）");
}

// ═══ (b) Session B：Fatalis 匠 0→5 EFR 嚴格單調上升 ═══
console.log("\n━━━ (b) Session B：Black Fatalis Blade 匠 0→5 EFR 嚴格單調上升 ━━━");
{
  const w = deps.weapons.find((x) => x.nameEn === "Black Fatalis Blade");
  const sk = { 挑戰者: 7, 超會心: 3, 弱點特效: 3 };
  const raws = [];
  for (let h = 0; h <= 5; h++) raws.push(computeEfr({ weapon: w, skills: { ...sk, 匠: h } }).raw);
  console.log(`  匠0→5 raw：${raws.map((r) => r.toFixed(1)).join(" → ")}`);
  let mono = true;
  for (let h = 1; h <= 5; h++) if (!(raws[h] > raws[h - 1])) mono = false;
  assert(mono, "Fatalis 匠 0→5 EFR raw 嚴格單調上升（期望斬味模型未受 D 影響）");
}

// ═══ (c) Session C：追加 4 級洞 → 補珠使用；複合珠能進追加洞 ═══
console.log("\n━━━ (c) Session C：武器追加 4 級洞 → 補珠使用（複合珠 slot4 進追加洞）━━━");
{
  // 無洞防具/護石，武器本身無洞；唯一可用洞＝追加的 4 級洞。要求需複合珠 slot4 的兩技能。
  const noSlotPieces = Array.from({ length: 5 }, () => ({ slots: [] }));
  const noCharm = { skills: {}, slots: [] };
  const augSlots = applyWeaponAugment({ slots: [] }, { attack: 0, affinity: 0, element: 0, slot: 4, defense: 0, setBonusId: "" }).slots;
  console.log(`  武器追加洞：${JSON.stringify(augSlots)}（唯一可用洞）`);
  const solve = solveDecorations({
    slots: collectSlots(noSlotPieces, noCharm, augSlots),
    currentSkills: {},
    requiredSkills: { 攻擊: 1, 奪取耐力: 1 }, // 奪氣‧攻擊珠【4】(slot4) 一顆同補兩技能
    reservedSlots: { 4: 0, 3: 0, 2: 0, 1: 0 },
    decorationsBySkill: deps.decorationsBySkill, skillMax: deps.skillMax,
  });
  const compound = solve.assignments.find((a) => /‧/.test(a.decorationName));
  console.log(`  補珠：success=${solve.success} 珠=${JSON.stringify(solve.assignments.map((a) => a.decorationName))} placedIn=${JSON.stringify(solve.assignments.map((a) => a.placedInSlotLevel))}`);
  assert(solve.success && !!compound && compound.placedInSlotLevel === 4,
    "複合珠(slot4)成功放入武器追加的 4 級洞（C×D 交互正常）");
  assert(solve.achievedSkills["攻擊"] >= 1 && solve.achievedSkills["奪取耐力"] >= 1, "追加洞的複合珠兩技能皆達成");
}

console.log(`\n═══ 跨 session 整合冒煙：PASS ${pass} / FAIL ${fail} ═══`);
process.exit(fail ? 1 : 0);
