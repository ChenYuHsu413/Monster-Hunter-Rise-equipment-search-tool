"use client";

import type { ReservedSlots } from "@/types/build";
import { Button } from "@/components/ui/button";
import { Minus, Plus } from "lucide-react";

type Props = {
  value: ReservedSlots;
  onChange: (v: ReservedSlots) => void;
};

const LEVELS = [4, 3, 2, 1] as const;

/** 保留洞位輸入：搜尋後至少保留這些洞給玩家自由運用（第一版為硬性條件）。 */
export function ReservedSlotsInput({ value, onChange }: Props) {
  const set = (lvl: (typeof LEVELS)[number], n: number) =>
    onChange({ ...value, [lvl]: Math.max(0, n) });

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-4 gap-2">
        {LEVELS.map((lvl) => (
          <div
            key={lvl}
            className="flex flex-col items-center gap-1 rounded-lg border p-2"
          >
            <span className="font-mono text-xs text-muted-foreground">
              {lvl} 級洞
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => set(lvl, value[lvl] - 1)}
                title="減少"
              >
                <Minus className="h-3 w-3" />
              </Button>
              <span className="w-5 text-center font-mono text-sm">
                {value[lvl]}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => set(lvl, value[lvl] + 1)}
                title="增加"
              >
                <Plus className="h-3 w-3" />
              </Button>
            </div>
          </div>
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground">
        保留洞位給耐絕珠、屬性珠、耐衝珠等。補完必要技能後無法保留者不顯示。
      </p>
    </div>
  );
}
