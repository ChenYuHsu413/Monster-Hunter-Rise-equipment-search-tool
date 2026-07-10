"use client";

import { useMemo, useRef, useState } from "react";
import type { Skill, SkillMap } from "@/types/build";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { X, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { SET_SKILLS } from "@/lib/data";

/**
 * 常用技能快捷區：玩家最常需要的 12 個技能。
 * 原為 buildPresets 必要技能出現頻率動態推導；流派 preset 移除後，凍結為當時
 * 由資料算出的前 12 名（出現頻率由高到低），行為與先前一致。
 */
const COMMON_SKILLS: string[] = [
  "弱點特效",
  "超會心",
  "攻擊",
  "看破",
  "會心擊【屬性】",
  "貫通彈･貫通箭強化",
  "蓄力大師",
  "砲術",
  "散彈･擴散箭強化",
  "拔刀術【技】",
  "速射強化",
  "抑制偏移",
];

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

/** 可搜尋的新增技能輸入框：輸入中文即時過濾，點候選加入。 */
function SkillSearchAdd({
  skills,
  onAdd,
  placeholder,
}: {
  skills: Skill[];
  onAdd: (name: string) => void;
  placeholder: string;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const blurTimer = useRef<number | null>(null);

  const matches = useMemo(() => {
    const q = query.trim();
    const pool = q ? skills.filter((s) => s.name.includes(q)) : skills;
    return pool.slice(0, 40);
  }, [skills, query]);

  const add = (name: string) => {
    onAdd(name);
    setQuery("");
    setOpen(false);
  };

  return (
    <div className="relative">
      <div className="flex items-center gap-1.5 rounded-md border border-border px-2">
        <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            // 延遲關閉，讓候選項的 mousedown/click 先觸發
            blurTimer.current = window.setTimeout(() => setOpen(false), 120);
          }}
          placeholder={placeholder}
          className="h-8 border-0 px-0 text-xs focus-visible:ring-0"
        />
      </div>
      {open && matches.length > 0 && (
        <ul
          className="absolute z-30 mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-border bg-popover p-1 shadow-md scrollbar-thin"
          onMouseDown={() => {
            // 取消 blur 的關閉，確保點擊生效
            if (blurTimer.current) window.clearTimeout(blurTimer.current);
          }}
        >
          {matches.map((s) => (
            <li key={s.name}>
              <button
                type="button"
                onClick={() => add(s.name)}
                className="flex w-full items-center rounded-sm px-2 py-1 text-left text-xs hover:bg-accent/50"
              >
                <SkillOption s={s} />
              </button>
            </li>
          ))}
        </ul>
      )}
      {open && query.trim() && matches.length === 0 && (
        <div className="absolute z-30 mt-1 w-full rounded-md border border-border bg-popover px-2 py-1.5 text-xs text-muted-foreground shadow-md">
          查無「{query.trim()}」相關技能
        </div>
      )}
    </div>
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
      {/* ---- 必要技能：搜尋框 + 已選橫向 chip 列 ---- */}
      <div className={cn("space-y-2 border-l-2 pl-3", "border-l-primary")}>
        <div className="flex items-baseline justify-between">
          <Label className="text-sm font-semibold">必要技能</Label>
          <span className="text-[11px] text-muted-foreground">
            一定要達成，否則配裝不顯示。
          </span>
        </div>

        <SkillSearchAdd
          skills={addable}
          onAdd={(name) => onChangeRequired({ ...required, [name]: 1 })}
          placeholder="搜尋技能名稱加入必要條件…"
        />

        {/* 已選必要技能：橫向 chip 列（flex-wrap 自動換行；等級沿用小 dropdown 互動） */}
        <div className="flex flex-wrap gap-1.5">
          {requiredEntries.map(([name, lvl]) => {
            const max = allSkills.find((s) => s.name === name)?.maxLevel ?? 7;
            return (
              <span
                key={name}
                className="inline-flex items-center gap-0.5 rounded-full border border-primary/40 bg-primary/5 py-0.5 pl-2.5 pr-1 text-sm"
              >
                <span className="truncate">{name}</span>
                <Select
                  value={String(lvl)}
                  onValueChange={(v) => setLevel(name, Number(v))}
                >
                  <SelectTrigger
                    className="h-6 w-auto gap-0.5 border-0 bg-transparent px-1 py-0 font-mono text-xs shadow-none focus:ring-0"
                    title="調整等級"
                  >
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
                <button
                  type="button"
                  onClick={() => removeRequired(name)}
                  className="rounded-full p-0.5 text-muted-foreground hover:bg-primary/15 hover:text-foreground"
                  title="移除"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            );
          })}
          {requiredEntries.length === 0 && (
            <p className="text-xs text-muted-foreground">尚未設定</p>
          )}
        </div>

        {/* 常用技能快捷（凍結清單；已加入或已排除者不顯示） */}
        {(() => {
          const quick = COMMON_SKILLS.filter(
            (n) => !(n in required) && !excludedSet.has(n)
          );
          if (quick.length === 0) return null;
          return (
            <div className="flex flex-wrap gap-1">
              {quick.map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => onChangeRequired({ ...required, [name]: 1 })}
                  className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground hover:border-primary/50 hover:text-primary"
                  title="常用技能，點擊加入必要條件"
                >
                  + {name}
                </button>
              ))}
            </div>
          );
        })()}
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

        <SkillSearchAdd
          skills={addable}
          onAdd={(name) => onChangeExcluded([...excluded, name])}
          placeholder="搜尋技能名稱加入排除條件…"
        />
      </div>
    </div>
  );
}
