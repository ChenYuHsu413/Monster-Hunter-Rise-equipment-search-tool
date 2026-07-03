"use client";

import type { SearchMode } from "@/types/build";
import { cn } from "@/lib/utils";
import { Zap, Target, Rabbit } from "lucide-react";

type Props = {
  value: SearchMode;
  onChange: (m: SearchMode) => void;
};

const MODES: {
  id: SearchMode;
  label: string;
  hint: string;
  icon: typeof Zap;
}[] = [
  { id: "fast", label: "快速", hint: "預設。先篩候選再組合，速度與品質平衡。", icon: Zap },
  { id: "exact", label: "完整", hint: "枚舉所有符合裝備，組合多時可能較慢。", icon: Target },
  { id: "greedy", label: "推薦", hint: "最快，優先補足必要技能，可能非最佳解。", icon: Rabbit },
];

export function SearchModeSelector({ value, onChange }: Props) {
  const active = MODES.find((m) => m.id === value)!;
  return (
    <div className="space-y-1.5">
      <div className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1">
        {MODES.map((m) => {
          const Icon = m.icon;
          const isActive = m.id === value;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => onChange(m.id)}
              className={cn(
                "flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
                isActive
                  ? "bg-background text-foreground shadow"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {m.label}
            </button>
          );
        })}
      </div>
      <p className="text-[11px] text-muted-foreground">{active.hint}</p>
    </div>
  );
}
