"use client";

import { useState } from "react";
import type { RecommendedBuild, RecoArmor } from "@/types/recommended";
import type { NameResolver } from "@/lib/recommended-builds";
import { Card } from "@/components/ui/card";
import { WeaponIcon, ArmorIcon } from "@/components/EquipmentIcon";
import { DecoList, SkillTotals, WarnName, SlotBadge } from "./parts";
import { SourceFooter } from "./SourceFooter";
import {
  ARMOR_PART_LABELS,
  type ArmorPart,
} from "@/types/build";
import { Button } from "@/components/ui/button";
import { skillMax, SPECIAL_SKILLS } from "@/lib/data";
import {
  buildFullBuildImport,
  selectCoreSkillRows,
  type BuilderImport,
} from "@/lib/builder-import";
import { ChevronDown, ChevronUp, Gem, Wand2 } from "lucide-react";

const ARMOR_ORDER: ArmorPart[] = ["head", "chest", "arms", "waist", "legs"];

/**
 * 「以此為基礎修改」按鈕。摘要態與展開態共用；stopPropagation 確保點按鈕
 * （含覆蓋 confirm 取消後）不會冒泡觸發外層列的展開／收合。
 */
function ExportButton({
  build,
  onExport,
}: {
  build: RecommendedBuild;
  onExport: (payload: BuilderImport) => void;
}) {
  return (
    <Button
      variant="outline"
      size="sm"
      className="h-7 shrink-0 gap-1 text-xs"
      onClick={(e) => {
        e.stopPropagation();
        onExport(buildFullBuildImport(build, skillMax, SPECIAL_SKILLS));
      }}
      title="把此配裝的核心技能與護石帶入配裝器（不含傀異錬成加成）"
    >
      <Wand2 className="h-3.5 w-3.5" />
      以此為基礎修改
    </Button>
  );
}

/** 一件防具的名稱：有 alternatives（A/B 二擇一）時顯示「A 或 B」。 */
function ArmorName({
  armor,
  resolver,
}: {
  armor: RecoArmor;
  resolver: NameResolver;
}) {
  const alts = armor.alternatives;
  if (alts && alts.length > 1) {
    return (
      <span>
        {alts.map((a, i) => {
          const r = resolver.armor(a.id, a.rawNameJa);
          return (
            <span key={i}>
              {i > 0 && <span className="text-muted-foreground"> 或 </span>}
              {r.resolved ? r.name : <WarnName name={r.name} />}
            </span>
          );
        })}
      </span>
    );
  }
  const r = resolver.armor(armor.id, armor.rawNameJa);
  return r.resolved ? <span>{r.name}</span> : <WarnName name={r.name} />;
}

