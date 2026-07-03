"use client";

import { useEffect, useState } from "react";
import type {
  Weapon,
  WeaponElementFilter,
  WeaponSearchMode,
} from "@/types/build";
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
import {
  formatWeaponSource,
  formatWeaponSpecial,
  formatWeaponStats,
  weaponSeriesLabel,
} from "@/lib/weapon-utils";
import { cn } from "@/lib/utils";
import { Lock, Search, Sparkles } from "lucide-react";

/** 屬性篩選值：all 代表不限。 */
export type ElementFilterValue = "all" | WeaponElementFilter;

const ELEMENT_FILTER_OPTIONS: { value: ElementFilterValue; label: string }[] = [
  { value: "all", label: "全部" },
  { value: "fire", label: "火" },
  { value: "water", label: "水" },
  { value: "thunder", label: "雷" },
  { value: "ice", label: "冰" },
  { value: "dragon", label: "龍" },
];

/** 無來源怪的武器歸到此分類。 */
const OTHER_GROUP = "其他（無來源）";

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
  /** 是否顯示屬性篩選器（弩槍非屬性武器，故停用）。 */
  enableElementFilter?: boolean;
  /** 目前屬性篩選值。 */
  elementFilter?: ElementFilterValue;
  onElementFilterChange?: (v: ElementFilterValue) => void;
  /** 固定模式是否改用「來源怪 → 武器」兩層下拉。 */
  groupBySource?: boolean;
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
  enableElementFilter = false,
  elementFilter = "all",
  onElementFilterChange,
  groupBySource = false,
}: Props) {
  const picked = weapons.find((w) => w.id === fixedWeaponId);

  // 依屬性篩選（僅在啟用且非「全部」時生效）
  const filtered =
    enableElementFilter && elementFilter !== "all"
      ? weapons.filter((w) => w.element?.type === elementFilter)
      : weapons;

  // 依來源怪分組（大分類），依數量多寡排序、「其他」置底
  const groups: [string, Weapon[]][] = (() => {
    const m = new Map<string, Weapon[]>();
    for (const w of filtered) {
      const key = w.sourceMonster ?? OTHER_GROUP;
      const arr = m.get(key);
      if (arr) arr.push(w);
      else m.set(key, [w]);
    }
    return [...m.entries()].sort((a, b) => {
      if (a[0] === OTHER_GROUP) return 1;
      if (b[0] === OTHER_GROUP) return -1;
      return b[1].length - a[1].length || a[0].localeCompare(b[0]);
    });
  })();

  // 目前選中的來源怪大分類：優先跟隨已選武器，否則由使用者手動選
  const [group, setGroup] = useState<string | null>(null);
  useEffect(() => {
    if (picked) setGroup(picked.sourceMonster ?? OTHER_GROUP);
  }, [picked?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const groupWeapons = group
    ? (groups.find((g) => g[0] === group)?.[1] ?? [])
    : [];

  return (
    <div className="space-y-2">
      <Label className="text-xs text-muted-foreground">武器</Label>

      {enableElementFilter && (
        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground">屬性篩選</Label>
          <div className="grid grid-cols-6 gap-1 rounded-lg bg-muted p-1">
            {ELEMENT_FILTER_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => onElementFilterChange?.(opt.value)}
                className={cn(
                  "rounded-md py-1 text-xs font-medium transition-colors",
                  elementFilter === opt.value
                    ? "bg-background text-foreground shadow"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}

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
            : `將從 ${filtered.length} 把同類型武器中挑選候選參與搜尋。`}
        </p>
      ) : (
        <>
          {groupBySource ? (
            <>
              {/* 第一層：來源怪／派生大分類 */}
              <Select value={group ?? ""} onValueChange={setGroup}>
                <SelectTrigger className="h-9">
                  <SelectValue
                    placeholder={loading ? "武器資料載入中…" : "選擇來源／派生"}
                  />
                </SelectTrigger>
                <SelectContent>
                  {groups.map(([name, ws]) => (
                    <SelectItem key={name} value={name}>
                      <span className="flex items-center gap-1.5">
                        {name}
                        <span className="text-[10px] text-muted-foreground">
                          {ws.length}
                        </span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* 第二層：該分類下各階段武器 */}
              {group && (
                <Select value={fixedWeaponId ?? ""} onValueChange={onPickWeapon}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="選擇武器" />
                  </SelectTrigger>
                  <SelectContent>
                    {groupWeapons.map((w) => (
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
              )}
            </>
          ) : (
            <Select value={fixedWeaponId ?? ""} onValueChange={onPickWeapon}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder={loading ? "武器資料載入中…" : "選擇武器"} />
              </SelectTrigger>
              <SelectContent>
                {filtered.map((w) => (
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
          )}

          {picked && (
            <div className="space-y-1 rounded-lg border border-border bg-muted/30 p-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">{picked.nameZh}</span>
                <span className="font-mono text-[11px] text-muted-foreground">
                  洞 {formatSlots(picked.slots)}
                </span>
              </div>
              <ProvenanceHint
                seriesName={weaponSeriesLabel(picked)}
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
              {formatWeaponSource(picked) && (
                <p className="text-[11px] text-muted-foreground/80">
                  {formatWeaponSource(picked)}
                </p>
              )}
              {picked.materials && picked.materials.length > 0 && (
                <p className="text-[11px] text-muted-foreground/70">
                  生產素材：{picked.materials.join("、")}
                </p>
              )}
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
