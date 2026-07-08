import type { SkillMap } from "@/types/build";
import type { RecommendedBuild, RecoTalisman } from "@/types/recommended";
import {
  deserializeSearchConditions,
  type OwnedCharm,
} from "./search-conditions";
import { normalizeSlots } from "./slot-utils";

/**
 * 推薦配裝 → 配裝器的匯入通道。
 *
 * 由推薦配裝頁的卡片產生 payload，經 page.tsx 傳給 BuilderView 套用。
 * full-build 匯核心技能 + 護石；armor-pieces/weapon-list 走 additive 鎖定。
 */

/** full-build 匯入時取的核心技能項數（見 extractCoreSkills 排序；校準自畢業裝可解率）。 */
export const DEFAULT_CORE_SKILL_COUNT = 4;

/** 由推薦配裝卡片產生、交給 BuilderView 套用的匯入指令。 */
export type BuilderImport =
  | {
      kind: "full-build";
      /** 此配裝的武器種類（匯入時切換配裝器武器種類，使搜尋針對同武器）。 */
      weaponType: string;
      /** 核心必要技能（已 clamp 到 skillMax、已排除傀異錬成加成）。 */
      requiredSkills: SkillMap;
      /** 此配裝的護石（標 source:"reco"），無護石時省略。 */
      charm?: OwnedCharm;
      /** 匯入的核心技能項數。 */
      importedCount: number;
      /** 技能總表原始項數（提示「共 N 項」用）。 */
      totalCount: number;
      /** 是否有技能因傀異錬成加成被降回基礎等級（顯示提示用）。 */
      droppedAugment: boolean;
      /** 因不可重現而被排除的 special 技能名（提示點名用）。 */
      excludedSpecial: string[];
    }
  | { kind: "lock-armor"; id: string }
  | { kind: "lock-weapon"; id: string; weaponType: string };

/** B′ 排序後挑出的核心技能列（有序、已 clamp、已排除 special）。 */
export type CoreSkillRow = { name: string; level: number };

/**
 * 依 B′ 策略挑出「核心必要技能」列（有序）。
 *
 * 此為單一真相來源：匯入 payload（extractCoreSkills）與推薦卡片摘要 chip 共用，確保
 * 「摘要列顯示的技能」與「按下匯入帶進配裝器的技能」同源同序——兩者絕不會不一致。
 *
 * 策略（B′）：一律取前 N 項，排序鍵依序為
 *   1. 紅字必須技能優先（Game8 `required`；實測僅 2 筆旗艦畢業裝有標）——作者標記的定義性技能。
 *   2. 等級 ÷ maxLevel（比值）：捕捉「作者刻意堆滿的技能」，達人藝 1/1 應勝過攻擊 4/7 的 filler。
 *   3. 等級：同比值時高等級優先。
 *   4. Game8 原順序：最終決勝。
 *
 * 為何紅字也要受 N 限制（不用紅字全集）：實測畢業裝的紅字集常達 9 項且全為 maxed（作者堆滿），
 * 基礎防具（無錬成孔）同時滿足會零結果——正是驗收指定的兩筆。紅字降為「優先鍵」後，
 * 該兩筆退到比值/等級決勝、取前 N 項，實測可搜出結果。
 *
 * N＝4 由 10 筆隨機大師畢業裝校準（含 2 筆驗收指定配裝）：N=4 時 9/10 可搜出結果，
 * 兩筆驗收皆在通過名單；N=6 時僅 5/10（6 個 maxed 硬技能對基礎防具過緊）。唯一失敗者為
 * 全屬性血氣覚醒弓——整套定義性技能皆 special，移除後僅剩冷門蓄力技能，屬無法重現的誠實限制。
 *
 * 排除 `special` 技能（狂化/業鎧【修羅】/狂龍症/血氣覺醒等）：這批多為傀異錬成/狂竜化
 * 衍生，搜尋器不模擬其取得，硬性要求會零結果（實測太刀/弓/蟲棍畢業裝正是被這批卡住）。
 *
 * 等級一律取 `level`（傀異錬成前基礎值；`augmentedLevel` 是錬成後總值，搜尋器不模擬
 * 錬成，匯入會導致無解，故不用），再 clamp 到 skillMax（防禦性最後防線）。
 */
