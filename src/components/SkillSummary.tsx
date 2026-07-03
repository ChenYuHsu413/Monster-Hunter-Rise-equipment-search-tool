"use client";

import type { SkillMap } from "@/types/build";
import { Badge } from "@/components/ui/badge";
import { skillByName } from "@/lib/data";

type Props = {
  skills: SkillMap;
  /** 各類技能高亮：必要=primary、偏好=accent、其它=secondary。 */
  required?: SkillMap;
  preferred?: SkillMap;
  avoid?: SkillMap;
  limit?: number;
};

/** 以 badge 呈現技能摘要，依等級由高到低排序。 */
export function SkillSummary({
  skills,
  required,
  preferred,
  avoid,
  limit,
}: Props) {
  const entries = Object.entries(skills)
    .filter(([, lvl]) => lvl > 0)
    .sort((a, b) => b[1] - a[1]);
  const shown = limit ? entries.slice(0, limit) : entries;

  return (
    <div className="flex flex-wrap gap-1.5">
      {shown.map(([name, lvl]) => {
        let variant: "default" | "accent" | "secondary" | "destructive" =
          "secondary";
        if (avoid?.[name]) variant = "destructive";
        else if (required?.[name]) variant = "default";
        else if (preferred?.[name]) variant = "accent";
        const isSpecial = skillByName[name]?.special;
        return (
          <Badge
            key={name}
            variant={variant}
            className="gap-1 px-2 py-0.5 text-[13px]"
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
