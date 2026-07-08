"use client";

import { ExternalLink } from "lucide-react";

/** 卡片底部來源標註（Game8 網站顯示時必須標註，見 recommended-builds meta.attribution）。 */
export function SourceFooter({ sourceUrl }: { sourceUrl: string }) {
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
