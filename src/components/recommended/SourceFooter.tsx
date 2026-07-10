"use client";

import type { CommunityPlatform } from "@/types/community";
import { ExternalLink } from "lucide-react";

/** 社群平台的顯示標籤。 */
const PLATFORM_LABELS: Record<CommunityPlatform, string> = {
  bahamut: "巴哈姆特",
  altema: "Altema",
  nga: "NGA",
  bilibili: "bilibili",
  youtube: "YouTube",
  other: "其他",
};

/**
 * 卡片底部來源標註。
 * - 預設（Game8 推薦配裝）：僅 sourceUrl → 「配裝參考：Game8」。
 * - 社群配裝：帶 community（平台＋作者）→ 「配裝參考：<平台>／<作者>」＋外連。
 * 外連一律 rel="nofollow noopener"（社群來源），Game8 沿用 noopener noreferrer。
 */
export function SourceFooter({
  sourceUrl,
  community,
}: {
  sourceUrl: string;
  community?: { platform: CommunityPlatform; author: string };
}) {
  if (community) {
    return (
      <div className="mt-auto flex flex-wrap items-center justify-end gap-x-1 gap-y-0.5 border-t border-border pt-1.5 text-[10px] text-muted-foreground">
        配裝參考：
        <span className="font-medium text-foreground/80">
          {PLATFORM_LABELS[community.platform]}
        </span>
        <span>／{community.author}</span>
        <a
          href={sourceUrl}
          target="_blank"
          rel="nofollow noopener"
          className="inline-flex items-center gap-0.5 text-primary hover:underline"
        >
          原文
          <ExternalLink className="h-2.5 w-2.5" />
        </a>
      </div>
    );
  }
  return (
    <div className="mt-auto flex items-center justify-end gap-1 border-t border-border pt-1.5 text-[10px] text-muted-foreground">
      配裝參考：
      <a
        href={sourceUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-0.5 text-primary hover:underline"
      >
        Game8
        <ExternalLink className="h-2.5 w-2.5" />
      </a>
    </div>
  );
}
