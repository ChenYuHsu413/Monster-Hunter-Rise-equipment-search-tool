/**
 * 複合珠 solver 有界修復 — 真實資料前後對照 + 決定性（尾巴 D，需求 2/5）。
 *   (A) Phase 3 冒煙③情境重跑：技能逼上珠子時，複合珠 2-in-1 被選（貪婪 bonus 既有能力）。
 *   (B) 真實資料前後對照：掃描真實防具組合，找出「貪婪失敗 → 有界修復成功」的實例，
 *       證明修復在真實搜尋確實新增有效配裝（修正貪婪過度搶大洞給複合珠的次優）。
 *   (C) 自由 4 技能搜尋自然出現複合珠（技能數 > 護石可涵蓋 → 逼上珠子 → 選複合珠）。
 *   (D) 決定性：同條件搜尋連跑兩次，結果逐位元一致。
 *
 *   node scripts/world/smoke-repair-realdata.mjs
 */
import { register } from "node:module";
import { pathToFileURL, fileURLToPath } from "node:url";
import path from "node:path";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
register("./scripts/regression-loader.mjs", pathToFileURL(REPO + path.sep).href);

const { searchBuilds } = await import("@/lib/build-search");
const { loadWorldSearchDeps } = await import("@/lib/world-registry");
const { greedySolveDecorations, solveDecorations } = await import("@/lib/decoration-solver");
const { collectSlots } = await import("@/lib/slot-utils");
const { calculateSkills, mergeSkills } = await import("@/lib/skill-calculator");

const deps = await loadWorldSearchDeps();
const PARTS = ["head", "chest", "arms", "waist", "legs"];
const gs = deps.weapons.find((w) => w.weaponType === "great-sword" && w.rarity === 12);

let pass = 0, fail = 0;
const assert = (c, m) => { if (c) { pass++; console.log("  ✅ " + m); } else { fail++; console.log("  ❌ " + m); } };
const hasCompound = (r) => r.decorations.some((d) => /‧/.test(d.decorationName));

// ═══ (A) Phase 3 冒煙③情境：逼技能上珠 → 複合珠被選 ═══
console.log("\n━━━ (A) 冒煙③重跑：固定 Fatalis α+、排除相關護石 → 複合珠 2-in-1 ━━━");
{
  const byPart = {};
  for (const a of deps.armors.filter((a) => a.setBonusId === "sb_fatalis-legend" && /α\+$/.test(a.nameEn))) byPart[a.part] ??= a;
  const req = { 攻擊: 1, 奪取耐力: 1 };
  const blockCharms = deps.world.charmPool.filter((c) => Object.keys(c.skills).some((s) => req[s])).map((c) => c.id);
  const { results } = searchBuilds({
    weaponType: "great-sword", weaponSearchMode: "fixed", fixedWeaponId: gs.id,
    charms: [], fixedParts: Object.fromEntries(PARTS.map((p) => [p, byPart[p].id])),
    excludedItems: { armorIds: [], weaponIds: [], charmIds: blockCharms },
    requiredSkills: req, excludedSkills: [], reservedSlots: { 4: 0, 3: 0, 2: 0, 1: 0 }, searchMode: "exact", resultLimit: 3,
  }, deps);
  assert(results[0] && hasCompound(results[0]), `複合珠出現：${results[0]?.decorations.map((d) => d.decorationName).join("、")}`);
}

