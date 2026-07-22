/**
 * 複合珠 solver 有界交換後處理自測（尾巴 D）。
 * 3 個手工設計案例：貪婪失敗/次優，有界修復找到解。手工推導寫在各案例註解。
 * 另含決定性檢查（同輸入連跑兩次逐位元一致）。
 *
 *   node scripts/world/test-decoration-repair.mjs
 */
import { register } from "node:module";
import { pathToFileURL, fileURLToPath } from "node:url";
import path from "node:path";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
register("./scripts/regression-loader.mjs", pathToFileURL(REPO + path.sep).href);

const { solveDecorations, greedySolveDecorations } = await import("@/lib/decoration-solver");

let pass = 0, fail = 0;
const assert = (c, m) => { if (c) { pass++; console.log("  ✅ " + m); } else { fail++; console.log("  ❌ " + m); } };
const names = (r) => r.assignments.map((a) => a.decorationName).sort();
const RES0 = { 4: 0, 3: 0, 2: 0, 1: 0 };
// 珠：single(id,slot,skill) 單技能；compound(id,slot,{a,b}) 複合。
const single = (id, slot, sk) => ({ id, nameZh: id, slotLevel: slot, skillName: sk, skillLevel: 1, skills: { [sk]: 1 } });
const compound = (id, slot, skills) => ({ id, nameZh: id, slotLevel: slot, skillName: Object.keys(skills)[0], skillLevel: skills[Object.keys(skills)[0]], skills });

// ───────────────────────────────────────────────────────────────────────────
// 案例 1（E：貪婪過度搶大洞給複合珠 → 餓死大洞技能；偏好單珠 alt 修復）
//   required {A:1,B:1,C:1}；洞池 [4,2,2]。
//   珠：A/B 各有小單珠(slot2)；複合 cAB(slot4:{A,B})；C 只有大單珠 bigC(slot4)。
//   貪婪(偏好複合)：處理 A → cAB 附贈涵蓋 B → 選 cAB 佔 slot4；B 已補；
//     C 只剩 [2,2]，bigC 需 slot4 → 無處放 → 失敗（missing C）。
//   最優：singleA(2)+singleB(2)+bigC(4) 恰填 [4,2,2] → 成功。偏好單珠 alt 即得此解。
// ───────────────────────────────────────────────────────────────────────────
{
  console.log("案例 1（E：偏好單珠修復，貪婪搶大洞餓死 bigC）");
  const deco = {
    A: [single("sA", 2, "A"), compound("cAB", 4, { A: 1, B: 1 })],
    B: [single("sB", 2, "B"), compound("cAB", 4, { A: 1, B: 1 })],
    C: [single("bigC", 4, "C")],
  };
  const input = { slots: [4, 2, 2], currentSkills: {}, requiredSkills: { A: 1, B: 1, C: 1 }, reservedSlots: RES0, decorationsBySkill: deco, skillMax: { A: 1, B: 1, C: 1 } };
  const g = greedySolveDecorations(input);
  const s = solveDecorations(input);
  console.log(`  舊(貪婪)：success=${g.success} 珠=${JSON.stringify(g.assignments.map((a) => a.decorationName))} missing=${JSON.stringify(g.missingRequired)}`);
  console.log(`  新(修復)：success=${s.success} 珠=${JSON.stringify(s.assignments.map((a) => a.decorationName))}`);
  assert(!g.success, "舊貪婪失敗（cAB 佔 slot4 → bigC 無處放）");
  assert(s.success && names(s).join(",") === "bigC,sA,sB", "新解成功：singleA+singleB+bigC");
}

// ───────────────────────────────────────────────────────────────────────────
// 案例 2（depth-1 複合珠 seed 修復；偏好單珠亦失敗）
//   required {A:1,B:1,C:1}；洞池 [4,2]。
//   珠：A[sA(2), cAB(4:{A,B})]；B[sB(2), cAB, cBC(4:{B,C})]；C[bigC(4), cBC]。
//   貪婪(偏好複合)：A → cAB 佔 slot4；B 已補；C(bigC/cBC 皆 slot4)只剩[2] → 失敗。
//   偏好單珠：A→sA(2)佔 slot2；B→sB(2)佔 slot4；C 只剩[] → 失敗。
//   depth-1 seed cBC(4:{B,C})：佔 slot4 補 B,C；剩[2] → 貪婪補 A=sA(2) → 成功。
// ───────────────────────────────────────────────────────────────────────────
{
  console.log("案例 2（depth-1 seed cBC 修復；貪婪與偏好單珠皆失敗）");
  const deco = {
    A: [single("sA", 2, "A"), compound("cAB", 4, { A: 1, B: 1 })],
    B: [single("sB", 2, "B"), compound("cAB", 4, { A: 1, B: 1 }), compound("cBC", 4, { B: 1, C: 1 })],
    C: [single("bigC", 4, "C"), compound("cBC", 4, { B: 1, C: 1 })],
  };
  const input = { slots: [4, 2], currentSkills: {}, requiredSkills: { A: 1, B: 1, C: 1 }, reservedSlots: RES0, decorationsBySkill: deco, skillMax: { A: 1, B: 1, C: 1 } };
  const g = greedySolveDecorations(input);
  const s = solveDecorations(input);
  console.log(`  舊(貪婪)：success=${g.success} missing=${JSON.stringify(g.missingRequired)}`);
  console.log(`  新(修復)：success=${s.success} 珠=${JSON.stringify(s.assignments.map((a) => a.decorationName))}`);
  assert(!g.success, "舊貪婪失敗");
  assert(s.success && names(s).join(",") === "cBC,sA", "新解成功：cBC + singleA（seed 複合珠救活）");
  assert(s.achievedSkills.A >= 1 && s.achievedSkills.B >= 1 && s.achievedSkills.C >= 1, "三技能皆達成");
}

