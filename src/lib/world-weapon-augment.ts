import type { Weapon } from "@/types/build";

/**
 * World 武器強化「簡化輸入」（覺醒／客製強化）。
 *
 * 比照 Rise 傀異鍊成哲學：**輸入結果值，不模擬取得過程**。使用者直接填入覺醒/客製強化
 * 賦予的最終數值 delta（攻擊/會心/屬性/追加洞位），套用到「固定武器」的淺拷貝上，
 * 原始武器資料一行不動。僅作用於固定武器模式。
 *
 * 防禦加成為 **display-only**：Weapon 型別無 defense 欄、`BuildResult.totalDefense` 語意為
 * 「5 件防具基礎防禦總和」，故防禦 delta 不進引擎、不改 totalDefense，只在面板回顯。
 *
 * Safi 覺醒賦予的套裝技（如炎王龍套 3 件效果）以 `setBonusId` 表達「虛擬 set bonus +1 件」
 * （見 build-search 的 `WorldSearchExt.virtualSetBonus`），本模組只保存選擇，不在此套用。
 */
export type WorldWeaponAugment = {
  /** 攻擊加成（flat，顯示值尺度，同 computeEfr 的 effAttack flat）。 */
  attack: number;
  /** 會心加成（%）。 */
  affinity: number;
  /** 屬性加成（flat，顯示值尺度）；僅作用於既有五屬性武器。 */
  element: number;
  /** 追加洞位等級：0＝無、1–4＝追加 1 個該等級的洞。 */
  slot: number;
  /** 防禦加成（display-only，不進引擎）。 */
  defense: number;
  /** 虛擬 set bonus id（覺醒賦予套裝技）；""＝無。以「+1 件」計入件數統計。 */
  setBonusId: string;
};

export const EMPTY_WORLD_WEAPON_AUGMENT: WorldWeaponAugment = {
  attack: 0,
  affinity: 0,
  element: 0,
  slot: 0,
  defense: 0,
  setBonusId: "",
};

/** 是否含「會影響武器數值副本」的 delta（虛擬 set bonus 與 display-only 防禦不算）。 */
export function hasNumericDelta(a: WorldWeaponAugment): boolean {
  return a.attack !== 0 || a.affinity !== 0 || a.element !== 0 || a.slot > 0;
}

/** augment 是否完全無效果（數值 delta 全空且無虛擬 set bonus）。 */
export function isNoopAugment(a: WorldWeaponAugment | null | undefined): boolean {
  if (!a) return true;
  return !hasNumericDelta(a) && !a.setBonusId;
}

/**
 * 套用數值 delta 到武器**淺拷貝**（原資料不動）。
 * - 攻擊/會心：直接加。
 * - 屬性：僅在武器有既有五屬性（value>0）時加；無屬性/狀態武器無效果。
 * - 洞位：追加 1 個指定等級的洞（slot>0 時）。
 * 防禦為 display-only，不在此套用。
 */
export function applyWeaponAugment(weapon: Weapon, a: WorldWeaponAugment): Weapon {
  const next: Weapon = { ...weapon };
  if (a.attack) next.attack = weapon.attack + a.attack;
  if (a.affinity) next.affinity = weapon.affinity + a.affinity;
  if (a.element && weapon.element && weapon.element.value > 0) {
    next.element = { ...weapon.element, value: weapon.element.value + a.element };
  }
  if (a.slot > 0) next.slots = [...weapon.slots, a.slot];
  return next;
}

/** 消毒外部來源（share-link）的 augment：缺欄退預設、數值取整、洞位 clamp 0–4。 */
export function sanitizeWeaponAugment(v: unknown): WorldWeaponAugment {
  if (typeof v !== "object" || v === null) return { ...EMPTY_WORLD_WEAPON_AUGMENT };
  const o = v as Record<string, unknown>;
  const num = (x: unknown) =>
    typeof x === "number" && Number.isFinite(x) ? Math.round(x) : 0;
  return {
    attack: num(o.attack),
    affinity: num(o.affinity),
    element: num(o.element),
    slot: Math.max(0, Math.min(4, num(o.slot))),
    defense: num(o.defense),
    setBonusId: typeof o.setBonusId === "string" ? o.setBonusId : "",
  };
}
