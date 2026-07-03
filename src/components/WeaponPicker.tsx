"use client";

import type { Weapon, WeaponSearchMode } from "@/types/build";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ProvenanceHint } from "./ProvenanceHint";
import { formatSlots } from "@/lib/slot-utils";
import { formatWeaponSpecial, formatWeaponStats } from "@/lib/weapon-utils";
import { cn } from "@/lib/utils";
import { Lock, Search, Sparkles } from "lucide-react";

type Props = {
  /** 目前武器類型的所有候選武器。 */
  weapons: Weapon[];
  /** 武器資料是否仍在載入中（延遲載入）。 */
  loading?: boolean;
  mode: WeaponSearchMode;
  onModeChange: (m: WeaponSearchMode) => void;
  fixedWeaponId?: string;
  onPickWeapon: (id: string) => void;
  /** 自動技能提示（由上層依 preset autoRules 與武器屬性計算）。 */
  autoHint?: string | null;
};

/** 武器設定區：搜尋模式（固定/搜尋）、武器選擇、武器資訊摘要。 */
export function WeaponPicker({
  weapons,
  loading = false,
  mode,
  onModeChange,
  fixedWeaponId,
  onPickWeapon,
  autoHint,
}: Props) {
  const picked = weapons.find((w) => w.id === fixedWeaponId);

  return (
    <div className="space-y-2">
      <Label className="text-xs text-muted-foreground">武器</Label>

      {/* 模式切換 */}
      <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
        <button
          type="button"
          onClick={() => onModeChange("search")}
          className={cn(
            "flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
            mode === "search"
              ? "bg-background text-foreground shadow"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Search className="h-3.5 w-3.5" />
          搜尋同類型武器
        </button>
        <button
          type="button"
          onClick={() => onModeChange("fixed")}
          className={cn(
            "flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
            mode === "fixed"
              ? "bg-background text-foreground shadow"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Lock className="h-3.5 w-3.5" />
          固定武器
        </button>
      </div>

      {mode === "search" ? (
        <p className="text-[11px] text-muted-foreground">
          {loading
            ? "武器資料載入中…"
            : `將從 ${weapons.length} 把同類型武器中挑選候選參與搜尋。`}
        </p>
      ) : (
        <>
          <Select value={fixedWeaponId ?? ""} onValueChange={onPickWeapon}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder={loading ? "武器資料載入中…" : "選擇武器"} />
            </SelectTrigger>
            <SelectContent>
              {weapons.map((w) => (
                <SelectItem key={w.id} value={w.id}>
                  <span className="flex items-center gap-1.5">
                    {w.nameZh}
                    {w.rankLabel && (
                      <span className="text-[10px] text-muted-foreground">
                        {w.rankLabel}
                      </span>
                    )}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {picked && (
            <div className="space-y-1 rounded-lg border border-border bg-muted/30 p-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">{picked.nameZh}</span>
                <span className="font-mono text-[11px] text-muted-foreground">
                  洞 {formatSlots(picked.slots)}
                </span>
              </div>
              <ProvenanceHint
                seriesName={picked.seriesName}
                rankLabel={picked.rankLabel}
              />
              <p className="text-[11px] text-muted-foreground">
                {formatWeaponStats(picked)}
              </p>
              {formatWeaponSpecial(picked).map((line) => (
                <p key={line} className="text-[11px] text-muted-foreground">
                  {line}
                </p>
              ))}
              {picked.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-0.5">
                  {picked.tags.map((t) => (
                    <Badge
                      key={t}
                      variant="secondary"
                      className="px-1.5 py-0 text-[10px]"
                    >
                      {t}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {autoHint && (
        <p className="flex items-start gap-1.5 rounded-md bg-accent/10 px-2 py-1.5 text-[11px] text-accent">
          <Sparkles className="mt-0.5 h-3 w-3 shrink-0" />
          {autoHint}
        </p>
      )}
    </div>
  );
}
