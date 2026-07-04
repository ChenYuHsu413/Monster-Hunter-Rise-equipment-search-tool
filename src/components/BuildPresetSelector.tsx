"use client";

import { useState } from "react";
import type { BuildPreset, PresetTier } from "@/types/build";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronUp } from "lucide-react";

type Props = {
  presets: BuildPreset[];
  value: string;
  onChange: (id: string) => void;
};

/** 常駐展開的早期階段。 */
const EARLY_TIERS: PresetTier[] = ["初心", "拓荒"];
/** 預設收合的晚期階段（畢業區網路資源多，工具主要當終點參考）。 */
const LATE_TIERS: PresetTier[] = ["進階", "畢業"];

/** 各階段的說明小字。 */
const TIER_HINT: Record<PresetTier, string> = {
  初心: "剛進大師位 MR1~3・限早期裝（稀有度 ≤8）",
  拓荒: "MR 前期・稀有度 ≤9（含天迴龍）",
  進階: "中期過渡・不限裝備",
  畢業: "TU5 終盤・不限裝備",
};

function PresetCard({
  preset,
  active,
  onChange,
}: {
  preset: BuildPreset;
  active: boolean;
  onChange: (id: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(preset.id)}
      className={cn(
        "rounded-lg border p-3 text-left transition-colors",
        active
          ? "border-primary bg-primary/10"
          : "border-border hover:border-primary/40 hover:bg-muted/40"
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium">{preset.nameZh}</span>
        {active && <Badge className="px-1.5 py-0 text-[10px]">已套用</Badge>}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{preset.description}</p>
      <div className="mt-2 flex flex-wrap gap-1">
        {preset.tags.map((t) => (
          <Badge key={t} variant="secondary" className="px-1.5 py-0 text-[10px]">
            {t}
          </Badge>
        ))}
      </div>
    </button>
  );
}

function TierGroup({
  tier,
  presets,
  value,
  onChange,
}: {
  tier: PresetTier;
  presets: BuildPreset[];
  value: string;
  onChange: (id: string) => void;
}) {
  // 同一階段內：物理/會心（無 preferElement）在前、屬性（preferElement）在後。
  const ordered = [...presets].sort(
    (a, b) => Number(!!a.preferElement) - Number(!!b.preferElement)
  );
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span className="text-sm font-semibold text-foreground">{tier}</span>
        <span className="text-xs font-medium text-muted-foreground">
          {TIER_HINT[tier]}
        </span>
      </div>
      <div className="grid gap-2">
        {ordered.map((p) => (
          <PresetCard
            key={p.id}
            preset={p}
            active={p.id === value}
            onChange={onChange}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * 流派 preset 選擇：依進度階段分組。
 * 早期（初心／拓荒）常駐展開；晚期（進階／畢業）預設收合——工具的核心價值在早期引導，
 * 畢業網路資源多、玩家自主性高，收在展開後面當終點參考即可。選中晚期 preset 時自動展開。
 */
export function BuildPresetSelector({ presets, value, onChange }: Props) {
  // 依階段分組；未分類的另置一組（不套用階段標題）。
  const byTier = new Map<PresetTier, BuildPreset[]>();
  const untiered: BuildPreset[] = [];
  for (const p of presets) {
    if (p.tier) {
      const arr = byTier.get(p.tier);
      if (arr) arr.push(p);
      else byTier.set(p.tier, [p]);
    } else {
      untiered.push(p);
    }
  }

  const lateTiers = LATE_TIERS.filter((t) => byTier.has(t));
  const lateCount = lateTiers.reduce((n, t) => n + (byTier.get(t)?.length ?? 0), 0);
  const activeIsLate = presets.some(
    (p) => p.id === value && p.tier != null && LATE_TIERS.includes(p.tier)
  );
  const [showLate, setShowLate] = useState(false);
  const lateOpen = showLate || activeIsLate;

  return (
    <div className="space-y-2">
      <Label className="text-xs text-muted-foreground">流派 Preset</Label>

      {presets.length === 0 ? (
        <p className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
          此武器尚未提供流派 preset。
        </p>
      ) : (
        <div className="space-y-3">
          {EARLY_TIERS.filter((t) => byTier.has(t)).map((tier) => (
            <TierGroup
              key={tier}
              tier={tier}
              presets={byTier.get(tier)!}
              value={value}
              onChange={onChange}
            />
          ))}
          {untiered.length > 0 && (
            <div className="grid gap-2">
              {untiered.map((p) => (
                <PresetCard
                  key={p.id}
                  preset={p}
                  active={p.id === value}
                  onChange={onChange}
                />
              ))}
            </div>
          )}

          {lateCount > 0 && (
            <div className="space-y-2 border-t border-border/60 pt-2">
              {lateOpen ? (
                <>
                  {lateTiers.map((tier) => (
                    <TierGroup
                      key={tier}
                      tier={tier}
                      presets={byTier.get(tier)!}
                      value={value}
                      onChange={onChange}
                    />
                  ))}
                  {!activeIsLate && (
                    <button
                      type="button"
                      onClick={() => setShowLate(false)}
                      className="flex w-full items-center justify-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
                    >
                      收合進階／畢業
                      <ChevronUp className="h-3.5 w-3.5" />
                    </button>
                  )}
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setShowLate(true)}
                    className="flex w-full items-center justify-between rounded-lg border border-dashed border-border px-3 py-2 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                  >
                    <span>展開進階／畢業（{lateCount} 套）</span>
                    <ChevronDown className="h-4 w-4" />
                  </button>
                  <p className="px-1 text-[10px] leading-snug text-muted-foreground/70">
                    畢業配裝網路資源多、玩家也較有方向，這裡主要當終點參考；新手建議先從初心／拓荒起步。
                  </p>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
