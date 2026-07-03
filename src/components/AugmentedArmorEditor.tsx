"use client";

import { useState } from "react";
import type { ArmorPiece, Skill } from "@/types/build";
import { ARMOR_PART_LABELS } from "@/types/build";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatSlots, parseSlotString } from "@/lib/slot-utils";
import { Plus, X, Wand2 } from "lucide-react";

type SkillRow = { name: string; level: number };
const NONE = "__none__";
const EMPTY_ROWS: SkillRow[] = [
  { name: "", level: 1 },
  { name: "", level: 1 },
  { name: "", level: 1 },
  { name: "", level: 1 },
];

type Props = {
  allArmors: ArmorPiece[];
  allSkills: Skill[];
  augments: ArmorPiece[];
  onAdd: (piece: ArmorPiece) => void;
  onRemove: (id: string) => void;
};

/**
 * 簡化版傀異鍊成：選原始防具 → 直接輸入「鍊成後」最終技能與洞數 → 加入候選池。
 * 不做差值輸入。產生的自訂防具與原件並存於搜尋。
 */
export function AugmentedArmorEditor({
  allArmors,
  allSkills,
  augments,
  onAdd,
  onRemove,
}: Props) {
  const [baseId, setBaseId] = useState("");
  const [rows, setRows] = useState<SkillRow[]>(EMPTY_ROWS);
  const [slotsStr, setSlotsStr] = useState("");

  const base = allArmors.find((a) => a.id === baseId);

  const selectBase = (id: string) => {
    setBaseId(id);
    const b = allArmors.find((a) => a.id === id);
    if (b) {
      const skillRows = Object.entries(b.skills).map(([name, level]) => ({
        name,
        level,
      }));
      while (skillRows.length < 4) skillRows.push({ name: "", level: 1 });
      setRows(skillRows.slice(0, 4));
      setSlotsStr(formatSlots(b.slots).replace(/—/g, "0"));
    }
  };

  const setRow = (i: number, patch: Partial<SkillRow>) =>
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const add = () => {
    if (!base) return;
    const skills: Record<string, number> = {};
    for (const r of rows) {
      if (r.name) skills[r.name] = (skills[r.name] ?? 0) + r.level;
    }
    const slots = parseSlotString(slotsStr);
    const augment: ArmorPiece = {
      id: `${base.id}__aug_${augments.length + 1}_${Date.now()}`,
      nameZh: `${base.nameZh}（鍊成）`,
      part: base.part,
      rarity: base.rarity,
      slots,
      skills,
      defense: base.defense,
      isAugmented: true,
      baseArmorId: base.id,
      tags: [...(base.tags ?? []), "傀異鍊成"],
    };
    onAdd(augment);
    // 重置
    setBaseId("");
    setRows(EMPTY_ROWS);
    setSlotsStr("");
  };

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">選擇原始防具</Label>
        <Select value={baseId} onValueChange={selectBase}>
          <SelectTrigger className="h-8">
            <SelectValue placeholder="選擇要鍊成的防具" />
          </SelectTrigger>
          <SelectContent>
            {allArmors.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                [{ARMOR_PART_LABELS[a.part]}] {a.nameZh}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {base && (
        <div className="space-y-3 rounded-lg border border-border p-3">
          <div className="text-[11px] text-muted-foreground">
            原始：
            {Object.entries(base.skills)
              .map(([n, l]) => `${n}${l}`)
              .join("、") || "無技能"}
            ｜洞 {formatSlots(base.slots)}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">鍊成後技能</Label>
            {rows.map((row, i) => {
              const max =
                allSkills.find((s) => s.name === row.name)?.maxLevel ?? 3;
              return (
                <div key={i} className="flex items-center gap-2">
                  <Select
                    value={row.name || NONE}
                    onValueChange={(v) =>
                      setRow(i, { name: v === NONE ? "" : v })
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
                    value={String(row.level)}
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
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">鍊成後洞數</Label>
            <Input
              value={slotsStr}
              onChange={(e) => setSlotsStr(e.target.value)}
              placeholder="例如 4-1-0"
              className="h-8 font-mono"
            />
          </div>

          <Button size="sm" className="w-full" onClick={add}>
            <Plus className="h-3.5 w-3.5" /> 加入自訂防具
          </Button>
        </div>
      )}

      {augments.length > 0 && (
        <div className="space-y-1.5">
          <Label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Wand2 className="h-3.5 w-3.5" /> 已建立的鍊成防具
          </Label>
          {augments.map((a) => (
            <div
              key={a.id}
              className="flex items-center justify-between rounded-md bg-muted/50 px-2 py-1.5"
            >
              <div className="min-w-0">
                <div className="truncate text-sm">{a.nameZh}</div>
                <div className="truncate text-[11px] text-muted-foreground">
                  {Object.entries(a.skills)
                    .map(([n, l]) => `${n}${l}`)
                    .join("、") || "無"}
                  ｜洞 {formatSlots(a.slots)}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Badge variant="accent" className="px-1.5 py-0 text-[10px]">
                  {ARMOR_PART_LABELS[a.part]}
                </Badge>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => onRemove(a.id)}
                  title="刪除"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
