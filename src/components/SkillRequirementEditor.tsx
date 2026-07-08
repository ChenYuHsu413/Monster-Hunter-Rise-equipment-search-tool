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

/** 新增技能下拉（套裝技能獨立分組）。 */
function AddSkillSelect({
  skills,
  onAdd,
}: {
  skills: Skill[];
  onAdd: (name: string) => void;
}) {
  const [setGroup, normalGroup] = useMemo(() => {
    const set: Skill[] = [];
    const normal: Skill[] = [];
    for (const s of skills) (SET_SKILLS.has(s.name) ? set : normal).push(s);
    return [set, normal];
  }, [skills]);

  return (
    <Select value="" onValueChange={onAdd}>
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
  );
}

type Props = {
  required: SkillMap;
  excluded: string[];
  onChangeRequired: (v: SkillMap) => void;
  onChangeExcluded: (v: string[]) => void;
  allSkills: Skill[];
};

/** 技能條件編輯器：必要技能（含等級）與排除技能（硬條件，無等級）。 */
export function SkillRequirementEditor({
  required,
  excluded,
  onChangeRequired,
  onChangeExcluded,
  allSkills,
}: Props) {
  const requiredEntries = Object.entries(required);
  const excludedSet = useMemo(() => new Set(excluded), [excluded]);

  // 兩邊互斥：已在任一清單中的技能不出現在新增選項裡。
  const addable = useMemo(
    () =>
      allSkills.filter((s) => !(s.name in required) && !excludedSet.has(s.name)),
    [allSkills, required, excludedSet]
  );

  const setLevel = (name: string, lvl: number) =>
    onChangeRequired({ ...required, [name]: lvl });
  const removeRequired = (name: string) => {
    const next = { ...required };
    delete next[name];
    onChangeRequired(next);
  };

  return (
    <div className="space-y-4">
      {/* ---- 必要技能 ---- */}
      <div className={cn("space-y-2 border-l-2 pl-3", "border-l-primary")}>
        <div className="flex items-baseline justify-between">
          <Label className="text-sm font-semibold">必要技能</Label>
          <span className="text-[11px] text-muted-foreground">
            一定要達成，否則配裝不顯示。
          </span>
        </div>

        <div className="space-y-1.5">
          {requiredEntries.map(([name, lvl]) => {
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
                  onClick={() => removeRequired(name)}
                  title="移除"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            );
          })}
          {requiredEntries.length === 0 && (
            <p className="text-xs text-muted-foreground">尚未設定</p>
          )}
        </div>

        <AddSkillSelect
          skills={addable}
          onAdd={(name) => onChangeRequired({ ...required, [name]: 1 })}
        />
      </div>

      {/* ---- 排除技能 ---- */}
      <div className={cn("space-y-2 border-l-2 pl-3", "border-l-destructive")}>
        <div className="flex items-baseline justify-between">
          <Label className="text-sm font-semibold">排除技能</Label>
          <span className="text-[11px] text-muted-foreground">
            帶有這些技能的配裝不顯示。
          </span>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {excluded.map((name) => (
            <Badge
              key={name}
              variant="destructive"
              className="gap-1 py-0.5 pl-2 pr-1"
            >
              {name}
              <button
                onClick={() =>
                  onChangeExcluded(excluded.filter((x) => x !== name))
                }
                className="rounded-sm hover:bg-destructive/20"
                title="移除"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          {excluded.length === 0 && (
            <p className="text-xs text-muted-foreground">尚未設定</p>
          )}
        </div>

        <AddSkillSelect
          skills={addable}
          onAdd={(name) => onChangeExcluded([...excluded, name])}
        />
      </div>
    </div>
  );
}