/** full-build（成套配裝）卡片：武器、五防具、護石、珠、發動技能總表。 */
export function BuildCard({
  build,
  resolver,
  onExport,
}: {
  build: RecommendedBuild;
  resolver: NameResolver;
  onExport: (payload: BuilderImport) => void;
}) {
  // 卡片摘要／展開兩態（不持久化：單卡展開無回訪價值）。
  const [expanded, setExpanded] = useState(false);
  const [skillsOpen, setSkillsOpen] = useState(false);
  const hasSkillTotals = (build.skillTotals ?? []).length > 0;
  const weapon = build.weapons?.[0];
  const weaponName = weapon
    ? resolver.weapon(weapon.id, weapon.rawNameJa)
    : null;
  const totals = build.skillTotals ?? [];
  const needsCharm = !!(
    build.talisman &&
    ((build.talisman.skills ?? []).length > 0 ||
      (build.talisman.slots ?? []).some((s) => s > 0))
  );
  // 摘要 chip 與匯入 payload 同源（selectCoreSkillRows）：所見即所匯。
  const coreRows = selectCoreSkillRows(build, skillMax, SPECIAL_SKILLS).rows;

  // 摘要態：一列式（武器名 + 核心技能 chip + 護石標記 + 匯入按鈕）。
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
          <WeaponIcon
            type={build.weaponType}
            className="h-5 w-5 shrink-0 text-primary"
          />
          <span className="text-sm font-medium">
            {weaponName ? (
              weaponName.resolved ? (
                weaponName.name
              ) : (
                <WarnName name={weaponName.name} />
              )
            ) : (
              build.buildName
            )}
          </span>
          {needsCharm && (
            <span
              className="inline-flex items-center gap-0.5 text-[10px] text-amber-300"
              title="此配裝需要護石"
            >
              <Gem className="h-3 w-3" />
              護石
            </span>
          )}
          {coreRows.length > 0 && (
            <span className="flex flex-wrap gap-1">
              {coreRows.map((s) => (
                <span
                  key={s.name}
                  className="inline-flex items-center gap-0.5 rounded border border-border bg-muted px-1.5 py-0.5 text-[11px]"
                >
                  {s.name}
                  <span className="font-mono font-semibold">{s.level}</span>
                </span>
              ))}
            </span>
          )}
          <span className="ml-auto flex items-center gap-1">
            {hasSkillTotals && (
              <ExportButton build={build} onExport={onExport} />
            )}
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </span>
        </div>
      </Card>
    );
  }

  // 展開態：完整卡片（內容與改版前一致）。
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
        <div className="min-w-0">
          <h4 className="text-sm font-semibold leading-tight">
            {build.buildName}
          </h4>
          {build.stageName && (
            <p className="truncate text-[11px] text-muted-foreground">
              {build.stageName}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {hasSkillTotals && <ExportButton build={build} onExport={onExport} />}
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        </div>
      </div>

      {/* 武器 */}
      {weapon && weaponName && (
        <div className="flex items-start gap-2 rounded-md border border-border bg-muted/40 p-2">
          <WeaponIcon
            type={build.weaponType}
            className="mt-0.5 h-5 w-5 text-primary"
          />
          <div className="min-w-0 flex-1 space-y-0.5">
            <div className="text-sm font-medium">
              {weaponName.resolved ? (
                weaponName.name
              ) : (
                <WarnName name={weaponName.name} />
              )}
            </div>
            {weapon.statsRaw && (
              <div className="text-[11px] text-muted-foreground">
                {weapon.statsRaw}
              </div>
            )}
            {weapon.decorations && weapon.decorations.length > 0 && (
              <DecoList
                decorations={weapon.decorations}
                resolver={resolver}
              />
            )}
            {weapon.rampageDecos && weapon.rampageDecos.length > 0 && (
              <div className="text-[11px] text-muted-foreground">
                百龍珠：
                {weapon.rampageDecos
                  .map((d) => d.rawNameJa + (d.count && d.count > 1 ? ` ×${d.count}` : ""))
                  .join("・")}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 五防具 */}
      <div className="space-y-1">
        {ARMOR_ORDER.map((part) => {
          const a = build.armor?.find((x) => x.slot === part);
          if (!a) return null;
          return (
            <div key={part} className="flex items-start gap-2 text-sm">
              <span className="flex w-9 shrink-0 items-center gap-1 text-[11px] text-muted-foreground">
                <ArmorIcon part={part} className="h-4 w-4" />
                {ARMOR_PART_LABELS[part]}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-1.5">
                  <span className="font-medium">
                    <ArmorName armor={a} resolver={resolver} />
                  </span>
                  {a.augmentRaw && (
                    <span
                      className="text-[10px] text-purple-300"
                      title="傀異錬成"
                    >
                      {a.augmentRaw}
                    </span>
                  )}
                </div>
                <DecoList
                  decorations={a.decorations}
                  resolver={resolver}
                  className="text-muted-foreground"
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* 護石 */}
      {build.talisman &&
        (!!build.talisman.skills?.length || !!build.talisman.slots?.length) && (
        <div className="flex items-start gap-2 text-sm">
          <span className="w-9 shrink-0 text-[11px] text-muted-foreground">
            護石
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-x-1.5">
              <span className="font-medium">
                {(build.talisman.skills ?? [])
                  .map((s) => `${s.id || s.rawNameJa}${s.level}`)
                  .join("・") || "（無技能）"}
              </span>
              <SlotBadge slots={build.talisman.slots} />
            </div>
            <DecoList
              decorations={build.talisman.decorations}
              resolver={resolver}
              className="text-muted-foreground"
            />
          </div>
        </div>
      )}

      {/* 全裝珠總計（僅上位畢業格式；不逐部位標珠時提供） */}
      {build.buildDecorations && build.buildDecorations.length > 0 && (
        <div className="rounded-md border border-border bg-muted/40 p-2">
          <div className="mb-1 flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
            <Gem className="h-3 w-3" />
            全裝珠總計
          </div>
          <DecoList
            decorations={build.buildDecorations}
            resolver={resolver}
          />
        </div>
      )}

      {/* 百龍技能 */}
      {build.rampageSkills && build.rampageSkills.length > 0 && (
        <div className="text-[11px] text-muted-foreground">
          百龍技能：
          {build.rampageSkills.map((s) => s.rawNameJa).join("・")}
        </div>
      )}

      {/* 發動技能總表（可摺疊） */}
      {totals.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setSkillsOpen((v) => !v)}
            className="flex w-full items-center justify-between rounded-md border border-border bg-muted/40 px-2 py-1 text-[11px] font-medium text-muted-foreground"
          >
            <span>發動技能總表（{totals.length} 項）</span>
            {skillsOpen ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </button>
          {skillsOpen && (
            <div className="pt-1.5">
              <SkillTotals totals={totals} />
            </div>
          )}
        </div>
      )}

      <SourceFooter sourceUrl={build.sourceUrl} />
    </Card>
  );
}
