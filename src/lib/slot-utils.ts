import type { ArmorPiece, Charm } from "@/types/build";

/**
 * 正規化洞位陣列：移除 0（空位），由大到小排序。
 * 例：[0,3,1] → [3,1]
 */
export function normalizeSlots(slots: number[]): number[] {
  return slots.filter((s) => s > 0).sort((a, b) => b - a);
}

/** 解析 "4-2-1" 格式為 [4,2,1]（0 會被保留成空位再交給 normalize 處理）。 */
export function parseSlotString(input: string): number[] {
  if (!input) return [];
  return input
    .split(/[-,\s]+/)
    .map((x) => parseInt(x.trim(), 10))
    .filter((n) => !isNaN(n));
}

/** 將洞位陣列格式化為 "4-2-1"。空陣列回傳 "—"。 */
export function formatSlots(slots: number[]): string {
  const norm = normalizeSlots(slots);
  return norm.length ? norm.join("-") : "—";
}

/**
 * 合併多件裝備/護石/武器的洞位成單一洞池。
 * 傳入 raw slot 陣列群，回傳正規化後的合併洞池。
 */
export function calculateSlots(
  ...slotGroups: (number[] | undefined)[]
): number[] {
  const all: number[] = [];
  for (const g of slotGroups) {
    if (g) all.push(...g);
  }
  return normalizeSlots(all);
}

/** 給定一組防具與護石、武器洞，算出總洞池。 */
export function collectSlots(
  pieces: ArmorPiece[],
  charm: Charm | undefined,
  weaponSlots: number[]
): number[] {
  const groups: (number[] | undefined)[] = pieces.map((p) => p.slots);
  groups.push(charm?.slots);
  groups.push(weaponSlots);
  return calculateSlots(...groups);
}

/** 洞池中是否存在一個等級 >= slotLevel 的洞。slots 需已正規化或至少去零。 */
export function canFitDecoration(slotLevel: number, slots: number[]): boolean {
  return slots.some((s) => s >= slotLevel);
}

/**
 * 將一顆需要 slotLevel 的珠子放入洞池：採用 best-fit —
 * 使用「能容納它的最小洞」，以保留大洞給其他需求。
 * 回傳 { placedInSlotLevel, remaining }；若放不下回傳 null。
 * 不會 mutate 傳入的 slots。
 */
export function placeDecoration(
  slotLevel: number,
  slots: number[]
): { placedInSlotLevel: number; remaining: number[] } | null {
  let bestIdx = -1;
  let bestVal = Infinity;
  for (let i = 0; i < slots.length; i++) {
    if (slots[i] >= slotLevel && slots[i] < bestVal) {
      bestVal = slots[i];
      bestIdx = i;
    }
  }
  if (bestIdx === -1) return null;
  const remaining = slots.slice(0, bestIdx).concat(slots.slice(bestIdx + 1));
  return { placedInSlotLevel: bestVal, remaining };
}

/** 洞池的「價值」量化：每個洞以其等級計分，用於候選裝備篩選與剩餘洞位評分。 */
export function slotValue(slots: number[]): number {
  return slots.reduce((sum, s) => sum + s, 0);
}
