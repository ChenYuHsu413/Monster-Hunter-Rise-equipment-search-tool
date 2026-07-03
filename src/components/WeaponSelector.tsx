"use client";

import type { WeaponType } from "@/types/build";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Props = {
  weaponTypes: WeaponType[];
  value: string;
  onChange: (v: string) => void;
};

/** 武器類型選擇。未支援的武器停用並標示「即將推出」。 */
export function WeaponSelector({ weaponTypes, value, onChange }: Props) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">武器類型</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder="選擇武器" />
        </SelectTrigger>
        <SelectContent>
          {weaponTypes.map((w) => (
            <SelectItem key={w.id} value={w.id} disabled={!w.supported}>
              <span className="flex w-full items-center gap-2">
                {w.nameZh}
                {!w.supported && (
                  <span className="text-[10px] text-muted-foreground">
                    即將推出
                  </span>
                )}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-[11px] text-muted-foreground">
        標示「即將推出」的武器將陸續開放。
      </p>
    </div>
  );
}
