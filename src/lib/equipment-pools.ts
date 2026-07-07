import type {
  ArmorPiece,
  EquipmentPools,
  ExcludedItems,
  FixedParts,
  SkillMap,
  Weapon,
  WeaponElementFilter,
  WeaponSearchMode,
} from "@/types/build";
import { ARMOR_PARTS } from "@/types/build";
import { slotValue } from "./slot-utils";

/**
 * 依部位分組所有防具，並套用排除清單。
 * maxRarity 給定時，濾除 rarity 超過上限的防具（依 preset 階段限制取得門檻）；
 * craftable 給定時，濾除進度尚未解放的防具（解放條件精確篩選，見 unlocks.ts）；
 * 固定部位在 applyFixedParts 直接以 id 帶入，不受兩者影響。
 */
export function buildEquipmentPools(
  armors: ArmorPiece[],
  excluded?: ExcludedItems,
  maxRarity?: number,
  craftable?: (id: string) => boolean
): EquipmentPools {
  const excludeSet = new Set(excluded?.armorIds ?? []);
  const pools = {
    head: [],
    chest: [],
    arms: [],
    waist: [],
    legs: [],
  } as EquipmentPools;
  for (const a of armors) {
    if (excludeSet.has(a.id)) continue;
    if (maxRarity != null && (a.rarity ?? 0) > maxRarity) continue;
    if (craftable && !craftable(a.id)) continue;
    if (pools[a.part]) pools[a.part].push(a);
  }
  return pools;
}

/** 從既有候選池再套用一次排除（用於結果卡片「排除此裝備」後重搜）。 */
export function applyExcludedItems(
  pools: EquipmentPools,
  excluded: ExcludedItems
): EquipmentPools {
  const excludeSet = new Set(excluded.armorIds);
  const out = {} as EquipmentPools;
  for (const part of ARMOR_PARTS) {
    out[part] = pools[part].filter((a) => !excludeSet.has(a.id));
  }
  return out;
}

/**
 * 套用固定部位：被固定的部位候選池收斂為單一指定裝備。
 * 找不到指定 id 時保留原池（避免搜尋直接無解，UI 另行提示）。
 */
export function applyFixedParts(
  pools: EquipmentPools,
  fixed: FixedParts,
  armorById: Record<string, ArmorPiece>
): EquipmentPools {
  const out = {} as EquipmentPools;
  for (const part of ARMOR_PARTS) {
    const fixedId = fixed[part];
    if (fixedId && armorById[fixedId]) {
      out[part] = [armorById[fixedId]];
    } else {
      out[part] = pools[part];
    }
  }
  return out;
}

/**
 * 單件裝備對某流派的啟發式分數，用於 fast/greedy 模式候選篩選。
 * 只是粗略排序，不代表最終配裝分數。
 */
export function scoreArmorPieceForPreset(
  piece: ArmorPiece,
  required: SkillMap,
  preferred: SkillMap,
  avoid: SkillMap,
  weights: SkillMap
): number {
  let score = 0;
  for (const [skill, lvl] of Object.entries(piece.skills)) {
    if (required[skill]) score += lvl * 12;
    if (preferred[skill]) score += lvl * (weights[skill] ?? 1) * 4;
    if (avoid[skill]) score -= lvl * 25;
  }
  // 洞位彈性：能容納珠子越多越好
  score += slotValue(piece.slots) * 1.5;
  return score;
}

/**
 * 針對 greedy 模式的排序鍵：優先「能補多少必要技能缺口」。
 */
export function requiredCoverageScore(
  piece: ArmorPiece,
  required: SkillMap
): number {
  let cover = 0;
  for (const [skill, lvl] of Object.entries(piece.skills)) {
    if (required[skill]) cover += lvl;
  }
  return cover;
}

/**
 * 依模式對候選池做裁切。
 * - exact：全部保留
 * - fast：每部位保留啟發式分數前 limit 名
 * - greedy：每部位保留「必要覆蓋 + 分數」前 limit 名（更小）
 */
