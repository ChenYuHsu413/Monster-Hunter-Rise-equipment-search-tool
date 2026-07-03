"use client";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type Props = {
  /** 原始字串，例如 "3-2-1"。 */
  value: string;
  onChange: (v: string) => void;
  /** 若已固定武器，顯示唯讀提示。 */
  lockedWeaponName?: string;
};

const PRESETS = ["4-2-1", "3-2-1", "3-1-1", "2-2-0", "2-1-0", "0-0-0"];

/** 武器洞數輸入（第一版無完整武器資料庫，直接輸入洞數）。 */
export function WeaponSlotInput({ value, onChange, lockedWeaponName }: Props) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between">
        <Label className="text-xs text-muted-foreground">武器洞數</Label>
        {lockedWeaponName && (
          <span className="text-[11px] text-primary">
            已固定：{lockedWeaponName}
          </span>
        )}
      </div>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="例如 3-2-1"
        disabled={!!lockedWeaponName}
        className="font-mono"
      />
      {!lockedWeaponName && (
        <div className="flex flex-wrap gap-1">
          {PRESETS.map((p) => (
            <Button
              key={p}
              type="button"
              variant={value === p ? "default" : "outline"}
              size="sm"
              className="h-6 px-2 font-mono text-[11px]"
              onClick={() => onChange(p)}
            >
              {p}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
