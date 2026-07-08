"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { RecommendedView } from "@/components/recommended/RecommendedView";
import { BuilderView } from "@/components/builder/BuilderView";
import { Button } from "@/components/ui/button";
import { Compass, Swords } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * 雙 Tab 殼：推薦配裝（預設）與配裝器。
 *
 * Tab 狀態反映在 URL 的 ?tab=（history pushState + popstate 同步），重新整理／分享
 * 連結能回到相同 Tab。兩個 view 都保持 mounted（用 hidden 切換），故來回切換不遺失
 * 各自的元件狀態；配裝器採「首次切入才掛載、之後保留」以延後其較重的資料載入。
 * 不使用 useSearchParams（避開 App Router 的 Suspense/預渲染限制），也不引入新套件。
 */

type Tab = "recommend" | "builder";

const TABS: { key: Tab; label: string }[] = [
  { key: "recommend", label: "推薦配裝" },
  { key: "builder", label: "配裝器" },
];

export default function Home() {
  const [tab, setTabState] = useState<Tab>("recommend");
  // 配裝器首次被選到才掛載，之後保留於 DOM（hidden）以留住狀態。
  const [builderMounted, setBuilderMounted] = useState(false);

  // 初始化與 popstate（上一頁/分享連結）同步：由 URL ?tab= 決定目前分頁。
  useEffect(() => {
    const apply = () => {
      const t = new URLSearchParams(window.location.search).get("tab");
      const next: Tab = t === "builder" ? "builder" : "recommend";
      setTabState(next);
      if (next === "builder") setBuilderMounted(true);
    };
    apply();
    window.addEventListener("popstate", apply);
    return () => window.removeEventListener("popstate", apply);
  }, []);

  const selectTab = (t: Tab) => {
    setTabState(t);
    if (t === "builder") setBuilderMounted(true);
    const params = new URLSearchParams(window.location.search);
    params.set("tab", t);
    // replace（非 push）：切 Tab 不堆歷史，返回鍵直接離開網站而非在 Tab 間彈跳。
    window.history.replaceState(null, "", `?${params.toString()}`);
  };

  return (
    <div className="flex min-h-[100dvh] flex-col bg-background lg:h-screen">
      {/* ---- 全域頂部列：品牌 + 分頁 + 新手引導 ---- */}
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-2.5">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15">
            <Swords className="h-5 w-5 text-primary" />
          </div>
          <h1 className="text-base font-bold leading-tight">
            魔物獵人 Rise：破曉配裝
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg bg-muted p-1">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => selectTab(t.key)}
                className={cn(
                  "rounded-md px-3 py-1 text-sm font-medium transition-colors",
                  tab === t.key
                    ? "bg-background text-foreground shadow"
                    : "text-muted-foreground hover:text-foreground"
                )}
                aria-pressed={tab === t.key}
              >
                {t.label}
              </button>
            ))}
          </div>
          <Link href="/guide">
            <Button variant="outline" size="sm" className="gap-1.5">
              <Compass className="h-4 w-4" />
              新手引導
            </Button>
          </Link>
        </div>
      </header>

      {/* ---- 內容：兩個 view 保持 mounted，以 hidden 切換 ---- */}
      <div className="flex min-h-0 flex-1 flex-col">
        <div
          className={cn(
            tab === "recommend" ? "flex min-h-0 flex-1 flex-col" : "hidden"
          )}
        >
          <RecommendedView />
        </div>
        {builderMounted && (
          <div
            className={cn(
              tab === "builder" ? "flex min-h-0 flex-1 flex-col" : "hidden"
            )}
          >
            <BuilderView />
          </div>
        )}
      </div>
    </div>
  );
}
