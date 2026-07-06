"use client";

import type { BuildPreset, PresetTier } from "@/types/build";
import { PRESET_TIER_ORDER } from "@/types/build";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Props = {
  presets: BuildPreset[];
  value: string;
  onChange: (id: string) => void;
};

/** 各階段的說明小字（下拉分組標題用）。 */
const TIER_HINT: Record<PresetTier, string> = {
  初心: "剛進大師位 MR1~3・限早期裝",
  拓荒: "MR 前期・稀有度 ≤9",
  進階: "中期過渡・不限裝備",
  畢業: "TU5 終盤・不限裝備",
};

/** 同階段內：物理/會心（無 preferElement）在前、屬性在後。 */
function orderTier(arr: BuildPreset[]): BuildPreset[] {
  return [...arr].sort(
    (a, b) => Number(!!a.preferElement) - Number(!!b.preferElement)
  );
}

/**
 * 流派 preset 選擇：依進度階段分組的下拉選單，選中者於下方顯示描述與標籤。
 * preset 數量多（每把可達 10 套），以下拉取代卡片以節省版面。
 */
export function BuildPresetSelector({ presets, value, onChange }: Props) {
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
  const selected = presets.find((p) => p.id === value);

  return (
    <div className="space-y-2">
      <Label className="text-xs text-muted-foreground">流派 Preset</Label>

      {presets.length === 0 ? (
        <p className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
          此武器尚未提供流派 preset。
        </p>
      ) : (
        <>
          <Select value={value} onValueChange={onChange}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="選擇流派" />
            </SelectTrigger>
            <SelectContent>
              {PRESET_TIER_ORDER.filter((t) => byTier.has(t)).map((tier) => (
                <SelectGroup key={tier}>
                  <SelectLabel className="text-muted-foreground">
                    {tier}・{TIER_HINT[tier]}
                  </SelectLabel>
                  {orderTier(byTier.get(tier)!).map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nameZh}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ))}
              {untiered.length > 0 && (
                <SelectGroup>
                  {untiered.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nameZh}
                    </SelectItem>
                  ))}
                </SelectGroup>
              )}
            </SelectContent>
          </Select>

          {selected && (
            <div className="rounded-lg border border-border bg-muted/30 p-2.5">
              <p className="text-xs leading-relaxed text-muted-foreground">
                {selected.description}
              </p>
              {selected.tags.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {selected.tags.map((t) => (
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
    </div>
  );
}