export function prunePools(
  pools: EquipmentPools,
  preset: {
    requiredSkills: SkillMap;
    preferredSkills: SkillMap;
    avoidSkills: SkillMap;
    skillWeights: SkillMap;
  },
  mode: "fast" | "exact" | "greedy",
  fixed: FixedParts,
  /** 參與搜尋的武器候選數。>1 時縮小每部位件數，讓總組合數（W × N^5）維持在可負荷範圍。 */
  weaponCount: number = 1
): EquipmentPools {
  // 每部位保留件數（控制組合數 N^5)。
  // 全防具資料庫下（每部位 300+ 件),暴力枚舉不可行,故各模式皆做相關度裁切。
  const limit =
    weaponCount > 1
      ? mode === "greedy"
        ? 6
        : mode === "fast"
          ? 7
          : 9
      : mode === "greedy"
        ? 7
        : mode === "fast"
          ? 9
          : 12;

  // 相關技能集合（必要 + 偏好),用於預先濾除完全無關的裝備。
  const relevant = new Set([
    ...Object.keys(preset.requiredSkills),
    ...Object.keys(preset.preferredSkills),
  ]);

  const scoreOf = (piece: ArmorPiece) =>
    scoreArmorPieceForPreset(
      piece,
      preset.requiredSkills,
      preset.preferredSkills,
      preset.avoidSkills,
      preset.skillWeights
    ) +
    (mode === "greedy"
      ? requiredCoverageScore(piece, preset.requiredSkills) * 20
      : 0);

  const out = {} as EquipmentPools;
  for (const part of ARMOR_PARTS) {
    // 已固定的部位只有一件，不需裁切
    if (fixed[part]) {
      out[part] = pools[part];
      continue;
    }
    // 預先濾除：既無相關技能、洞位又少（<4)的裝備直接淘汰。
    const useful = pools[part].filter((p) => {
      const hasRel = Object.keys(p.skills).some((s) => relevant.has(s));
      const slotV = (p.slots ?? []).reduce((a, b) => a + b, 0);
      return hasRel || slotV >= 4;
    });
    const pool = useful.length ? useful : pools[part];
    out[part] = pool
      .map((piece) => ({ piece, score: scoreOf(piece) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((x) => x.piece);
  }
  return out;
}

/** 五屬性集合（屬性流武器評分用）。 */
const FIVE_ELEMENTS = new Set(["fire", "water", "thunder", "ice", "dragon"]);

/**
 * 單把武器對某流派的啟發式分數（search 模式候選排序用）。
 * 攻擊/會心/洞位/自帶技能相關度綜合。
 * preferElement=true（屬性流 preset）時：以屬性值為主要排序依據（屬攻優先），
 * 並將無屬性/狀態異常武器大幅降權（屬性流用不到）。
 */
export function scoreWeaponForPreset(
  weapon: Weapon,
  required: SkillMap,
  preferred: SkillMap,
  weights: SkillMap,
  preferElement = false
): number {
  let score = weapon.attack / 10 + weapon.affinity / 5;
  score += slotValue(weapon.slots) * 3;
  if (weapon.rampageSlot) score += weapon.rampageSlot;
  for (const [skill, lvl] of Object.entries(weapon.skills ?? {})) {
    if (required[skill]) score += lvl * 12;
    if (preferred[skill]) score += lvl * (weights[skill] ?? 1) * 4;
  }
  if (preferElement) {
    const el = weapon.element;
    if (el && FIVE_ELEMENTS.has(el.type)) score += el.value * 2;
    else score -= 200; // 屬性流不推薦無屬性/狀態異常武器
  }
  return score;
}

/**
 * 建立武器候選池。
 * - fixed：只回傳指定武器（fixedWeaponId 優先，其次 fixedParts.weapon）
 * - search：同 weaponType 的武器，套用排除清單，依分數取前 N（控制組合數）
 * 回傳空陣列時由呼叫端後援（例如舊版手動洞數）。
 */
export function buildWeaponPool(opts: {
  weapons: Weapon[];
  weaponById: Record<string, Weapon>;
  weaponType: string;
  weaponSearchMode: WeaponSearchMode;
  fixedWeaponId?: string;
  fixedPartsWeapon?: string;
  excludedWeaponIds: string[];
  preset: { requiredSkills: SkillMap; preferredSkills: SkillMap; skillWeights: SkillMap };
  mode: "fast" | "exact" | "greedy";
  /** 屬性篩選（僅五屬性）：search 模式只保留該屬性武器。未指定＝不限。 */
  elementFilter?: WeaponElementFilter;
  /** 屬性流 preset：候選排序以屬性值優先。 */
  preferElement?: boolean;
  /** 裝備 rarity 上限（依 preset 階段限制取得門檻）。固定武器不受限。 */
  maxRarity?: number;
  /** 進度解放篩選（見 unlocks.ts）。固定武器不受限。 */
  craftable?: (id: string) => boolean;
}): Weapon[] {
  const {
    weapons,
    weaponById,
    weaponType,
    weaponSearchMode,
    fixedWeaponId,
    fixedPartsWeapon,
    excludedWeaponIds,
    preset,
    mode,
    elementFilter,
    preferElement,
    maxRarity,
    craftable,
  } = opts;

  if (weaponSearchMode === "fixed") {
    const id = fixedWeaponId ?? fixedPartsWeapon;
    const w = id ? weaponById[id] : undefined;
    return w ? [w] : [];
  }

  const excluded = new Set(excludedWeaponIds);
  const candidates = weapons.filter(
    (w) =>
      w.weaponType === weaponType &&
      !excluded.has(w.id) &&
      (!elementFilter || w.element?.type === elementFilter) &&
      (maxRarity == null || (w.rarity ?? 0) <= maxRarity) &&
      (!craftable || craftable(w.id))
  );
  const cap = mode === "greedy" ? 2 : mode === "fast" ? 3 : 4;
  return candidates
    .map((w) => ({
      w,
      score: scoreWeaponForPreset(
        w,
        preset.requiredSkills,
        preset.preferredSkills,
        preset.skillWeights,
        preferElement
      ),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, cap)
    .map((x) => x.w);
}