// ───────────────────────────────────────────────────────────────────────────
// 案例 3（F：多複合珠配對 → depth-2 seed 修復）
//   required {A:1,B:1,C:1,D:1}；洞池 [4,4]（僅 2 洞）。
//   珠：cAB(4:{A,B}) cAC(4:{A,C}) cBD(4:{B,D})；各技能另有 slot1 單珠。
//   唯一解 = cAC + cBD（覆蓋 A,C,B,D 於 2 洞）。
//   貪婪：處理 A → cAB(附贈 B)先於 cAC 被選（同鍵，列表序 cAB 在前）佔 slot4；B 補；
//     C → singleC(slot1) 佔 slot4；D 無洞 → 失敗。
//   depth-1 任一 seed 皆補不齊 4 技能於 2 洞 → depth-2 seed [cAC,cBD] → 成功。
// ───────────────────────────────────────────────────────────────────────────
{
  console.log("案例 3（F：depth-2 seed cAC+cBD 修復多複合珠配對）");
  const deco = {
    A: [single("sA", 1, "A"), compound("cAB", 4, { A: 1, B: 1 }), compound("cAC", 4, { A: 1, C: 1 })],
    B: [single("sB", 1, "B"), compound("cAB", 4, { A: 1, B: 1 }), compound("cBD", 4, { B: 1, D: 1 })],
    C: [single("sC", 1, "C"), compound("cAC", 4, { A: 1, C: 1 })],
    D: [single("sD", 1, "D"), compound("cBD", 4, { B: 1, D: 1 })],
  };
  const input = { slots: [4, 4], currentSkills: {}, requiredSkills: { A: 1, B: 1, C: 1, D: 1 }, reservedSlots: RES0, decorationsBySkill: deco, skillMax: { A: 1, B: 1, C: 1, D: 1 } };
  const g = greedySolveDecorations(input);
  const s = solveDecorations(input);
  console.log(`  舊(貪婪)：success=${g.success} missing=${JSON.stringify(g.missingRequired)}`);
  console.log(`  新(修復)：success=${s.success} 珠=${JSON.stringify(s.assignments.map((a) => a.decorationName))}`);
  assert(!g.success, "舊貪婪失敗（首選 cAB → D 無洞）");
  assert(s.success && names(s).join(",") === "cAC,cBD", "新解成功：cAC+cBD（depth-2 複合珠配對）");
}

// ───────────────────────────────────────────────────────────────────────────
// 決定性：案例 3 連跑兩次，assignments 逐位元一致。
// ───────────────────────────────────────────────────────────────────────────
{
  console.log("決定性（案例 3 連跑兩次逐位元一致）");
  const deco = {
    A: [single("sA", 1, "A"), compound("cAB", 4, { A: 1, B: 1 }), compound("cAC", 4, { A: 1, C: 1 })],
    B: [single("sB", 1, "B"), compound("cAB", 4, { A: 1, B: 1 }), compound("cBD", 4, { B: 1, D: 1 })],
    C: [single("sC", 1, "C"), compound("cAC", 4, { A: 1, C: 1 })],
    D: [single("sD", 1, "D"), compound("cBD", 4, { B: 1, D: 1 })],
  };
  const input = { slots: [4, 4], currentSkills: {}, requiredSkills: { A: 1, B: 1, C: 1, D: 1 }, reservedSlots: RES0, decorationsBySkill: deco, skillMax: { A: 1, B: 1, C: 1, D: 1 } };
  const a = JSON.stringify(solveDecorations(input));
  const b = JSON.stringify(solveDecorations(input));
  assert(a === b, "同輸入兩次輸出逐位元一致");
}

console.log(`\n[test-decoration-repair] ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
