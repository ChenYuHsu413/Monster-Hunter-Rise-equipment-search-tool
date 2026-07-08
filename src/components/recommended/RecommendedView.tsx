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
import type { RecommendedBuild, RecommendedCategory } from "@/types/recommended";
import type { BuilderImport } from "@/lib/builder-import";
import { WeaponIcon } from "@/components/EquipmentIcon";
import { BuildCard } from "./BuildCard";
import { SimpleBuildCard } from "./SimpleBuildCard";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronUp, Loader2, Swords } from "lucide-react";

/** 手風琴分區的顯示順序：五階段（依既有順序）+ 推薦武器一覽收尾。 */
const SECTION_ORDER: RecommendedCategory[] = [
  ...STAGE_CATEGORY_ORDER,
  "weaponRecommend",
];

/** 依 kind 分派卡片版型。 */
function BuildCardDispatch({
  build,
  resolver,
  onExport,
}: {
  build: RecommendedBuild;
  resolver: NameResolver;
  onExport: (payload: BuilderImport) => void;
}) {
  if (build.kind === "full-build") {
    return <BuildCard build={build} resolver={resolver} onExport={onExport} />;
  }
  return (
    <SimpleBuildCard build={build} resolver={resolver} onExport={onExport} />
  );
}

/**
 * 一個可收合分區（手風琴一員）：標題列（名稱 + 筆數 + chevron）+ 展開時的卡片網格。
 * 五階段與推薦武器一覽共用此版型；收合時不掛載卡片（30~40 張卡的頁面實質省渲染）。
 */
function StageSection({
  title,
  count,
  open,
  onToggle,
  builds,
  resolver,
  onExport,
}: {
  title: string;
  count: number;
  open: boolean;
  onToggle: () => void;
  builds: RecommendedBuild[];
  resolver: NameResolver;
  onExport: (payload: BuilderImport) => void;
}) {
  return (
    <section className="space-y-2">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center justify-between rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm font-bold"
      >
        <span>
          {title}
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            ({count})
          </span>
        </span>
        {open ? (
          <ChevronUp className="h-4 w-4" />
        ) : (
          <ChevronDown className="h-4 w-4" />
        )}
      </button>
      {open && (
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          {builds.map((b) => (
            <BuildCardDispatch
              key={b.id}
              build={b}
              resolver={resolver}
              onExport={onExport}
            />
          ))}
        </div>
      )}
    </section>
  );
}

export function RecommendedView({
  onExport,
}: {
  onExport: (payload: BuilderImport) => void;
}) {
  const [index, setIndex] = useState<RecommendedIndex | null>(null);
  const [resolver, setResolver] = useState<NameResolver | null>(null);
  // 選定的武器種類（persist；空字串＝尚未選）。
  const [weaponType, setWeaponType] = useLocalStorage("mhsb.recoWeaponType", "");
  // 展開過的分區（全域記憶、不分武器；預設全收合）。存 category 值陣列。
  const [openStages, setOpenStages] = useLocalStorage<string[]>(
    "mhsb.recoStagesOpen",
    []
  );

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

  const isOpen = (cat: string) => openStages.includes(cat);
  const toggleStage = (cat: string) =>
    setOpenStages((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );

  const byCat = weaponType ? index?.byWeaponType.get(weaponType) : undefined;
  // 該武器實際有資料的分區（保 SECTION_ORDER 順序）。
  const sections = SECTION_ORDER.map((cat) => ({
    cat,
    builds: byCat?.get(cat) ?? [],
  })).filter((s) => s.builds.length > 0);

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
        ) : sections.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            此武器種類尚無推薦配裝資料。
          </p>
        ) : (
          <>
            {/* 分區手風琴 */}
            <div className="space-y-4">
              {sections.map(({ cat, builds }) => (
                <StageSection
                  key={cat}
                  title={CATEGORY_LABELS[cat]}
                  count={builds.length}
                  open={isOpen(cat)}
                  onToggle={() => toggleStage(cat)}
                  builds={builds}
                  resolver={resolver}
                  onExport={onExport}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
