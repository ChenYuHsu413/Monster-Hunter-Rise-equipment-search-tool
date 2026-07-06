"use client";

import type { ElementResistanceKey } from "@/types/build";
import { ELEMENT_RES_KEYS } from "@/types/build";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  minDefense: number;
  minResistances: Partial<Record<ElementResistanceKey, number>>;
  onChangeMinDefense: (v: number) => void;
  onChangeMinResistances: (
    v: Partial<Record<ElementResistanceKey, number>>
  ) => void;
};

const RES_LABELS: Record<ElementResistanceKey, string> = {
  fire: "火",
  water: "水",
  thunder: "雷",
  ice: "冰",
  dragon: "龍",
};

/** 防禦力 / 屬性耐性下限（硬性條件，只檢查有填的欄位）。空白＝不限。 */
export function DefenseResInput({
  minDefense,
  minResistances,
  onChangeMinDefense,
  onChangeMinResistances,
}: Props) {
  const setRes = (key: ElementResistanceKey, raw: string) => {
    const next = { ...minResistances };
    if (raw === "" || raw === "-") {
      delete next[key]; // 清空＝不限
    } else {
      const n = Number(raw);
      if (!Number.isNaN(n)) next[key] = n;
    }
    onChangeMinResistances(next);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Label className="w-16 shrink-0 text-xs text-muted-foreground">
          最低防禦
        </Label>
        <Input
          type="number"
          min={0}
          value={minDefense || ""}
          placeholder="不限"
          onChange={(e) =>
            onChangeMinDefense(Math.max(0, Number(e.target.value) || 0))
          }
          className="h-8 w-24 font-mono"
        />
      </div>
      <div className="grid grid-cols-5 gap-1.5">
        {ELEMENT_RES_KEYS.map((key) => (
          <div key={key} className="flex flex-col items-center gap-1">
            <span className="text-[11px] text-muted-foreground">
              {RES_LABELS[key]}耐
            </span>
            <Input
              type="number"
              value={minResistances[key] ?? ""}
              placeholder="—"
              onChange={(e) => setRes(key, e.target.value)}
              className="h-8 px-1 text-center font-mono"
            />
          </div>
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground">
        以 5 件防具的基礎防禦與耐性總和計算；空白欄位不設限。
      </p>
    </div>
  );
}
