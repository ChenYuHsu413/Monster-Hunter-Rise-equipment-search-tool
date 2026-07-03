"use client";

import { useEffect, useRef, useState } from "react";

/**
 * SSR 安全的 localStorage 狀態。
 *
 * - 首次渲染（含 SSR 與 client 第一次）皆回傳 `initial`，避免 hydration mismatch。
 * - 掛載後於 effect 讀取 localStorage 還原（若有）。
 * - 之後每次值變更寫回。以 ref 標記「已讀取」，避免還原前先把 initial 蓋掉真正的存檔。
 */
export function useLocalStorage<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(initial);
  const hydrated = useRef(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw != null) setValue(JSON.parse(raw) as T);
    } catch {
      /* 忽略毀損 / 無法存取 */
    }
    hydrated.current = true;
    // 只在掛載時讀一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!hydrated.current) return;
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* 配額 / 無法存取時忽略 */
    }
  }, [key, value]);

  return [value, setValue] as const;
}
