"use client";

import { useEffect, useState } from "react";
import { weaponTypes } from "@/lib/data";
import {
  CATEGORY_LABELS,
  STAGE_CATEGORY_ORDER,
  createNameResolver,
  loadRecommendedBuilds,
  type NameResolver,
  type RecommendedIndex,
} from "@/lib/recommended-builds";
import { useLocalStorage } from "@/lib/use-local-storage";
import type { RecommendedBuild } from "@/types/recommended";
import { WeaponIcon } from "@/components/EquipmentIcon";
import { BuildCard } from "./BuildCard";
import { SimpleBuildCard } from "./SimpleBuildCard";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronUp, Loader2, Swords } from "lucide-react";

/** 依 kind 分派卡片版型。 */
function BuildCardDispatch({
  build,
  resolver,
}: {
  build: RecommendedBuild;
  resolver: NameResolver;
}) {
  if (build.kind === "full-build") {
    return <BuildCard build={build} resolver={resolver} />;
  }
  return <SimpleBuildCard build={build} resolver={resolver} />;
}

/** 一個分區（下位/上位過渡/…）：標題 + 卡片網格。 */
function StageSection({
  title,
  builds,
  resolver,
}: {
  title: string;
  builds: RecommendedBuild[];
  resolver: NameResolver;
}) {
  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-bold">{title}</h3>
        <span className="text-xs text-muted-foreground">{builds.length} 套</span>
      </div>
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        {builds.map((b) => (
          <BuildCardDispatch key={b.id} build={b} resolver={resolver} />
        ))}
      </div>
    </section>
  );
}

export function RecommendedView() {
  const [index, setIndex] = useState<RecommendedIndex | null>(null);
  const [resolver, setResolver] = useState<NameResolver | null>(null);
  // 選定的武器種類（persist；空字串＝尚未選）。
  const [weaponType, setWeaponType] = useLocalStorage("mhsb.recoWeaponType", "");
  const [weaponRecoOpen, setWeaponRecoOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    Promise.all([loadRecommendedBuilds(), createNameResolver()]).then(
      ([idx, res]) => {
        if (!alive) return;
        setIndex(idx);
        setResolver(res);
      }
    );
    return () => {
      alive = false;
    };
  }, []);

  const byCat = weaponType ? index?.byWeaponType.get(weaponType) : undefined;
  const weaponRecoBuilds = byCat?.get("weaponRecommend") ?? [];

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto scrollbar-thin">
      <div className="mx-auto w-full max-w-5xl space-y-4 p-4">
        {/* 武器種類網格選擇 */}
        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">
            選擇武器種類
          </p>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-5 md:grid-cols-7">
            {weaponTypes.map((wt) => {
              const active = wt.id === weaponType;
              return (
                <button
                  key={wt.id}
                  type="button"
                  onClick={() => setWeaponType(wt.id)}
                  className={cn(
                    "flex flex-col items-center gap-1 rounded-lg border p-2 transition-colors",
                    active
                      ? "border-primary bg-primary/15 text-primary"
                      : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
                  )}
                  aria-pressed={active}
                >
                  <WeaponIcon type={wt.id} className="h-7 w-7" />
                  <span className="text-[11px] leading-tight">{wt.nameZh}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 內容 */}
        {!resolver || !index ? (
          <div className="flex flex-col items-center justify-center gap-2 py-24 text-muted-foreground">
            <Loader2 className="h-7 w-7 animate-spin text-primary" />
            <p className="text-sm">載入推薦配裝資料…</p>
          </div>
        ) : !weaponType ? (
          <div className="flex flex-col items-center justify-center gap-2 py-24 text-center text-muted-foreground">
            <Swords className="h-8 w-8 text-primary/60" />
            <p className="text-sm">選擇上方武器種類以檢視各階段推薦配裝</p>
          </div>
        ) : (
          <div className="space-y-6">
            {STAGE_CATEGORY_ORDER.map((cat) => {
              const builds = byCat?.get(cat);
              if (!builds || builds.length === 0) return null;
              return (
                <StageSection
                  key={cat}
                  title={CATEGORY_LABELS[cat]}
                  builds={builds}
                  resolver={resolver}
                />
              );
            })}

            {/* 推薦武器一覽（獨立可摺疊區塊，置於最後） */}
            {weaponRecoBuilds.length > 0 && (
              <section>
                <button
                  type="button"
                  onClick={() => setWeaponRecoOpen((v) => !v)}
                  className="flex w-full items-center justify-between rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm font-bold"
                >
                  <span>
                    {CATEGORY_LABELS.weaponRecommend}
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      {weaponRecoBuilds.length} 組
                    </span>
                  </span>
                  {weaponRecoOpen ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </button>
                {weaponRecoOpen && (
                  <div className="grid grid-cols-1 gap-3 pt-2 xl:grid-cols-2">
                    {weaponRecoBuilds.map((b) => (
                      <BuildCardDispatch
                        key={b.id}
                        build={b}
                        resolver={resolver}
                      />
                    ))}
                  </div>
                )}
              </section>
            )}

            {byCat === undefined && (
              <p className="py-12 text-center text-sm text-muted-foreground">
                此武器種類尚無推薦配裝資料。
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