// ═══ (B) 真實資料前後對照：貪婪失敗 → 修復成功（掃描找實例）═══
// 決定性掃描（stride 取樣真實防具組合），找第一個「greedy 失敗但 repair 成功」的組合。
console.log("\n━━━ (B) 真實資料前後對照：貪婪失敗 → 有界修復成功（修正過度搶大洞）━━━");
{
  const armorByPart = {};
  for (const p of PARTS) armorByPart[p] = deps.armors.filter((a) => a.part === p);
  const req = { 攻擊: 2, 奪取耐力: 1, 無傷: 1 }; // 奪氣‧攻擊珠(攻擊+奪取耐力,slot4) 為相關複合珠
  const stride = (arr, k) => arr[(k * 7919) % arr.length];
  let found = null;
  for (let k = 0; k < 4000 && !found; k++) {
    const pieces = PARTS.map((p, i) => stride(armorByPart[p], k * 5 + i));
    const slots = collectSlots(pieces, { skills: {}, slots: [] }, gs.slots);
    const cur = mergeSkills(calculateSkills(pieces, undefined), gs.skills ?? {});
    const input = { slots, currentSkills: cur, requiredSkills: req, reservedSlots: { 4: 0, 3: 0, 2: 0, 1: 0 }, decorationsBySkill: deps.decorationsBySkill, skillMax: deps.skillMax };
    const g = greedySolveDecorations(input);
    const s = solveDecorations(input);
    if (!g.success && s.success) found = { pieces, slots, g, s };
  }
  if (found) {
    console.log(`  組合洞池 ${JSON.stringify(found.slots)}（req 攻擊2/奪取耐力1/無傷1）`);
    console.log(`  舊(貪婪)：success=${found.g.success} missing=${JSON.stringify(found.g.missingRequired)} 珠=${JSON.stringify(found.g.assignments.map((a) => a.decorationName))}`);
    console.log(`  新(修復)：success=${found.s.success} 珠=${JSON.stringify(found.s.assignments.map((a) => a.decorationName))}`);
  }
  assert(!!found, "真實資料存在『貪婪失敗 → 修復成功』組合（修復在實戰確實新增有效配裝）");
  assert(found && !found.g.success && found.s.success, "同一組合：舊貪婪 fail、新修復 success（前後對照）");
}

// ═══ (C) 自由搜尋自然出現複合珠（4 技能 > 護石可涵蓋）═══
console.log("\n━━━ (C) 自由搜尋自然出現複合珠：固定 Fatalis α+，不排除護石，4 技能 ━━━");
{
  const byPart = {};
  for (const a of deps.armors.filter((a) => a.setBonusId === "sb_fatalis-legend" && /α\+$/.test(a.nameEn))) byPart[a.part] ??= a;
  const { results } = searchBuilds({
    weaponType: "great-sword", weaponSearchMode: "fixed", fixedWeaponId: gs.id,
    charms: [], fixedParts: Object.fromEntries(PARTS.map((p) => [p, byPart[p].id])),
    excludedItems: { armorIds: [], weaponIds: [] },
    requiredSkills: { 攻擊: 1, 奪取耐力: 1, 無傷: 1, 超會心: 1 }, excludedSkills: [], reservedSlots: { 4: 0, 3: 0, 2: 0, 1: 0 }, searchMode: "exact", resultLimit: 20,
  }, deps);
  const withC = results.find(hasCompound);
  assert(!!withC, `自由搜尋（無排除護石）結果自然含複合珠：${withC?.decorations.map((d) => d.decorationName).join("、") ?? "（無）"}`);
}

// ═══ (D) 決定性：同條件搜尋連跑兩次逐位元一致 ═══
console.log("\n━━━ (D) 決定性：同條件 World 搜尋連跑兩次逐位元一致 ━━━");
{
  const reqBase = {
    weaponType: "great-sword", weaponSearchMode: "fixed", fixedWeaponId: gs.id,
    charms: [], fixedParts: {}, excludedItems: { armorIds: [], weaponIds: [] },
    requiredSkills: { 攻擊: 2, 奪取耐力: 1, 無傷: 1 }, excludedSkills: [], reservedSlots: { 4: 0, 3: 0, 2: 0, 1: 0 }, searchMode: "exact", resultLimit: 50,
  };
  const a = JSON.stringify(searchBuilds(reqBase, deps).results.map((r) => [r.id, r.decorations.map((d) => d.decorationId)]));
  const b = JSON.stringify(searchBuilds(reqBase, deps).results.map((r) => [r.id, r.decorations.map((d) => d.decorationId)]));
  assert(a === b, "同輸入兩次搜尋結果逐位元一致");
}

console.log(`\n═══ 真實資料前後對照：PASS ${pass} / FAIL ${fail} ═══`);
process.exit(fail ? 1 : 0);
