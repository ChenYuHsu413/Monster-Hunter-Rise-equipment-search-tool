"use client";

import type { BuildPreset } from "@/types/build";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Props = {
  presets: BuildPreset[];
  value: string;
  onChange: (id: string) => void;
};

/** 流派 preset 選擇：卡片式，選取即自動帶入技能條件（由上層處理）。 */
export function BuildPresetSelector({ presets, value, onChange }: Props) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">流派 Preset</Label>
      <div className="grid gap-2">
        {presets.map((p) => {
          const active = p.id === value;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => onChange(p.id)}
              className={cn(
                "rounded-lg border p-3 text-left transition-colors",
                active
                  ? "border-primary bg-primary/10"
                  : "border-border hover:border-primary/40 hover:bg-muted/40"
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{p.nameZh}</span>
                {active && (
                  <Badge className="px-1.5 py-0 text-[10px]">已套用</Badge>
                )}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {p.description}
              </p>
              <div className="mt-2 flex flex-wrap gap-1">
                {p.tags.map((t) => (
                  <Badge
                    key={t}
                    variant="secondary"
                    className="px-1.5 py-0 text-[10px]"
                  >
                    {t}
                  </Badge>
                ))}
              </div>
            </button>
          );
        })}
        {presets.length === 0 && (
          <p className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
            此武器尚未提供流派 preset。
          </p>
        )}
      </div>
    </div>
  );
}
