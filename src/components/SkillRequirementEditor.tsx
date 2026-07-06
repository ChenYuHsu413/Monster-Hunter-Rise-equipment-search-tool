"use client";

import { useMemo } from "react";
import type { Skill, SkillMap } from "@/types/build";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { X, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { SET_SKILLS } from "@/lib/data";

type Variant = "required" | "preferred" | "avoid";

/** 下拉選項的單列渲染（含特殊/套裝標記）。 */
function SkillOption({ s }: { s: Skill }) {
  return (
    <span className="flex items-center gap-2">
      {s.name}
      {SET_SKILLS.has(s.name) && (
        <Badge variant="secondary" className="px-1 py-0 text-[9px]">
          套裝
        </Badge>
      )}
      {s.special && (
        <Badge variant="accent" className="px-1 py-0 text-[9px]">
          特殊
        </Badge>
      )}
    </span>
  );
}

const VARIANT_META: Record<
  Variant,
  { label: string; hint: string; accent: string }
> = {
  required: {
    label: "必要技能",
    hint: "一定要達成，否則配裝不顯示。",
    accent: "border-l-primary",
  },
  preferred: {
    label: "偏好技能",
    hint: "非必須，等級越高分數越高。",
    accent: "border-l-accent",
  },
  avoid: {
    label: "排除技能",
    hint: "出現則扣分。",
    accent: "border-l-destructive",
  },
};

function SkillListEditor({
  variant,
  value,
  onChange,
  allSkills,
}: {
  variant: Variant;
  value: SkillMap;
  onChange: (next: SkillMap) => void;
  allSkills: Skill[];
}) {
  const meta = VARIANT_META[variant];
  const entries = Object.entries(value);
  const available = useMemo(() => {
    const present = new Set(Object.keys(value));
    return allSkills.filter((s) => !present.has(s.name));
  }, [allSkills, value]);
  // 套裝技能獨立成一組（靠系列件數觸發，方便使用者辨識與挑選）。
  const [setGroup, normalGroup] = useMemo(() => {
    const set: Skill[] = [];
    const normal: Skill[] = [];
    for (const s of available) (SET_SKILLS.has(s.name) ? set : normal).push(s);
    return [set, normal];
  }, [available]);

  const setLevel = (name: string, lvl: number) =>
    onChange({ ...value, [name]: lvl });
  const remove = (name: string) => {
    const next = { ...value };
    delete next[name];
    onChange(next);
  };
  const add = (name: string) => onChange({ ...value, [name]: 1 });

  return (
    <div className={cn("space-y-2 border-l-2 pl-3", meta.accent)}>
      <div className="flex items-baseline justify-between">
        <Label className="text-sm font-semibold">{meta.label}</Label>
        <span className="text-[11px] text-muted-foreground">{meta.hint}</span>
      </div>

      <div className="space-y-1.5">
        {entries.map(([name, lvl]) => {
          const max = allSkills.find((s) => s.name === name)?.maxLevel ?? 7;
          return (
            <div key={name} className="flex items-center gap-2">
              <span className="flex-1 truncate text-sm">{name}</span>
              <Select
                value={String(lvl)}
                onValueChange={(v) => setLevel(name, Number(v))}
              >
                <SelectTrigger className="h-7 w-[70px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      Lv{n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0"
                onClick={() => remove(name)}
                title="移除"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          );
        })}
        {entries.length === 0 && (
          <p className="text-xs text-muted-foreground">尚未設定</p>
        )}
      </div>

      <Select value="" onValueChange={add}>
        <SelectTrigger className="h-7 text-xs">
          <span className="flex items-center gap-1 text-muted-foreground">
            <Plus className="h-3.5 w-3.5" /> 新增技能
          </span>
        </SelectTrigger>
        <SelectContent>
          {setGroup.length > 0 && (
            <SelectGroup>
              <SelectLabel className="text-muted-foreground">
                套裝技能（靠系列件數）
              </SelectLabel>
              {setGroup.map((s) => (
                <SelectItem key={s.name} value={s.name}>
                  <SkillOption s={s} />
                </SelectItem>
              ))}
            </SelectGroup>
          )}
          <SelectGroup>
            {setGroup.length > 0 && (
              <SelectLabel className="text-muted-foreground">
                一般技能
              </SelectLabel>
            )}
            {normalGroup.map((s) => (
              <SelectItem key={s.name} value={s.name}>
                <SkillOption s={s} />
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  );
}

type Props = {
  required: SkillMap;
  preferred: SkillMap;
  avoid: SkillMap;
  onChangeRequired: (v: SkillMap) => void;
  onChangePreferred: (v: SkillMap) => void;
  onChangeAvoid: (v: SkillMap) => void;
  allSkills: Skill[];
};

export function SkillRequirementEditor({
  required,
  preferred,
  avoid,
  onChangeRequired,
  onChangePreferred,
  onChangeAvoid,
  allSkills,
}: Props) {
  return (
    <div className="space-y-4">
      <SkillListEditor
        variant="required"
        value={required}
        onChange={onChangeRequired}
        allSkills={allSkills}
      />
      <SkillListEditor
        variant="preferred"
        value={preferred}
        onChange={onChangePreferred}
        allSkills={allSkills}
      />
      <SkillListEditor
        variant="avoid"
        value={avoid}
        onChange={onChangeAvoid}
        allSkills={allSkills}
      />
    </div>
  );
}
