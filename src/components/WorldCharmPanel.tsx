"use client";

import { useMemo, useState } from "react";
import type { Charm } from "@/types/build";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Lock, Ban } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * World 護石面板（PLAN Phase 5，charmMode = craftable-list）。
 *
 * 取代 Rise 的「我的護石」自由登錄：World 護石為固定可生產清單（攻擊護石Ⅲ 等，無孔）。
 * 搜尋時整個候選池都會被引擎評估；此面板讓玩家「固定」一顆（只用它）或「排除」若干顆，
 * 對應搜尋請求的 fixedCharmId 與 excludedItems.charmIds（引擎既有能力，Phase 3 已驗）。
 */
type Props = {
  charms: Charm[];
  fixedCharmId: string;
  excludedCharmIds: string[];
  onChangeFixed: (id: string) => void;
  onChangeExcluded: (ids: string[]) => void;
};

const charmName = (c: Charm) => c.name ?? c.id ?? "";
const charmSkillLabel = (c: Charm) =>
  Object.entries(c.skills)
    .map(([n, l]) => `${n} ${l}`)
    .join("・") || "無技能";

export function WorldCharmPanel({
  charms,
  fixedCharmId,
  excludedCharmIds,
  onChangeFixed,
  onChangeExcluded,
}: Props) {
  const [q, setQ] = useState("");
  const excluded = useMemo(() => new Set(excludedCharmIds), [excludedCharmIds]);
  const filtered = useMemo(() => {
    const kw = q.trim().toLowerCase();
    const list = kw
      ? charms.filter(
          (c) =>
            charmName(c).toLowerCase().includes(kw) ||
            Object.keys(c.skills).some((s) => s.toLowerCase().includes(kw))
        )
      : charms;
    // 固定的排最前，其餘依名稱
    return [...list].sort((a, b) => {
      if (a.id === fixedCharmId) return -1;
      if (b.id === fixedCharmId) return 1;
      return charmName(a).localeCompare(charmName(b), "zh-Hant");
    });
  }, [charms, q, fixedCharmId]);

  const toggleExcluded = (id: string) => {
    if (excluded.has(id)) onChangeExcluded(excludedCharmIds.filter((x) => x !== id));
    else onChangeExcluded([...excludedCharmIds, id]);
  };
  const toggleFixed = (id: string) => onChangeFixed(fixedCharmId === id ? "" : id);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] text-muted-foreground">
          可生產護石（{charms.length}）· 固定一顆只用它，或排除若干顆
        </span>
        {(fixedCharmId || excludedCharmIds.length > 0) && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-[11px]"
            onClick={() => {
              onChangeFixed("");
              onChangeExcluded([]);
            }}
          >
            清除選擇
          </Button>
        )}
      </div>
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="搜尋護石名稱或技能…"
        className="h-8 text-sm"
      />
      <ul className="max-h-[260px] space-y-1 overflow-y-auto scrollbar-thin pr-1">
        {filtered.length === 0 ? (
          <li className="py-2 text-center text-[11px] text-muted-foreground">
            無符合的護石
          </li>
        ) : (
          filtered.slice(0, 200).map((c) => {
            const id = c.id ?? "";
            const isFixed = id === fixedCharmId;
            const isExcluded = excluded.has(id);
            return (
              <li
                key={id}
                className={cn(
                  "flex items-center gap-1 rounded-md border border-border px-2 py-1",
                  isFixed && "border-primary/50 bg-primary/10",
                  isExcluded && "opacity-50"
                )}
              >
                <div className="min-w-0 flex-1">
                  <div className={cn("truncate text-xs", isExcluded && "line-through")}>
                    {charmName(c)}
                  </div>
                  <div className="truncate text-[11px] text-muted-foreground">
                    {charmSkillLabel(c)}
                  </div>
                </div>
                <Button
                  variant={isFixed ? "default" : "ghost"}
                  size="icon"
                  className="h-7 w-7 shrink-0"
                  onClick={() => toggleFixed(id)}
                  title={isFixed ? "已固定（只用此護石）" : "固定此護石"}
                  disabled={isExcluded}
                >
                  <Lock className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant={isExcluded ? "destructive" : "ghost"}
                  size="icon"
                  className={cn(
                    "h-7 w-7 shrink-0",
                    !isExcluded && "text-muted-foreground hover:text-destructive"
                  )}
                  onClick={() => toggleExcluded(id)}
                  title={isExcluded ? "已排除" : "排除此護石"}
                  disabled={isFixed}
                >
                  <Ban className="h-3.5 w-3.5" />
                </Button>
              </li>
            );
          })
        )}
      </ul>
      {filtered.length > 200 && (
        <p className="text-[11px] text-muted-foreground">
          僅顯示前 200 筆，請用搜尋縮小範圍。
        </p>
      )}
    </div>
  );
}
