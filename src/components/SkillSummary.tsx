"use client";

import type { SkillMap } from "@/types/build";
import { Badge } from "@/components/ui/badge";
import { skillByName } from "@/lib/data";
import { cn } from "@/lib/utils";

type Props = {
  skills: SkillMap;
  /** 使用者指定的必要技能（含自動技能）。未指定的技能以「額外賺到」樣式呈現。 */
  required?: SkillMap;
  limit?: number;
};

/**
 * 以 badge 呈現技能摘要，依等級由高到低排序。
 * 必要技能＝實心；使用者沒指定但配裝附帶的＝灰底虛線框，一眼看出賺到哪些。
 */
export function SkillSummary({ skills, required, limit }: Props) {
  const entries = Object.entries(skills)
    .filter(([, lvl]) => lvl > 0)
    .sort((a, b) => b[1] - a[1]);
  const shown = limit ? entries.slice(0, limit) : entries;

  return (
    <div className="flex flex-wrap gap-1.5">
      {shown.map(([name, lvl]) => {
        const isRequired = !!required?.[name];
        const isSpecial = skillByName[name]?.special;
        return (
          <Badge
            key={name}
            variant={isRequired ? "default" : "outline"}
            className={cn(
              "gap-1 px-2 py-0.5 text-[13px]",
              !isRequired &&
                "border-dashed border-muted-foreground/40 bg-muted/40 text-muted-foreground"
            )}
            title={isRequired ? "指定的必要技能" : "配裝附帶的額外技能"}
          >
            <span>{name}</span>
            <span className="font-mono opacity-80">Lv{lvl}</span>
            {isSpecial && <span className="text-[11px]">★</span>}
          </Badge>
        );
      })}
      {shown.length === 0 && (
        <span className="text-xs text-muted-foreground">無</span>
      )}
    </div>
  );
}
