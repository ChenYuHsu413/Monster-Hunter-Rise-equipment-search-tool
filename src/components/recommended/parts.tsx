"use client";

import type {
  RecoDecoration,
  RecoSkill,
  RecoSkillTotal,
} from "@/types/recommended";
import type { NameResolver } from "@/lib/recommended-builds";
import { cn } from "@/lib/utils";
import { AlertTriangle } from "lucide-react";

/** 對應不到專案內部資料時的名稱樣式（琥珀色 + 警告圖示），確保卡片不爆掉。 */
export function WarnName({ name }: { name: string }) {
  return (
    <span
      className="inline-flex items-center gap-0.5 text-amber-400"
      title="查無對應的專案資料，顯示日文原文"
    >
      <AlertTriangle className="h-3 w-3 shrink-0" />
      {name}
    </span>
  );
}

/** 從 Game8 原文（如「各属性強化の装飾品【3】」「守勢珠【3】」）取出洞等級數字。 */
function slotLevelFromRaw(raw?: string): number | null {
  const m = raw?.match(/【(\d)】/);
  return m ? Number(m[1]) : null;
}

/** 單顆裝飾珠的顯示文字節點。處理 placeholder / free / 一般三態。 */
export function DecoLine({
  deco,
  resolver,
}: {
  deco: RecoDecoration;
  resolver: NameResolver;
}) {
  const count = deco.count && deco.count > 1 ? ` ×${deco.count}` : "";

  // 屬性佔位符：依武器屬性自選對應珠，不做 ID 對照。
  if (deco.placeholder) {
    const lv = slotLevelFromRaw(deco.rawNameJa);
    return (
      <span className="text-sky-300" title="依你的武器屬性自選對應屬性珠">
        對應屬性珠{lv != null ? `【${lv}】` : ""}
        {count}
      </span>
    );
  }

  // 留空的洞。
  if (deco.free) {
    return (
      <span className="text-muted-foreground">
        空{deco.slotSize ? `【${deco.slotSize}】` : ""}
        {count}
      </span>
    );
  }

  const r = resolver.deco(deco.id, deco.rawNameJa);
  return (
    <span>
      {r.resolved ? r.name : <WarnName name={r.name} />}
      {count}
    </span>
  );
}

/** 一組裝飾珠（以「・」分隔）。空陣列回傳 null。 */
export function DecoList({
  decorations,
  resolver,
  className,
}: {
  decorations?: RecoDecoration[];
  resolver: NameResolver;
  className?: string;
}) {
  if (!decorations || decorations.length === 0) return null;
  return (
    <span className={cn("text-xs", className)}>
      {decorations.map((d, i) => (
        <span key={i}>
          {i > 0 && <span className="text-muted-foreground">・</span>}
          <DecoLine deco={d} resolver={resolver} />
        </span>
      ))}
    </span>
  );
}

/** 單件裝備自帶技能（armor-pieces 用）。id＝中文名，缺才 fallback rawNameJa。 */
export function SkillList({ skills }: { skills?: RecoSkill[] }) {
  if (!skills || skills.length === 0) return null;
  return (
    <span className="text-xs text-muted-foreground">
      {skills.map((s, i) => {
        const name = s.id || s.rawNameJa || "（未知技能）";
        return (
          <span key={i}>
            {i > 0 && "・"}
            {s.id ? name : <WarnName name={name} />}
            {s.level}
          </span>
        );
      })}
    </span>
  );
}

/** 發動技能總表：required 紅字、augmentedLevel 標「錬成→N」。 */
export function SkillTotals({ totals }: { totals: RecoSkillTotal[] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {totals.map((s, i) => {
        const name = s.id || s.rawNameJa || "（未知技能）";
        return (
          <span
            key={i}
            className={cn(
              "inline-flex items-center gap-0.5 rounded border px-1.5 py-0.5 text-[11px]",
              s.required
                ? "border-red-500/40 bg-red-500/10 text-red-300"
                : "border-border bg-muted text-foreground"
            )}
            title={s.required ? "必要技能" : undefined}
          >
            {s.id ? name : <WarnName name={name} />}
            <span className="font-mono font-semibold">{s.level}</span>
            {s.augmentedLevel != null && s.augmentedLevel !== s.level && (
              <span
                className="font-mono text-emerald-400"
                title="傀異錬成加成後等級"
              >
                →{s.augmentedLevel}
              </span>
            )}
          </span>
        );
      })}
    </div>
  );
}

/** 洞位徽章（[4,2,0] → 4-2）。 */
export function SlotBadge({ slots }: { slots?: number[] }) {
  const filled = (slots ?? []).filter((s) => s > 0);
  if (filled.length === 0) return null;
  return (
    <span className="font-mono text-[11px] text-muted-foreground">
      {filled.join("-")}
    </span>
  );
}
