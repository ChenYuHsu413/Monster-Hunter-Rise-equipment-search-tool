"use client";

import type { RecommendedBuild } from "@/types/recommended";
import type { NameResolver } from "@/lib/recommended-builds";
import type { BuilderImport } from "@/lib/builder-import";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { WeaponIcon } from "@/components/EquipmentIcon";
import { WarnName, SkillList, SlotBadge } from "./parts";
import { SourceFooter } from "./SourceFooter";
import { Bug, Lock } from "lucide-react";

/** 「在配裝器鎖定」小按鈕；id 未解析（無專案資料）時停用。 */
function LockButton({
  onClick,
  disabled,
  label,
}: {
  onClick: () => void;
  disabled: boolean;
  label: string;
}) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-6 shrink-0 gap-1 px-1.5 text-[11px] text-muted-foreground hover:text-primary"
      onClick={onClick}
      disabled={disabled}
      title={disabled ? "查無對應的專案資料，無法鎖定" : label}
    >
      <Lock className="h-3 w-3" />
      鎖定
    </Button>
  );
}

/** 獵蟲清單（kinsect-list，或 weapon-list 附帶）：只有日文原文，照原樣顯示。 */
function KinsectList({ build }: { build: RecommendedBuild }) {
  if (!build.kinsect || build.kinsect.length === 0) return null;
  return (
    <div className="space-y-1">
      {build.kinsect.map((k, i) => (
        <div key={i} className="flex items-start gap-2 text-sm">
          <Bug className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <div className="min-w-0">
            <div className="font-medium">{k.rawNameJa}</div>
            {k.statsRaw && (
              <div className="text-[11px] text-muted-foreground">
                {k.statsRaw}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * 簡化卡片：armor-pieces（單件推薦清單）／weapon-list（純武器）／kinsect-list（獵蟲）。
 * 非成套語義：無護石、無發動技能總表。
 */
export function SimpleBuildCard({
  build,
  resolver,
  onExport,
}: {
  build: RecommendedBuild;
  resolver: NameResolver;
  onExport: (payload: BuilderImport) => void;
}) {
  return (
    <Card className="flex flex-col gap-2 p-3">
      <div className="min-w-0">
        <h4 className="text-sm font-semibold leading-tight">
          {build.buildName}
        </h4>
        {build.stageName && build.stageName !== build.buildName && (
          <p className="truncate text-[11px] text-muted-foreground">
            {build.stageName}
          </p>
        )}
      </div>

      {/* armor-pieces：逐件列出（同部位可能多件並列擇一） */}
      {build.kind === "armor-pieces" && (
        <div className="space-y-1">
          {(build.armor ?? []).map((a, i) => {
            const r = resolver.armor(a.id, a.rawNameJa);
            return (
              <div key={i} className="text-sm">
                <div className="flex flex-wrap items-baseline gap-x-1.5">
                  <span className="font-medium">
                    {r.resolved ? r.name : <WarnName name={r.name} />}
                  </span>
                  <SlotBadge slots={a.slots} />
                  <LockButton
                    disabled={!a.id}
                    label="在配裝器鎖定此部位為此裝備"
                    onClick={() =>
                      a.id && onExport({ kind: "lock-armor", id: a.id })
                    }
                  />
                </div>
                <SkillList skills={a.skills} />
              </div>
            );
          })}
        </div>
      )}

      {/* weapon-list：武器 + 規格 + H3 標註 */}
      {build.kind === "weapon-list" && (
        <div className="space-y-1.5">
          {(build.weapons ?? []).map((w, i) => {
            const r = resolver.weapon(w.id, w.rawNameJa);
            return (
              <div key={i} className="flex items-start gap-2 text-sm">
                <WeaponIcon
                  type={build.weaponType}
                  className="mt-0.5 h-4 w-4 text-primary"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-1.5">
                    <span className="font-medium">
                      {r.resolved ? r.name : <WarnName name={r.name} />}
                    </span>
                    <SlotBadge slots={w.slots} />
                    {w.rampageSlot ? (
                      <span
                        className="font-mono text-[10px] text-rose-300"
                        title="百龍洞"
                      >
                        龍{w.rampageSlot}
                      </span>
                    ) : null}
                    <LockButton
                      disabled={!w.id}
                      label="在配裝器固定此武器"
                      onClick={() =>
                        w.id &&
                        onExport({
                          kind: "lock-weapon",
                          id: w.id,
                          weaponType: build.weaponType,
                        })
                      }
                    />
                  </div>
                  {w.statsRaw && (
                    <div className="text-[11px] text-muted-foreground">
                      {w.statsRaw}
                    </div>
                  )}
                  {w.noteRaw && w.noteRaw !== r.name && (
                    <div className="text-[11px] text-muted-foreground/80">
                      {w.noteRaw}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          <KinsectList build={build} />
        </div>
      )}

      {/* kinsect-list：純獵蟲 */}
      {build.kind === "kinsect-list" && <KinsectList build={build} />}

      <SourceFooter sourceUrl={build.sourceUrl} />
    </Card>
  );
}
