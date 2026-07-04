"use client";

import { useState } from "react";
import type { ArmorPart, ArmorPiece, FixedParts } from "@/types/build";
import { ARMOR_PARTS, ARMOR_PART_LABELS } from "@/types/build";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatSlots } from "@/lib/slot-utils";
import { RarityBadge } from "./RarityBadge";
import { cn } from "@/lib/utils";
import { Lock, Search, Check, X } from "lucide-react";

type Props = {
  /** 全部防具（已含鍊成自訂件）。 */
  allArmors: ArmorPiece[];
  /** 資料是否仍在載入中。 */
  loading?: boolean;
  fixedParts: FixedParts;
  onFix: (part: ArmorPart, id: string) => void;
  onClear: (part: ArmorPart) => void;
};

/** 一次最多顯示的清單筆數（避免一次渲染 300+ 件）。 */
const MAX_LIST = 50;

/**
 * 逐部位「搜尋 → 固定防具」面板。
 * 先選部位、輸入關鍵字過濾，點清單即固定該部位；不需先跑搜尋。
 */
export function ArmorLockPanel({
  allArmors,
  loading = false,
  fixedParts,
  onFix,
  onClear,
}: Props) {
  const [part, setPart] = useState<ArmorPart>("head");
  const [query, setQuery] = useState("");

  const q = query.trim();
  const matches = allArmors.filter(
    (a) => a.part === part && (q === "" || a.nameZh.includes(q))
  );
  const shown = matches.slice(0, MAX_LIST);
  const fixedId = fixedParts[part];
  const fixedPiece = fixedId
    ? allArmors.find((a) => a.id === fixedId)
    : undefined;

  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Search className="h-3.5 w-3.5" /> 搜尋並固定防具
      </Label>

      {/* 部位切換 */}
      <div className="grid grid-cols-5 gap-1 rounded-lg bg-muted p-1">
        {ARMOR_PARTS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setPart(p)}
            className={cn(
              "relative rounded-md py-1 text-xs font-medium transition-colors",
              part === p
                ? "bg-background text-foreground shadow"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {ARMOR_PART_LABELS[p]}
            {fixedParts[p] && (
              <span className="absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full bg-primary" />
            )}
          </button>
        ))}
      </div>

      {/* 目前部位已固定的件 */}
      {fixedPiece && (
        <div className="flex items-center justify-between rounded-md bg-primary/10 px-2 py-1">
          <span className="flex items-center gap-1.5 truncate text-sm">
            <Lock className="h-3 w-3 shrink-0 text-primary" />
            {fixedPiece.nameZh}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0"
            onClick={() => onClear(part)}
            title="解除固定"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {/* 搜尋框 */}
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={
          loading
            ? "防具資料載入中…"
            : `搜尋${ARMOR_PART_LABELS[part]}名稱…`
        }
        className="h-8"
        disabled={loading}
      />

      {/* 結果清單 */}
      {!loading && (
        <div className="max-h-64 space-y-1 overflow-y-auto scrollbar-thin">
          {shown.length === 0 ? (
            <p className="px-1 py-2 text-xs text-muted-foreground">
              找不到符合的{ARMOR_PART_LABELS[part]}。
            </p>
          ) : (
            shown.map((a) => {
              const isFixed = a.id === fixedId;
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => (isFixed ? onClear(part) : onFix(part, a.id))}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors",
                    isFixed
                      ? "bg-primary/15"
                      : "hover:bg-muted"
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-sm">{a.nameZh}</span>
                      <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
                        {formatSlots(a.slots)}
                      </span>
                      <RarityBadge rarity={a.rarity} />
                      {a.rankLabel && (
                        <span className="shrink-0 text-[10px] text-muted-foreground">
                          {a.rankLabel}
                        </span>
                      )}
                      {a.isAugmented && (
                        <Badge variant="accent" className="px-1 py-0 text-[10px]">
                          鍊成
                        </Badge>
                      )}
                    </div>
                    {Object.keys(a.skills).length > 0 && (
                      <div className="truncate text-[11px] text-muted-foreground">
                        {Object.entries(a.skills)
                          .map(([n, l]) => `${n} ${l}`)
                          .join("・")}
                      </div>
                    )}
                  </div>
                  {isFixed ? (
                    <Check className="h-4 w-4 shrink-0 text-primary" />
                  ) : (
                    <Lock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  )}
                </button>
              );
            })
          )}
          {matches.length > MAX_LIST && (
            <p className="px-1 py-1 text-[11px] text-muted-foreground">
              顯示前 {MAX_LIST} 筆（共 {matches.length} 筆），請輸入關鍵字縮小範圍。
            </p>
          )}
        </div>
      )}
    </div>
  );
}
