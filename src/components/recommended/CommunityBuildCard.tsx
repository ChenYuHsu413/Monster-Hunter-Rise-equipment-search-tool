"use client";

import { useState } from "react";
import type { ResolvedCommunityBuild } from "@/lib/community-builds";
import { buildCommunityImport } from "@/lib/community-builds";
import type { BuilderImport } from "@/lib/builder-import";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { WeaponIcon, ArmorIcon } from "@/components/EquipmentIcon";
import { ARMOR_PART_LABELS, type ArmorPart } from "@/types/build";
import { WarnName, SlotBadge } from "./parts";
import { SourceFooter } from "./SourceFooter";
import { ChevronDown, ChevronUp, Gem, Info, Wand2 } from "lucide-react";

const ARMOR_ORDER: ArmorPart[] = ["head", "chest", "arms", "waist", "legs"];

/** 目標技能 chip（名稱＋等級；未解析以 WarnName 琥珀提示）。 */
function SkillChips({
  skills,
}: {
  skills: (ResolvedCommunityBuild["targetSkills"][number])[];
}) {
  return (
    <>
      {skills.map((s, i) => (
        <span
          key={i}
          className="inline-flex shrink-0 items-center gap-0.5 whitespace-nowrap rounded border border-border bg-muted px-1.5 py-0.5 text-[11px]"
        >
          {s.resolved ? s.name : <WarnName name={s.name} />}
          <span className="font-mono font-semibold">{s.level}</span>
        </span>
      ))}
    </>
  );
}

/** 「以此為基礎修改」按鈕：匯出＝防具鎖定＋目標技能（＋護石）。 */
function ExportButton({
  build,
  onExport,
}: {
  build: ResolvedCommunityBuild;
  onExport: (payload: BuilderImport) => void;
}) {
  return (
    <Button
      variant="outline"
      size="sm"
      className="h-7 shrink-0 gap-1 text-xs"
      onClick={(e) => {
        e.stopPropagation();
        onExport(buildCommunityImport(build));
      }}
      title="鎖定此防具骨架與目標技能到配裝器，孔位珠子由你的護石計算"
    >
      <Wand2 className="h-3.5 w-3.5" />
      以此為基礎修改
    </Button>
  );
}

/** 「示範資料」徽章（placeholder）。 */
function DemoBadge() {
  return (
    <span className="inline-flex shrink-0 items-center rounded border border-dashed border-amber-400/50 px-1 py-0.5 text-[9px] font-medium text-amber-400">
      示範資料
    </span>
  );
}

/**
 * 社群配裝卡片。摘要態（名稱＋目標技能 chip＋匯入）／展開態（武器、五防具＋逐孔珠、
 * 護石／骨架提示、目標技能、原文摘記、來源）。與 Game8 卡片同版型語彙、共用 parts。
 */
