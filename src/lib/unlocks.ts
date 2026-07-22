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
  /** MR 等級門檻（10+，TU 魔物或傀異素材等級）。 */
  mr?: number;
  /** 附加條件說明（如 A5★+ 素材的傀異研究等級需求，MR 軸無法表達的部分）。 */
  note?: string;
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
    inflight = import("@/data/rise/unlocks.json").then((mod) => {
      const data = mod.default as unknown as UnlockData;
      cache = { entries: data.entries, monsters: data.monsters };
      return cache;
    });
  }
  return inflight;
}

/** 信心度 → 顯示標籤（引導模式徽章用）。 */
export const CONFIDENCE_LABELS: Record<UnlockEntry["c"], string> = {
  confirmed: "已確認",
  inferred: "推導",
  unverified: "未驗證",
};

/**
 * 解放條件的白話描述（多軸以「或」相連，任一達成即可製作）。
 * 例：「村莊5★ 或 集會所3★」「MR 劇情第4章」「MR50 以上」。
 */
export function describeUnlock(entry: UnlockEntry | undefined): string {
  if (!entry) return "無資料";
  const parts: string[] = [];
  if (entry.v != null) parts.push(`村莊${entry.v}★`);
  if (entry.h != null)
    parts.push(`集會所${entry.h}★${entry.h >= 4 ? "（上位）" : ""}`);
  if (entry.m != null) parts.push(`MR 劇情第${entry.m}章`);
  if (entry.mr != null) parts.push(`MR${entry.mr} 以上`);
  const base = parts.length ? parts.join(" 或 ") : "無資料";
  return entry.note ? `${base}（${entry.note}）` : base;
}

/**
 * 裝備 id → Kiranico 詳細頁連結（素材細節查詢用）。
 * 嚴格白名單 `(armor|weapon)_數字`：合成/手工 id（如 Kiranico 漏收而手動補的
 * deco_manual_*）與所有裝飾珠一律回 undefined，不會組出壞連結。若日後為裝飾珠
 * 加 Kiranico 連結，須同樣排除 deco_manual_* 前綴。
 */
export function kiranicoUrl(id: string): string | undefined {
  const m = id.match(/^(armor|weapon)_(\d+)$/);
  if (!m) return undefined;
  return `https://mhrise.kiranico.com/zh-Hant/data/${m[1]}s/${m[2]}`;
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
