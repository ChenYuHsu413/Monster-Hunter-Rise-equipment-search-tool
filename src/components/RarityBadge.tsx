"use client";

import { rarityColor, rarityTextColor } from "@/lib/rarity";
import { cn } from "@/lib/utils";

/** 依稀有度上色的「RARE N」徽章。底色為該稀有度代表色、字色自動取黑/白。 */
export function RarityBadge({
  rarity,
  className,
}: {
  rarity?: number;
  className?: string;
}) {
  if (rarity == null) return null;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded px-1 font-mono text-[10px] font-bold leading-[1.4] tracking-tight",
        className
      )}
      style={{
        backgroundColor: rarityColor(rarity),
        color: rarityTextColor(rarity),
      }}
      title={`稀有度 ${rarity}`}
    >
      RARE&nbsp;{rarity}
    </span>
  );
}
