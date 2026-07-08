"use client";

import { useMemo } from "react";
import type {
  ArmorPart,
  ArmorPiece,
  BuildResult,
  ElementResistanceKey,
  FixedParts,
  SkillMap,
} from "@/types/build";
import {
  ARMOR_PARTS,
  ARMOR_PART_LABELS,
  ELEMENT_RES_KEYS,
} from "@/types/build";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SkillSummary } from "./SkillSummary";
import { DecorationSummary } from "./DecorationSummary";
import { ProvenanceHint } from "./ProvenanceHint";
import { WeaponIcon, ArmorIcon } from "./EquipmentIcon";
import { formatSlots } from "@/lib/slot-utils";
import {
  formatWeaponSource,
  formatWeaponSpecial,
  formatWeaponStats,
  weaponSeriesLabel,
} from "@/lib/weapon-utils";
import { weaponTypes, decorationsBySkill, skillMax } from "@/lib/data";
import { mergeMaxSkills } from "@/lib/preset-resolver";
import { suggestAddableSkills } from "@/lib/suggest-skills";
import {
  Lock,
  Ban,
  Star,
  GitCompare,
  Copy,
  CheckCircle2,
  Gem,
  Sparkles,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  result: BuildResult;
  rank: number;
  weaponSlotsLabel: string;
  /** 使用者指定的必要技能（不含 autoSkills，卡片內會合併）。 */
  requiredSkills: SkillMap;
  fixedParts: FixedParts;
  /** 已排除的裝備/武器 id 集合（用於卡片上顯示排除狀態）。 */
  excludedIds: Set<string>;
  isFavorite: boolean;
  isCompared: boolean;
  onFixArmor: (part: ArmorPart, id: string) => void;
  onExcludeArmor: (id: string) => void;
  onFixWeapon: (id: string) => void;
  onExcludeWeapon: (id: string) => void;
  onCopy: (summary: string) => void;
  onToggleFavorite: (id: string) => void;
  onToggleCompare: (id: string) => void;
};

const RES_LABELS: Record<ElementResistanceKey, string> = {
  fire: "火",
  water: "水",
  thunder: "雷",
  ice: "冰",
  dragon: "龍",
};

