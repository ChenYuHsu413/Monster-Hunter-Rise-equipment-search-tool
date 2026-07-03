"use client";

import { Badge } from "@/components/ui/badge";

/** 階級標籤配色：MR 較搶眼、HR 中性、村莊偏暗，方便一眼掃出裝備來源檔次。 */
const RANK_BADGE_VARIANT: Record<string, "accent" | "secondary" | "outline"> = {
  MR: "accent",
  HR: "secondary",
  村: "outline",
};

/** 派生小字：系列名 + 階級（依稀有度推算）+ 來源怪（推測）。 */
export function ProvenanceHint({
  seriesName,
  rankLabel,
  source,
  className,
}: {
  seriesName?: string;
  rankLabel?: string;
  source?: string;
  className?: string;
}) {
  if (!seriesName && !rankLabel && !source) return null;
  return (
    <div className={`flex items-center gap-1 ${className ?? ""}`}>
      {seriesName && (
        <span className="truncate text-[11px] text-muted-foreground/70">
          {seriesName}
        </span>
      )}
      {rankLabel && (
        <Badge
          variant={RANK_BADGE_VARIANT[rankLabel] ?? "outline"}
          className="shrink-0 px-1 py-0 text-[10px] leading-tight"
          title="依稀有度推算的階級，非精確任務解放條件"
        >
          {rankLabel}
        </Badge>
      )}
      {source && (
        <span
          className="truncate text-[11px] text-muted-foreground/70"
          title="由生產素材推得的主要來源怪，非官方標註"
        >
          · {source}（推測）
        </span>
      )}
    </div>
  );
}
