"use client";

import { createContext, useContext } from "react";
import type { GameId } from "@/types/build";

/**
 * 目前遊戲的輕量 context（PLAN Phase 5）。
 *
 * 只承載 gameId，供深層純顯示元件（RarityBadge / EquipmentIcon）取用遊戲相關色表，
 * 避免逐層 prop-drilling。**預設 "rise"**：未包 Provider 的既有樹（含 Rise 路徑與
 * 推薦配裝頁）行為完全不變。BuilderView 依 gameId 包一層 Provider。
 */
const GameIdContext = createContext<GameId>("rise");

export const GameIdProvider = GameIdContext.Provider;

export function useGameId(): GameId {
  return useContext(GameIdContext);
}
