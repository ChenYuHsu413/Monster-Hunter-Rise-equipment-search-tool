/// <reference lib="webworker" />
/**
 * 配裝搜尋 Web Worker。
 *
 * 只做「搬移」：直接 import 現有 build-search 模組，護石剪枝、候選集 limit、MAX_COMBOS
 * 等行為完全沿用，演算法一行未改。worker 有獨立 module cache，故自行 loadGameData()
 * 載入一份防具/武器資料（與主執行緒各一份，互不干擾）。
 *
 * 搬入 worker 的目的：搜尋為同步重運算（50 顆護石可達數秒），放主執行緒會凍結 UI；
 * 移入 worker 後主執行緒在搜尋期間仍可切 Tab、捲動；並支援 terminate 取消。
 */
import type { ArmorPiece, BuildSearchRequest } from "@/types/build";
import { searchBuilds, createSearchDeps, type SearchOutput } from "./build-search";
import { loadGameData } from "./game-data";

export type SearchWorkerRequest = {
  /** 遞增搜尋序號：主執行緒用來忽略已取消/過期的回傳。 */
  id: number;
  request: BuildSearchRequest;
  /** 傀異鍊成自訂防具（主執行緒 state，隨請求序列化帶入）。 */
  augments: ArmorPiece[];
};

export type SearchWorkerResponse =
  | { id: number; ok: true; output: SearchOutput }
  | { id: number; ok: false; error: string };

const ctx = self as unknown as DedicatedWorkerGlobalScope;

ctx.onmessage = async (e: MessageEvent<SearchWorkerRequest>) => {
  const { id, request, augments } = e.data;
  try {
    const gd = await loadGameData();
    const deps = createSearchDeps(gd, augments);
    const output = searchBuilds(request, deps, () =>
      typeof performance !== "undefined" ? performance.now() : 0
    );
    ctx.postMessage({ id, ok: true, output } satisfies SearchWorkerResponse);
  } catch (err) {
    ctx.postMessage({
      id,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    } satisfies SearchWorkerResponse);
  }
};