export function CommunityBuildCard({
  build,
  onExport,
}: {
  build: ResolvedCommunityBuild;
  onExport: (payload: BuilderImport) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const { raw } = build;
  const wt = raw.weaponType;

  if (!expanded) {
    return (
      <Card className="p-3">
        <div
          role="button"
          tabIndex={0}
          onClick={() => setExpanded(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setExpanded(true);
            }
          }}
          aria-expanded={false}
          title="點擊展開完整配裝"
          className="flex cursor-pointer flex-wrap items-center gap-x-2 gap-y-1"
        >
          <div className="order-1 flex min-w-0 shrink items-center gap-2">
            {wt && (
              <WeaponIcon type={wt} className="h-5 w-5 shrink-0 text-primary" />
            )}
            <span className="truncate text-sm font-medium">{raw.buildName}</span>
            {raw.placeholder && <DemoBadge />}
          </div>
          <div className="order-2 ml-auto flex shrink-0 items-center gap-1 sm:order-3">
            {!build.hasDetails && (
              <span
                className="inline-flex items-center gap-0.5 text-[10px] text-sky-300"
                title="純骨架：護石與裝飾品由你的資源計算"
              >
                <Gem className="h-3 w-3" />
                骨架
              </span>
            )}
            <ExportButton build={build} onExport={onExport} />
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </div>
          {build.targetSkills.length > 0 && (
            <div className="order-3 flex w-full min-w-0 gap-1 overflow-hidden sm:order-2 sm:w-auto sm:flex-1">
              <SkillChips skills={build.targetSkills} />
            </div>
          )}
        </div>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col gap-2 p-3">
      {/* 標題（點擊收合） */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => setExpanded(false)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setExpanded(false);
          }
        }}
        aria-expanded={true}
        title="點擊收合"
        className="flex cursor-pointer items-start justify-between gap-2"
      >
        <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5">
          <h4 className="text-sm font-semibold leading-tight">{raw.buildName}</h4>
          {raw.placeholder && <DemoBadge />}
          {raw.gameVersion && (
            <span className="text-[10px] text-muted-foreground">
              {raw.gameVersion}
            </span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <ExportButton build={build} onExport={onExport} />
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        </div>
      </div>

      {/* 武器（選填） */}
      {build.weapon && (
        <div className="flex items-start gap-2 rounded-md border border-border bg-muted/40 p-2">
          <WeaponIcon
            type={wt ?? "great-sword"}
            className="mt-0.5 h-5 w-5 text-primary"
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-x-1.5 text-sm">
              <span className="font-medium">
                {build.weapon.armor.resolved ? (
                  build.weapon.armor.name
                ) : (
                  <WarnName name={build.weapon.armor.name} />
                )}
              </span>
              <SlotBadge slots={build.weapon.slots} />
            </div>
            {build.weapon.rampageRaw.length > 0 && (
              <div className="text-[11px] text-muted-foreground">
                百龍珠：{build.weapon.rampageRaw.join("・")}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 五防具（＋逐孔珠、傀異錬成，選填） */}
      <div className="space-y-1">
        {ARMOR_ORDER.map((part) => {
          const p = build.armor.find((x) => x.slot === part);
          // 自由枠（彈性孔）：無固定防具，顯示「由你的裝備填」——B 最強系列 MR201+ 傀異前提配裝。
          if (!p) {
            if (!raw.flexSlots?.includes(part)) return null;
            return (
              <div key={part} className="flex items-start gap-2 text-sm">
                <span className="flex w-9 shrink-0 items-center gap-1 text-[11px] text-muted-foreground">
                  <ArmorIcon part={part} className="h-4 w-4" />
                  {ARMOR_PART_LABELS[part]}
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] text-sky-300/90" title="自由枠：由你的裝備與資源填">
                  <Gem className="h-3 w-3" />
                  自由枠（由你的裝備填）
                </span>
              </div>
            );
          }
          return (
            <div key={part} className="flex items-start gap-2 text-sm">
              <span className="flex w-9 shrink-0 items-center gap-1 text-[11px] text-muted-foreground">
                <ArmorIcon part={part} className="h-4 w-4" />
                {ARMOR_PART_LABELS[part]}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-1.5">
                  <span className="font-medium">
                    {p.armor.resolved ? (
                      p.armor.name
                    ) : (
                      <WarnName name={p.armor.name} />
                    )}
                  </span>
                  {p.augment && (
                    <span className="text-[10px] text-purple-300" title="傀異錬成">
                      {p.augment}
                    </span>
                  )}
                </div>
                {p.decorations.length > 0 && (
                  <span className="text-xs text-muted-foreground">
                    {p.decorations.map((d, i) => (
                      <span key={i}>
                        {i > 0 && "・"}
                        {d.resolved ? d.name : <WarnName name={d.name} />}
                        {d.count && d.count > 1 ? ` ×${d.count}` : ""}
                      </span>
                    ))}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 護石（選填）或骨架提示 */}
      {build.talisman &&
      (build.talisman.skills.length > 0 || (build.talisman.slots ?? []).some((s) => s > 0)) ? (
        <div className="flex items-start gap-2 text-sm">
          <span className="w-9 shrink-0 text-[11px] text-muted-foreground">護石</span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-x-1.5">
              <span className="font-medium">
                {build.talisman.skills.length
                  ? build.talisman.skills
                      .map((s) => `${s.resolved ? s.name : s.raw}${s.level}`)
                      .join("・")
                  : "（無技能）"}
              </span>
              <SlotBadge slots={build.talisman.slots} />
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-1.5 rounded-md border border-sky-400/30 bg-sky-400/5 px-2 py-1.5 text-[11px] text-sky-200/90">
          <Info className="mt-0.5 h-3 w-3 shrink-0" />
          <span>護石與裝飾品：匯入配裝器後以你的護石計算。</span>
        </div>
      )}

      {/* 目標技能 */}
      <div>
        <div className="mb-1 text-[11px] font-medium text-muted-foreground">
          目標技能
        </div>
        <div className="flex flex-wrap gap-1">
          <SkillChips skills={build.targetSkills} />
        </div>
      </div>

      {/* 原文摘記（選填） */}
      {raw.notes && (
        <p className="text-[11px] leading-relaxed text-muted-foreground/80">
          {raw.notes}
        </p>
      )}

      <SourceFooter
        sourceUrl={raw.source.url}
        community={{ platform: raw.source.platform, author: raw.source.author }}
      />
    </Card>
  );
}
