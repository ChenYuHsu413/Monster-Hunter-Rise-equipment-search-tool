"use client";

import type { DecorationAssignment } from "@/types/build";
import { Badge } from "@/components/ui/badge";

type Props = {
  decorations: DecorationAssignment[];
};

/** 彙整珠子（同名合併計數）並顯示放入的洞等級。 */
export function DecorationSummary({ decorations }: Props) {
  if (decorations.length === 0) {
    return <span className="text-xs text-muted-foreground">未使用裝飾珠</span>;
  }
  const counts = new Map<string, { count: number; slotLevel: number }>();
  for (const d of decorations) {
    const cur = counts.get(d.decorationName);
    if (cur) cur.count += 1;
    else counts.set(d.decorationName, { count: 1, slotLevel: d.slotLevel });
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {Array.from(counts.entries()).map(([name, info]) => (
        <Badge key={name} variant="outline" className="gap-1 font-normal">
          <span className="font-mono text-[10px] text-muted-foreground">
            [{info.slotLevel}]
          </span>
          <span>{name}</span>
          {info.count > 1 && (
            <span className="text-primary">×{info.count}</span>
          )}
        </Badge>
      ))}
    </div>
  );
}
