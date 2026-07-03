"use client";

import type {
  ArmorPart,
  ArmorPiece,
  BuildResult,
  FixedParts,
  ReservedSlots,
  SkillMap,
} from "@/types/build";
import { ARMOR_PARTS, ARMOR_PART_LABELS } from "@/types/build";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SkillSummary } from "./SkillSummary";
import { DecorationSummary } from "./DecorationSummary";
import { formatSlots } from "@/lib/slot-utils";
import {
  Lock,
  Ban,
  Star,
  GitCompare,
  Copy,
  CheckCircle2,
  Gem,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  result: BuildResult;
  rank: number;
  weaponSlotsLabel: string;
  requiredSkills: SkillMap;
  preferredSkills: SkillMap;
  avoidSkills: SkillMap;
  reservedSlots: ReservedSlots;
  fixedParts: FixedParts;
  isFavorite: boolean;
  isCompared: boolean;
  onFixArmor: (part: ArmorPart, id: string) => void;
  onExcludeArmor: (id: string) => void;
  onCopy: (summary: string) => void;
  onToggleFavorite: (id: string) => void;
  onToggleCompare: (id: string) => void;
};

function PartRow({
  label,
  piece,
  fixed,
  onFix,
  onExclude,
}: {
  label: string;
  piece: ArmorPiece;
  fixed: boolean;
  onFix: () => void;
  onExclude: () => void;
}) {
  return (
    <div className="flex items-center gap-2 py-1">
      <Badge
        variant="secondary"
        className="w-10 shrink-0 justify-center px-1 py-0 text-[10px]"
      >
        {label}
      </Badge>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-sm">{piece.nameZh}</span>
          <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
            {formatSlots(piece.slots)}
          </span>
          {piece.isAugmented && (
            <Badge variant="accent" className="px-1 py-0 text-[9px]">
              鍊成
            </Badge>
          )}
        </div>
        {Object.keys(piece.skills).length > 0 && (
          <div className="truncate text-[11px] text-muted-foreground">
            {Object.entries(piece.skills)
              .map(([n, l]) => `${n} ${l}`)
              .join("・")}
          </div>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-0.5">
        <Button
          variant={fixed ? "default" : "ghost"}
          size="icon"
          className="h-7 w-7"
          onClick={onFix}
          title={fixed ? "已固定此部位" : "固定此部位"}
        >
          <Lock className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-destructive"
          onClick={onExclude}
          title="排除此裝備"
        >
          <Ban className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

export function BuildResultCard({
  result,
  rank,
  weaponSlotsLabel,
  requiredSkills,
  preferredSkills,
  avoidSkills,
  fixedParts,
  isFavorite,
  isCompared,
  onFixArmor,
  onExcludeArmor,
  onCopy,
  onToggleFavorite,
  onToggleCompare,
}: Props) {
  const s = result.score;
  const missing = Object.entries(result.missingRequiredSkills);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex-row items-center justify-between gap-2 space-y-0 border-b bg-muted/30 py-2.5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/15 font-mono text-sm font-bold text-primary">
            #{rank}
          </div>
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="font-mono text-lg font-bold">{s.total}</span>
              <span className="text-[11px] text-muted-foreground">總分</span>
            </div>
            <div className="flex flex-wrap gap-x-2 text-[10px] text-muted-foreground">
              <span title="必要技能分">必 {s.requiredSkillScore}</span>
              <span title="偏好技能分">偏 {s.preferredSkillScore}</span>
              <span title="剩餘洞位分">洞 {s.slotScore}</span>
              {s.specialSkillScore > 0 && (
                <span title="特殊技能分" className="text-accent">
                  特 {s.specialSkillScore}
                </span>
              )}
              {s.penaltyScore < 0 && (
                <span title="扣分" className="text-destructive">
                  罰 {s.penaltyScore}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            className={cn("h-8 w-8", isFavorite && "text-primary")}
            onClick={() => onToggleFavorite(result.id)}
            title="收藏"
          >
            <Star
              className={cn("h-4 w-4", isFavorite && "fill-primary")}
            />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className={cn("h-8 w-8", isCompared && "text-accent")}
            onClick={() => onToggleCompare(result.id)}
            title="加入比較"
          >
            <GitCompare className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onCopy(result.summary)}
            title="複製配裝摘要"
          >
            <Copy className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-3 p-3">
        {/* 裝備部位 */}
        <div className="divide-y divide-border/50">
          <div className="flex items-center gap-2 py-1">
            <Badge
              variant="secondary"
              className="w-10 shrink-0 justify-center px-1 py-0 text-[10px]"
            >
              武器
            </Badge>
            <span className="flex-1 text-sm text-muted-foreground">
              {result.weapon ? result.weapon.nameZh : "（自訂洞數）"}
            </span>
            <span className="font-mono text-[10px] text-muted-foreground">
              {result.weapon
                ? formatSlots(result.weapon.slots)
                : weaponSlotsLabel}
            </span>
          </div>
          {ARMOR_PARTS.map((part) => (
            <PartRow
              key={part}
              label={ARMOR_PART_LABELS[part]}
              piece={result.armor[part]}
              fixed={fixedParts[part] === result.armor[part].id}
              onFix={() => onFixArmor(part, result.armor[part].id)}
              onExclude={() => onExcludeArmor(result.armor[part].id)}
            />
          ))}
          <div className="flex items-center gap-2 py-1">
            <Badge
              variant="secondary"
              className="w-10 shrink-0 justify-center px-1 py-0 text-[10px]"
            >
              護石
            </Badge>
            <span className="min-w-0 flex-1 truncate text-sm">
              {Object.entries(result.charm.skills)
                .map(([n, l]) => `${n} ${l}`)
                .join("・") || "無護石"}
            </span>
            <span className="font-mono text-[10px] text-muted-foreground">
              {formatSlots(result.charm.slots)}
            </span>
          </div>
        </div>

        <Separator />

        {/* 裝飾珠 */}
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Gem className="h-3.5 w-3.5" /> 裝飾珠配置
          </div>
          <DecorationSummary decorations={result.decorations} />
        </div>

        {/* 技能摘要 */}
        <div className="space-y-1">
          <div className="text-xs font-medium text-muted-foreground">
            技能摘要
          </div>
          <SkillSummary
            skills={result.finalSkills}
            required={requiredSkills}
            preferred={preferredSkills}
            avoid={avoidSkills}
          />
        </div>

        {/* 未達成必要技能（一般不會有） */}
        {missing.length > 0 && (
          <div className="rounded-md bg-destructive/10 px-2 py-1.5 text-xs text-destructive">
            未達成：
            {missing.map(([n, l]) => `${n} 缺 ${l}`).join("、")}
          </div>
        )}

        {/* 洞位狀態 */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          <span className="text-muted-foreground">
            剩餘洞位：
            <span className="font-mono text-foreground">
              {formatSlots(result.remainingSlots)}
            </span>
          </span>
          <span
            className={cn(
              "flex items-center gap-1",
              result.meetsReservedSlots
                ? "text-emerald-400"
                : "text-destructive"
            )}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            {result.meetsReservedSlots ? "符合保留洞位" : "不符保留洞位"}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
