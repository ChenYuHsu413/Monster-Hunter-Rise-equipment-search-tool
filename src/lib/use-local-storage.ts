"use client";

import { useEffect, useState } from "react";

/**
 * SSR 安全的 localStorage 狀態。
 *
 * - 首次渲染（含 SSR 與 client 第一次）皆回傳 `initial`，避免 hydration mismatch。
 * - 掛載後於 effect 讀取 localStorage 還原（若有）。
 * - 之後每次值變更寫回。「已還原」以 state（而非 ref）標記：寫回 effect 讀到的是
 *   本次 commit 的快照，還原 commit 之前恆為 false，確保 initial 不會先把存檔蓋掉
 *   （ref 會在同一個 commit 內被讀取 effect 先設為 true，接著寫回 effect 就把
 *   initial 寫進去；在 StrictMode 雙跑 effect 時第二輪讀取讀到的已是被蓋掉的值，
 *   造成 dev 模式下存檔每次重載都被清空）。
 */
export function useLocalStorage<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(initial);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw != null) setValue(JSON.parse(raw) as T);
    } catch {
      /* 忽略毀損 / 無法存取 */
    }
    setHydrated(true);
    // 只在掛載時讀一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* 配額 / 無法存取時忽略 */
    }
  }, [hydrated, key, value]);

  return [value, setValue] as const;
}
