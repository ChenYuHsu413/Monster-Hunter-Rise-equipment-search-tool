/**
 * World 引擎冒煙測試（PLAN Phase 3）。以 world profile + world 資料驅動 searchBuilds，
 * 驗證機制正確（搜得出、動態上限對、珠子累計對、護石來源對），
 * **不對 EFR 數值排序下結論**（efr-world 為 Phase 4；目前 efr 為 rise 佔位）。
 *
 *   node scripts/world/smoke-world.mjs [1|2|3|4|all]
 *
 * 自行 register regression-loader（同 regression-baseline.mjs），讓 Node 直接跑 app TS。
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
const armorById = deps.armorById;

const RESERVED0 = { 4: 0, 3: 0, 2: 0, 1: 0 };
const NO_EXCL = { armorIds: [], weaponIds: [] };
const pick = (pred) => deps.weapons.find(pred);
const armorsBy = (fn) => deps.armors.filter(fn);

// set bonus 觸發狀態（由結果的防具件 setBonusId 重算，供顯示驗證）
function setBonusStatus(build) {
  const counts = {};
  for (const part of ["head", "chest", "arms", "waist", "legs"]) {
    const id = build.armor[part]?.setBonusId;
    if (id) counts[id] = (counts[id] ?? 0) + 1;
  }
  const out = [];
  for (const [id, cnt] of Object.entries(counts)) {
    const sb = world.setBonusById[id];
    if (!sb) continue;
    const triggered = sb.ranks.filter((r) => cnt >= r.pieces);
    if (triggered.length)
      out.push(`${sb.nameZh}×${cnt} → ${triggered.map((r) => `${r.skillName}(${r.pieces}件)`).join("、")}`);
  }
  return out;
}

function report(title, req, note) {
  const { results, meta } = searchBuilds(req, deps);
  console.log(`\n━━━ ${title} ━━━`);
  console.log(note ?? "");
  console.log(`結果數 ${results.length} / valid ${meta.validBuilds} / combos ${meta.combosEvaluated} / weaponsTried ${meta.weaponsTried} / charmsTried ${meta.charmsTried}`);
  if (!results.length) {
    console.log("⚠️  無結果");
    return { results, meta };
  }
  const r = results[0];
  console.log("首套：");
  console.log("  武器:", r.weapon?.nameZh ?? r.weapon?.nameEn);
  for (const part of ["head", "chest", "arms", "waist", "legs"]) {
    const p = r.armor[part];
    console.log(`  ${part}: ${p.nameZh}${p.setBonusId ? ` [${p.setBonusId}]` : ""}`);
  }
  console.log("  護石:", r.charm?.name ?? r.charm?.id ?? "無", JSON.stringify(r.charm?.skills ?? {}));
  const sb = setBonusStatus(r);
  console.log("  set bonus:", sb.length ? sb.join(" ／ ") : "無");
  console.log("  finalSkills:", JSON.stringify(r.finalSkills));
  const decos = r.decorations.map((d) => d.decorationName);
  const dc = {};
  for (const n of decos) dc[n] = (dc[n] ?? 0) + 1;
  console.log("  珠子:", Object.entries(dc).map(([n, c]) => (c > 1 ? `${n}×${c}` : n)).join("、") || "無");
  console.log("  剩餘洞:", JSON.stringify(r.remainingSlots));
  return { results, meta };
}

const which = process.argv[2] ?? "all";
const run = (n) => which === "all" || which === String(n);

// ---- 測① Inheritance 全域解放路徑：固定 Fatalis 5 件，要求 挑戰者 Lv7（原生 5）----
if (run(1)) {
  const dragon = armorsBy((a) => a.setBonusId === "sb_fatalis-legend" && /α\+$/.test(a.nameEn));
  const byPart = {};
  for (const a of dragon) byPart[a.part] ??= a;
  const gs = pick((w) => w.weaponType === "great-sword" && w.rarity === 12);
  report(
    "測① Inheritance 全域解放（固定 Fatalis α+ 5 件，要求 挑戰者 Lv7）",
    {
      weaponType: "great-sword",
      weaponSearchMode: "fixed",
      fixedWeaponId: gs.id,
      charms: [],
      fixedParts: {
        head: byPart.head.id, chest: byPart.chest.id, arms: byPart.arms.id,
        waist: byPart.waist.id, legs: byPart.legs.id,
      },
      excludedItems: NO_EXCL,
      requiredSkills: { 挑戰者: 7 },
      excludedSkills: [],
      reservedSlots: RESERVED0,
      searchMode: "exact",
      resultLimit: 5,
    },
    "預期：Fatalis 5 件 → Inheritance 觸發 → 挑戰者原生 5 撐到 7；finalSkills 挑戰者=7。"
  );
}
