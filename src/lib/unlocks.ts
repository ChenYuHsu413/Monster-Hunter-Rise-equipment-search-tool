import type { PlayerProgress } from "@/types/build";

/**
 * 解放條件資料（src/data/unlocks.json，由 scripts/import-unlocks.mjs 產出）
 * 的延遲載入與判定。載入模式比照 game-data.ts：動態 import 拆 chunk，
 * 只在進度篩選實際啟用時載入，不進首屏 bundle。
 */

/** 單件裝備的解放條目。多軸並存時任一軸達標即可製作。 */
export type UnlockEntry = {
  /** 村莊任務★（1-6）。 */
  v?: number;
  /** 集會所任務★（1-3 初階＝低位、4-8 進階＝上位）。 */
  h?: number;
  /** Master 集會所任務★（MR 劇情章節，1-6）。 */
  m?: number;
  /** MR 等級門檻（10+，TU 魔物）。 */
  mr?: number;
  /** 推導來源魔物（顯示/除錯用）。 */
  mon?: string;
  /** 信心度：confirmed（遊戲常數）/ inferred（任務星級推導）/ unverified（rarity 近似）。 */
  c: "confirmed" | "inferred" | "unverified";
  /** 推導方式（tu-mr-const / quest-star / rarity-approx）。 */
  src: string;
};

export type UnlockData = {
  entries: Record<string, UnlockEntry>;
  /** 每隻魔物在各軌道的首次出現星級（引導模式「要打什麼」顯示用）。 */
  monsters: {
    village: Record<string, number>;
    hubLow: Record<string, number>;
    hubHigh: Record<string, number>;
    master: Record<string, number>;
  };
};

let cache: UnlockData | null = null;
let inflight: Promise<UnlockData> | null = null;

/** 已載入時同步取得，否則 null。 */
export function getLoadedUnlocks(): UnlockData | null {
  return cache;
}

/** 載入（並快取）解放條件資料。重複呼叫共用同一個 in-flight promise。 */
export function loadUnlocks(): Promise<UnlockData> {
  if (cache) return Promise.resolve(cache);
  if (!inflight) {
    inflight = import("@/data/unlocks.json").then((mod) => {
      const data = mod.default as unknown as UnlockData;
      cache = { entries: data.entries, monsters: data.monsters };
      return cache;
    });
  }
  return inflight;
}

/**
 * 以玩家進度判定裝備是否已解放可製作。
 * 任一軸達標即可（素材在哪條線打到都能做裝）；無條目時不擋
 * （匯入保證 100% 覆蓋，此為資料缺漏時的安全後備）。
 */
export function isCraftable(
  entry: UnlockEntry | undefined,
  progress: PlayerProgress
): boolean {
  if (!entry) return true;
  if (entry.v != null && (progress.village ?? 0) >= entry.v) return true;
  if (entry.h != null && (progress.hub ?? 0) >= entry.h) return true;
  if (entry.m != null && (progress.mrChapter ?? 0) >= entry.m) return true;
  if (entry.mr != null && (progress.mrLevel ?? 0) >= entry.mr) return true;
  return false;
}
