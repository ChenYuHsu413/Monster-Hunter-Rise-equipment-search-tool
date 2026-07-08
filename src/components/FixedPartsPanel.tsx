"use client";

import type {
  ArmorPart,
  ArmorPiece,
  ExcludedItems,
  FixedParts,
  Weapon,
} from "@/types/build";
import { ARMOR_PARTS, ARMOR_PART_LABELS } from "@/types/build";
import { ownedCharmLabel, type OwnedCharm } from "@/lib/search-conditions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Lock, X, Ban, Gem } from "lucide-react";
import { RarityBadge } from "./RarityBadge";

type Props = {
  fixedParts: FixedParts;
  excludedItems: ExcludedItems;
  /** 「來自推薦配裝」的護石（chip 顯示、可單獨移除）。 */
  recoCharms: OwnedCharm[];
  armorById: Record<string, ArmorPiece>;
  weaponById: Record<string, Weapon>;
  onClearFixed: (part: ArmorPart | "weapon") => void;
  onRemoveExcluded: (id: string) => void;
  onClearAllFixed: () => void;
  onClearAllExcluded: () => void;
  onRemoveRecoCharm: (id: string) => void;
};

/**
 * 固定部位 / 排除清單面板。
 * 主要由結果卡片操作驅動；此處集中顯示目前鎖定狀態並可解除。
 */
export function FixedPartsPanel({
  fixedParts,
  excludedItems,
  recoCharms,
  armorById,
  weaponById,
  onClearFixed,
  onRemoveExcluded,
  onClearAllFixed,
  onClearAllExcluded,
  onRemoveRecoCharm,
}: Props) {
  const fixedRows: {
    key: ArmorPart | "weapon";
    label: string;
    name: string;
    rarity?: number;
  }[] = [];
  if (fixedParts.weapon && weaponById[fixedParts.weapon]) {
    const w = weaponById[fixedParts.weapon];
    fixedRows.push({ key: "weapon", label: "武器", name: w.nameZh, rarity: w.rarity });
  }
  for (const part of ARMOR_PARTS) {
    const id = fixedParts[part];
    if (id && armorById[id]) {
      fixedRows.push({
        key: part,
        label: ARMOR_PART_LABELS[part],
        name: armorById[id].nameZh,
        rarity: armorById[id].rarity,
      });
    }
  }

  const hasFixed = fixedRows.length > 0;
  const hasExcluded =
    excludedItems.armorIds.length > 0 || excludedItems.weaponIds.length > 0;

  return (
    <div className="space-y-3">
      <div>
        <div className="mb-1.5 flex items-center justify-between gap-1.5">
          <span className="flex items-center gap-1.5 text-sm font-medium">
            <Lock className="h-3.5 w-3.5 text-primary" /> 已固定部位
          </span>
          {hasFixed && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-1.5 text-[11px] text-muted-foreground hover:text-destructive"
              onClick={onClearAllFixed}
            >
              全部清除
            </Button>
          )}
        </div>
        {hasFixed ? (
          <div className="space-y-1">
            {fixedRows.map((r) => (
              <div
                key={r.key}
                className="flex items-center justify-between rounded-md bg-primary/10 px-2 py-1"
              >
                <span className="flex items-center gap-2 text-sm">
                  <Badge className="px-1.5 py-0 text-[10px]">{r.label}</Badge>
                  {r.name}
                  <RarityBadge rarity={r.rarity} />
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => onClearFixed(r.key)}
                  title="解除固定"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            未固定任何部位。可在搜尋結果中點「固定此部位」。
          </p>
        )}
      </div>

      <div>
        <div className="mb-1.5 flex items-center justify-between gap-1.5">
          <span className="flex items-center gap-1.5 text-sm font-medium">
            <Ban className="h-3.5 w-3.5 text-destructive" /> 排除的裝備
          </span>
          {hasExcluded && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-1.5 text-[11px] text-muted-foreground hover:text-destructive"
              onClick={onClearAllExcluded}
            >
              全部清除
            </Button>
          )}
        </div>
        {hasExcluded ? (
          <div className="flex flex-wrap gap-1.5">
            {excludedItems.weaponIds.map((id) => (
              <Badge
                key={id}
                variant="destructive"
                className="gap-1 py-0.5 pl-2 pr-1"
              >
                🗡 {weaponById[id]?.nameZh ?? id}
                <button
                  onClick={() => onRemoveExcluded(id)}
                  className="rounded-sm hover:bg-destructive/20"
                  title="移除排除"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
            {excludedItems.armorIds.map((id) => (
              <Badge
                key={id}
                variant="destructive"
                className="gap-1 py-0.5 pl-2 pr-1"
              >
                {armorById[id]?.nameZh ?? id}
                <button
                  onClick={() => onRemoveExcluded(id)}
                  className="rounded-sm hover:bg-destructive/20"
                  title="移除排除"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            未排除任何裝備。可在搜尋結果中點「排除此裝備」。
          </p>
        )}
      </div>

      {recoCharms.length > 0 && (
        <div>
          <div className="mb-1.5 flex items-center gap-1.5 text-sm font-medium">
            <Gem className="h-3.5 w-3.5 text-accent" /> 來自推薦配裝的護石
          </div>
          <div className="flex flex-wrap gap-1.5">
            {recoCharms.map((c) => (
              <Badge
                key={c.id}
                variant="accent"
                className="gap-1 py-0.5 pl-2 pr-1"
              >
                {ownedCharmLabel(c)}
                <button
                  onClick={() => onRemoveRecoCharm(c.id)}
                  className="rounded-sm hover:bg-accent/20"
                  title="移除此護石"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
