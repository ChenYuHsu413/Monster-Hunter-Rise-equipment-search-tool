"use client";

import type { CharmRow } from "./CharmInput";
import { Button } from "@/components/ui/button";
import { Save, Trash2 } from "lucide-react";

/** 已儲存的護石：保留輸入表單的原始 rows/slots 以利完整還原。 */
export type SavedCharm = { id: string; rows: CharmRow[]; slots: string };

/** 由技能與洞數組出可讀標籤（不另存，渲染時即算）。 */
export function charmLabel(c: SavedCharm): string {
  const skills = c.rows
    .filter((r) => r.name)
    .map((r) => `${r.name}${r.level}`)
    .join("・");
  return `${skills || "無技能"}（${c.slots || "0-0-0"}）`;
}

type Props = {
  library: SavedCharm[];
  /** 目前輸入是否有可儲存內容（至少一個技能或非全空洞數）。 */
  canSave: boolean;
  onSave: () => void;
  onLoad: (c: SavedCharm) => void;
  onDelete: (id: string) => void;
};

/** 護石庫：儲存目前護石、點選載入、刪除。純本地（localStorage）。 */
export function CharmLibrary({
  library,
  canSave,
  onSave,
  onLoad,
  onDelete,
}: Props) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-muted-foreground">
          護石庫（{library.length}）
        </span>
        <Button
          variant="outline"
          size="sm"
          className="h-7 gap-1 text-xs"
          onClick={onSave}
          disabled={!canSave}
          title={canSave ? "儲存目前護石到護石庫" : "先輸入護石技能或洞數"}
        >
          <Save className="h-3.5 w-3.5" /> 儲存目前護石
        </Button>
      </div>
      {library.length === 0 ? (
        <p className="text-[11px] text-muted-foreground">
          尚未儲存護石。輸入後按「儲存目前護石」，之後可一鍵套用。
        </p>
      ) : (
        <ul className="space-y-1">
          {library.map((c) => (
            <li key={c.id} className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => onLoad(c)}
                className="min-w-0 flex-1 truncate rounded-md border border-border px-2 py-1 text-left text-xs hover:bg-muted/50"
                title="套用此護石"
              >
                {charmLabel(c)}
              </button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                onClick={() => onDelete(c.id)}
                title="刪除"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
