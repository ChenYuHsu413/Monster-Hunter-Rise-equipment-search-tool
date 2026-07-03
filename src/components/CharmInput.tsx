"use client";

import type { Skill } from "@/types/build";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/** 護石輸入的表單值：最多 3 個技能列 + 洞數字串。 */
export type CharmRow = { name: string; level: number };

type Props = {
  rows: CharmRow[]; // 固定長度 3（空列 name = ""）
  slotsStr: string;
  onChangeRows: (rows: CharmRow[]) => void;
  onChangeSlots: (v: string) => void;
  allSkills: Skill[];
};

const NONE = "__none__";

/** 護石輸入：3 個技能（第 3 個可留空）+ 洞數。 */
export function CharmInput({
  rows,
  slotsStr,
  onChangeRows,
  onChangeSlots,
  allSkills,
}: Props) {
  const setRow = (i: number, patch: Partial<CharmRow>) => {
    const next = rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r));
    onChangeRows(next);
  };

  return (
    <div className="space-y-2">
      {rows.map((row, i) => {
        const max =
          allSkills.find((s) => s.name === row.name)?.maxLevel ?? 3;
        return (
          <div key={i} className="flex items-center gap-2">
            <span className="w-10 shrink-0 text-[11px] text-muted-foreground">
              技能{i + 1}
            </span>
            <Select
              value={row.name || NONE}
              onValueChange={(v) =>
                setRow(i, {
                  name: v === NONE ? "" : v,
                  level: v === NONE ? 0 : row.level || 1,
                })
              }
            >
              <SelectTrigger className="h-8 flex-1">
                <SelectValue placeholder="（無）" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>（無）</SelectItem>
                {allSkills.map((s) => (
                  <SelectItem key={s.name} value={s.name}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={String(row.level || 1)}
              onValueChange={(v) => setRow(i, { level: Number(v) })}
              disabled={!row.name}
            >
              <SelectTrigger className="h-8 w-[68px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: max }, (_, n) => n + 1).map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    Lv{n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        );
      })}
      <div className="flex items-center gap-2">
        <span className="w-10 shrink-0 text-[11px] text-muted-foreground">
          洞數
        </span>
        <Input
          value={slotsStr}
          onChange={(e) => onChangeSlots(e.target.value)}
          placeholder="例如 2-1-0"
          className="h-8 font-mono"
        />
      </div>
      <Label className="block text-[11px] text-muted-foreground">
        沒有護石可留空技能、洞數填 0-0-0。
      </Label>
    </div>
  );
}