export function selectCoreSkillRows(
  build: RecommendedBuild,
  skillMax: Record<string, number>,
  specialSkills: ReadonlySet<string>,
  n: number = DEFAULT_CORE_SKILL_COUNT
): {
  /** 前 N 項核心技能（依 B′ 排序）。 */
  rows: CoreSkillRow[];
  /** 技能總表原始項數。 */
  totalCount: number;
  /** 是否有技能因傀異錬成加成被降回基礎等級。 */
  droppedAugment: boolean;
  /** 因不可重現而被排除的 special 技能名（去重、依原順序）。 */
  excludedSpecial: string[];
} {
  const totals = build.skillTotals ?? [];
  const droppedAugment = totals.some(
    (s) => s.augmentedLevel != null && s.augmentedLevel !== s.level
  );

  // 可用列：技能名對得上 skillMax（實測全對得上；防禦性保留），且非 special（不可重現）。
  // 順手收集被排除的 special 技能名（去重），供匯入提示點名，避免匯入畢業裝看似空條件。
  const excludedSpecial: string[] = [];
  const seenSpecial = new Set<string>();
  const rows = totals
    .map((s, i) => {
      const name = s.id;
      if (!name || skillMax[name] == null) return null;
      if (specialSkills.has(name)) {
        if (!seenSpecial.has(name)) {
          seenSpecial.add(name);
          excludedSpecial.push(name);
        }
        return null;
      }
      const max = skillMax[name];
      const level = Math.min(s.level, max); // 基礎值 clamp（augmentedLevel 不取）
      return { name, level, ratio: level / max, order: i, required: !!s.required };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  const picked = [...rows]
    .sort(
      (a, b) =>
        Number(b.required) - Number(a.required) || // 紅字優先
        b.ratio - a.ratio ||
        b.level - a.level ||
        a.order - b.order
    )
    .slice(0, n);

  return {
    rows: picked.map((r) => ({ name: r.name, level: r.level })),
    totalCount: totals.length,
    droppedAugment,
    excludedSpecial,
  };
}

/**
 * 從 full-build 萃取核心必要技能，組成匯入用的 SkillMap。
 * 排序/選取一律走 {@link selectCoreSkillRows}（與摘要 chip 同源）。
 */
export function extractCoreSkills(
  build: RecommendedBuild,
  skillMax: Record<string, number>,
  specialSkills: ReadonlySet<string>,
  n: number = DEFAULT_CORE_SKILL_COUNT
): {
  requiredSkills: SkillMap;
  importedCount: number;
  totalCount: number;
  droppedAugment: boolean;
  /** 因不可重現而被排除的 special 技能名（去重、依原順序），供提示點名。 */
  excludedSpecial: string[];
} {
  const core = selectCoreSkillRows(build, skillMax, specialSkills, n);
  const requiredSkills: SkillMap = {};
  for (const r of core.rows) requiredSkills[r.name] = r.level;

  return {
    requiredSkills,
    importedCount: core.rows.length,
    totalCount: core.totalCount,
    droppedAugment: core.droppedAugment,
    excludedSpecial: core.excludedSpecial,
  };
}

/** 護石總表 → OwnedCharm（標 source:"reco"）。無技能且無洞時回 undefined。 */
export function talismanToRecoCharm(
  talisman: RecoTalisman | null | undefined,
  buildId: string
): OwnedCharm | undefined {
  if (!talisman) return undefined;
  const skills = (talisman.skills ?? [])
    .filter((s) => s.id)
    .slice(0, 2)
    .map((s) => ({ name: s.id as string, level: s.level }));
  const slots = normalizeSlots(
    (talisman.slots ?? []).map((n) => Number(n)).filter((n) => Number.isFinite(n))
  );
  if (skills.length === 0 && slots.length === 0) return undefined;
  return { id: `charm_reco_${buildId}`, skills, slots, source: "reco" };
}

/** 由 full-build 組出完整匯入 payload。 */
export function buildFullBuildImport(
  build: RecommendedBuild,
  skillMax: Record<string, number>,
  specialSkills: ReadonlySet<string>,
  n: number = DEFAULT_CORE_SKILL_COUNT
): BuilderImport {
  const core = extractCoreSkills(build, skillMax, specialSkills, n);
  return {
    kind: "full-build",
    weaponType: build.weaponType,
    requiredSkills: core.requiredSkills,
    charm: talismanToRecoCharm(build.talisman, build.id),
    importedCount: core.importedCount,
    totalCount: core.totalCount,
    droppedAugment: core.droppedAugment,
    excludedSpecial: core.excludedSpecial,
  };
}

/**
 * 讀 localStorage 判斷配裝器目前是否已有「非空條件」（供 full-build 匯入前的覆蓋確認）。
 * 只看會被匯入覆蓋的欄位：必要/排除技能、固定/排除裝備。護石為個人倉庫，不列入。
 */
export function builderHasConditions(): boolean {
  if (typeof window === "undefined") return false;
  let raw: string | null;
  try {
    raw = window.localStorage.getItem("mhsb.searchConditions");
  } catch {
    return false;
  }
  if (raw == null) return false;
  const c = deserializeSearchConditions(raw);
  return (
    Object.keys(c.requiredSkills).length > 0 ||
    c.excludedSkills.length > 0 ||
    Object.keys(c.fixedParts).length > 0 ||
    c.excludedItems.armorIds.length > 0 ||
    c.excludedItems.weaponIds.length > 0
  );
}
