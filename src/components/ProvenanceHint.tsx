"use client";

import { Badge } from "@/components/ui/badge";

/** 階級標籤配色：MR 較搶眼、HR 中性、村莊偏暗，方便一眼掃出裝備來源檔次。 */
const RANK_BADGE_VARIANT: Record<string, "accent" | "secondary" | "outline"> = {
  MR: "accent",
  HR: "secondary",
  村: "outline",
};

/** 派生小字：系列名 + 階級（依稀有度推算，非精確任務解放條件）。 */
export function ProvenanceHint({
  seriesName,
  rankLabel,
  className,
}: {
  seriesName?: string;
  rankLabel?: string;
  className?: string;
}) {
  if (!seriesName && !rankLabel) return null;
  return (
    <div className={`flex items-center gap-1 ${className ?? ""}`}>
      {seriesName && (
        <span className="truncate text-[10px] text-muted-foreground/70">
          {seriesName}
        </span>
      )}
      {rankLabel && (
        <Badge
          variant={RANK_BADGE_VARIANT[rankLabel] ?? "outline"}
          className="shrink-0 px-1 py-0 text-[9px] leading-tight"
          title="依稀有度推算的階級，非精確任務解放條件"
        >
          {rankLabel}
        </Badge>
      )}
    </div>
  );
}