function PartRow({
  part,
  label,
  piece,
  fixed,
  excluded,
  onFix,
  onExclude,
}: {
  part: ArmorPart;
  label: string;
  piece: ArmorPiece;
  fixed: boolean;
  excluded: boolean;
  onFix: () => void;
  onExclude: () => void;
}) {
  return (
    <div className={cn("flex items-center gap-2 py-1", excluded && "opacity-50")}>
      <ArmorIcon
        part={part}
        rarity={piece.rarity}
        className="h-8 w-8"
        title={label}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span
            className={cn("truncate text-[15px]", excluded && "line-through")}
          >
            {piece.nameZh}
          </span>
          <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
            {formatSlots(piece.slots)}
          </span>
          {piece.isAugmented && (
            <Badge variant="accent" className="px-1 py-0 text-[11px]">
              鍊成
            </Badge>
          )}
          {excluded && (
            <Badge variant="destructive" className="px-1 py-0 text-[10px]">
              已排除
            </Badge>
          )}
        </div>
        <ProvenanceHint
          seriesName={piece.seriesName}
          rankLabel={piece.rankLabel}
          rarity={piece.rarity}
          source={piece.sourceMonster}
        />
        {Object.keys(piece.skills).length > 0 && (
          <div className="truncate text-xs text-muted-foreground">
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
          variant={excluded ? "destructive" : "ghost"}
          size="icon"
          className={cn(
            "h-7 w-7",
            !excluded && "text-muted-foreground hover:text-destructive"
          )}
          onClick={onExclude}
          title={excluded ? "已排除（重新搜尋後生效）" : "排除此裝備"}
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
  fixedParts,
  excludedIds,
  isFavorite,
  isCompared,
  onFixArmor,
  onExcludeArmor,
  onFixWeapon,
  onExcludeWeapon,
  onCopy,
  onToggleFavorite,
  onToggleCompare,
}: Props) {
  const missing = Object.entries(result.missingRequiredSkills);
  const weapon = result.weapon;
  const weaponExcluded = weapon ? excludedIds.has(weapon.id) : false;
  const weaponTypeLabel = weapon
    ? weaponTypes.find((t) => t.id === weapon.weaponType)?.nameZh
    : undefined;
  const autoEntries = Object.entries(result.autoSkills ?? {});
  // 技能摘要的「使用者指定」集合 = 必要技能 + 自動技能（兩者都不算額外賺到）
  const effectiveRequired = useMemo(
    () => mergeMaxSkills(requiredSkills, result.autoSkills ?? {}),
    [requiredSkills, result.autoSkills]
  );
  // 追加技能建議：用此配裝的剩餘洞位推算還能塞哪些珠（擇一）。
  const addable = useMemo(
    () =>
      suggestAddableSkills(
        result.remainingSlots,
        result.finalSkills,
        decorationsBySkill,
        skillMax,
        6
      ),
    [result.remainingSlots, result.finalSkills]
  );

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex-row items-center justify-between gap-2 space-y-0 border-b bg-muted/30 py-2.5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/15 font-mono text-sm font-bold text-primary">
            #{rank}
          </div>
          <div>
            <div className="flex items-baseline gap-1.5">
              <span
                className="font-mono text-lg font-bold text-orange-400"
                title="EFR：期望攻擊值（同武器種類內可比較的參考指標）"
              >
                {result.efr.raw}
              </span>
              <span className="text-[11px] text-muted-foreground">EFR</span>
            </div>
            <div className="flex flex-wrap gap-x-2 text-[11px] text-muted-foreground">
              {result.efr.element > 0 && (
                <span title="期望屬性值（EFR 屬性部分）" className="text-sky-400">
                  屬性 {result.efr.element}
                </span>
              )}
              <span title="5 件防具基礎防禦總和">防禦 {result.totalDefense}</span>
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
            {weapon ? (
              <WeaponIcon
                type={weapon.weaponType}
                className="h-8 w-8 text-foreground/80"
                title="武器"
              />
            ) : (
              <Badge
                variant="secondary"
                className="w-11 shrink-0 justify-center px-1 py-0 text-[11px]"
              >
                武器
              </Badge>
            )}
            {weapon ? (
              <>
                <div className={cn("min-w-0 flex-1", weaponExcluded && "opacity-50")}>
                  <div className="flex items-center gap-1.5">
                    <span
                      className={cn(
                        "truncate text-[15px]",
                        weaponExcluded && "line-through"
                      )}
                    >
                      {weapon.nameZh}
                    </span>
                    {weaponExcluded && (
                      <Badge variant="destructive" className="px-1 py-0 text-[10px]">
                        已排除
                      </Badge>
                    )}
                    {weaponTypeLabel && (
                      <span className="shrink-0 text-[11px] text-muted-foreground">
                        {weaponTypeLabel}
                      </span>
                    )}
                    <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
                      {formatSlots(weapon.slots)}
                    </span>
                    <Badge
                      variant={result.weaponFixed ? "default" : "accent"}
                      className="shrink-0 px-1 py-0 text-[11px]"
                    >
                      {result.weaponFixed ? "固定" : "搜尋"}
                    </Badge>
                  </div>
                  <ProvenanceHint
                    seriesName={weaponSeriesLabel(weapon)}
                    rankLabel={weapon.rankLabel}
                    rarity={weapon.rarity}
                  />
                  <div className="truncate text-xs text-muted-foreground">
                    {[formatWeaponStats(weapon), ...formatWeaponSpecial(weapon)].join(
                      "　"
                    )}
                  </div>
                  {formatWeaponSource(weapon) && (
                    <div className="truncate text-xs text-muted-foreground/70">
                      {formatWeaponSource(weapon)}
                    </div>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-0.5">
                  <Button
                    variant={result.weaponFixed ? "default" : "ghost"}
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => onFixWeapon(weapon.id)}
                    title={result.weaponFixed ? "已固定此武器" : "固定此武器"}
                  >
                    <Lock className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant={weaponExcluded ? "destructive" : "ghost"}
                    size="icon"
                    className={cn(
                      "h-7 w-7",
                      !weaponExcluded &&
                        "text-muted-foreground hover:text-destructive"
                    )}
                    onClick={() => onExcludeWeapon(weapon.id)}
                    title={
                      weaponExcluded ? "已排除（重新搜尋後生效）" : "排除此武器"
                    }
                  >
                    <Ban className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </>
            ) : (
              <>
                <span className="flex-1 text-sm text-muted-foreground">
                  （自訂洞數）
                </span>
                <span className="font-mono text-[11px] text-muted-foreground">
                  {weaponSlotsLabel}
                </span>
              </>
            )}
          </div>
          {ARMOR_PARTS.map((part) => (
            <PartRow
              key={part}
              part={part}
              label={ARMOR_PART_LABELS[part]}
              piece={result.armor[part]}
              fixed={fixedParts[part] === result.armor[part].id}
              excluded={excludedIds.has(result.armor[part].id)}
              onFix={() => onFixArmor(part, result.armor[part].id)}
              onExclude={() => onExcludeArmor(result.armor[part].id)}
            />
          ))}
          <div className="flex items-center gap-2 py-1">
            <Badge
              variant="secondary"
              className="w-11 shrink-0 justify-center px-1 py-0 text-[11px]"
            >
              護石
            </Badge>
            {result.charm.id ? (
              <>
                <span className="min-w-0 flex-1 truncate text-sm">
                  {result.charm.name}
                </span>
                <Badge variant="accent" className="shrink-0 px-1 py-0 text-[11px]">
                  我的護石
                </Badge>
              </>
            ) : (
              <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
                未使用護石
              </span>
            )}
            <span className="font-mono text-[11px] text-muted-foreground">
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

        {/* 自動技能（依武器屬性加入） */}
        {autoEntries.length > 0 && (
          <p className="flex items-center gap-1.5 rounded-md bg-accent/10 px-2 py-1 text-[11px] text-accent">
            <Sparkles className="h-3 w-3 shrink-0" />
            自動技能：
            {autoEntries.map(([n, l]) => `${n} Lv${l}`).join("、")}
          </p>
        )}

        {/* 技能摘要 */}
        <div className="space-y-1">
          <div className="text-xs font-medium text-muted-foreground">
            技能摘要
          </div>
          <SkillSummary
            skills={result.finalSkills}
            required={effectiveRequired}
          />
        </div>

        {/* 未達成必要技能（一般不會有） */}
        {missing.length > 0 && (
          <div className="rounded-md bg-destructive/10 px-2 py-1.5 text-xs text-destructive">
            未達成：
            {missing.map(([n, l]) => `${n} 缺 ${l}`).join("、")}
          </div>
        )}

        {/* 防禦 / 屬性耐性（5 件防具總和） */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span>
            防禦{" "}
            <span className="font-mono text-foreground">
              {result.totalDefense}
            </span>
          </span>
          <span className="flex items-center gap-1.5 font-mono">
            {ELEMENT_RES_KEYS.map((k) => {
              const v = result.totalResistances[k];
              return (
                <span
                  key={k}
                  className={cn(
                    v < 0 && "text-destructive",
                    v > 0 && "text-emerald-400"
                  )}
                >
                  {RES_LABELS[k]}
                  {v >= 0 ? `+${v}` : v}
                </span>
              );
            })}
          </span>
        </div>

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

        {/* 追加技能建議（用剩餘洞，擇一） */}
        {addable.length > 0 && (
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Plus className="h-3.5 w-3.5" /> 可追加技能（擇一，用剩餘洞）
            </div>
            <div className="flex flex-wrap gap-1.5">
              {addable.map((a) => (
                <Badge
                  key={a.skillName}
                  variant="outline"
                  className="gap-1 px-2 py-0.5 text-[12px]"
                >
                  <span>{a.skillName}</span>
                  <span className="font-mono opacity-70">+{a.addLevels}</span>
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
