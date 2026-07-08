"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { weaponTypes } from "@/lib/data";
import {
  TIER_MAX_RARITY,
  ARMOR_PART_LABELS,
  ARMOR_PARTS,
  type BuildPreset,
  type BuildResult,
  type BuildSearchRequest,
  type PlayerProgress,
  type PresetTier,
  type SkillMap,
} from "@/types/build";
import { loadGameData } from "@/lib/game-data";
import { searchBuilds, createSearchDeps } from "@/lib/build-search";
import {
  loadUnlocks,
  isCraftable,
  describeUnlock,
  kiranicoUrl,
  CONFIDENCE_LABELS,
  type UnlockData,
  type UnlockEntry,
} from "@/lib/unlocks";
import {
  tierForProgress,
  hasReachedMR,
  normalizeProgress,
  findTierPreset,
  nextTierPreset,
} from "@/lib/guide";
import { useLocalStorage } from "@/lib/use-local-storage";
import { WeaponIcon, ArmorIcon } from "@/components/EquipmentIcon";
import { RarityBadge } from "@/components/RarityBadge";
import { EmptyState } from "@/components/EmptyState";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Compass,
  Loader2,
  Check,
  X,
  ExternalLink,
  ArrowRight,
  Swords,
} from "lucide-react";
import { cn } from "@/lib/utils";

/** 引導頁固定不用護石／不保留洞位／無排除（新手不需要這些進階條件）。 */
const NO_RESERVED = { 4: 0, 3: 0, 2: 0, 1: 0 };
const NO_EXCLUDED = { armorIds: [] as string[], weaponIds: [] as string[] };

const DEFAULT_PROGRESS: PlayerProgress = {
  village: 0,
  hub: 0,
  mrChapter: 0,
  mrLevel: 0,
};

/** 目標配裝中的一件裝備 + 解放狀態。 */
type TargetPiece = {
  id: string;
  nameZh: string;
  partLabel: string;
  part?: string; // 防具部位（圖示用）；武器為 undefined
  weaponType?: string;
  rarity?: number;
  entry?: UnlockEntry;
  craftable: boolean;
};

type GuideResult = {
  tier: PresetTier;
  preset: BuildPreset;
  /** 以進度篩選後的當下最佳配裝（可能為 null＝連近似解都湊不出）。 */
  current: BuildResult | null;
  /** current 的逐件清單（含解放標註）。 */
  currentPieces: TargetPiece[];
  /** 必要技能在目前進度湊不滿、已降為偏好後的近似解。 */
  currentRelaxed: boolean;
  /** 下一階目標（畢業階段為 null）。 */
  next: {
    tier: PresetTier;
    preset: BuildPreset;
    build: BuildResult | null;
    pieces: TargetPiece[];
  } | null;
};

/** 從搜尋結果的第一名抽出「武器 + 5 部位」並標記解放狀態。 */
function extractPieces(
  build: BuildResult,
  unlocks: UnlockData,
  progress: PlayerProgress
): TargetPiece[] {
  const pieces: TargetPiece[] = [];
  if (build.weapon) {
    const entry = unlocks.entries[build.weapon.id];
    pieces.push({
      id: build.weapon.id,
      nameZh: build.weapon.nameZh,
      partLabel: "武器",
      weaponType: build.weapon.weaponType,
      rarity: build.weapon.rarity,
      entry,
      craftable: isCraftable(entry, progress),
    });
  }
  for (const part of ARMOR_PARTS) {
    const a = build.armor[part];
    const entry = unlocks.entries[a.id];
    pieces.push({
      id: a.id,
      nameZh: a.nameZh,
      partLabel: ARMOR_PART_LABELS[part],
      part,
      rarity: a.rarity,
      entry,
      craftable: isCraftable(entry, progress),
    });
  }
  return pieces;
}

/** 組出引導頁用的搜尋請求（省去主頁的進階條件）。 */
function guideRequest(
  weaponType: string,
  preset: BuildPreset,
  extra: Partial<BuildSearchRequest>
): BuildSearchRequest {
  return {
    weaponType,
    presetId: preset.id,
    weaponSearchMode: "search",
    autoRules: preset.autoRules,
    preferElement: preset.preferElement,
    charms: [],
    fixedParts: {},
    excludedItems: NO_EXCLUDED,
    requiredSkills: { ...preset.requiredSkills },
    excludedSkills: [...preset.excludedSkills],
    reservedSlots: NO_RESERVED,
    searchMode: "fast",
    resultLimit: 3,
    ...extra,
  };
}

/** 解放資訊徽章：條件描述 + 信心度。 */
function UnlockBadge({ entry }: { entry?: UnlockEntry }) {
  if (!entry) return null;
  return (
    <span className="inline-flex flex-wrap items-center gap-1 text-[11px] text-muted-foreground">
      {describeUnlock(entry)}
      <span
        className={cn(
          "rounded px-1 text-[10px] leading-[1.5]",
          entry.c === "confirmed" && "bg-emerald-500/15 text-emerald-400",
          entry.c === "inferred" && "bg-sky-500/15 text-sky-400",
          entry.c === "unverified" && "bg-amber-500/15 text-amber-400"
        )}
        title={
          entry.c === "inferred"
            ? "由任務出現星級推導，非官方逐件標註"
            : entry.c === "unverified"
              ? "以稀有度近似，尚未逐件驗證"
              : "已確認的遊戲常數"
        }
      >
        {CONFIDENCE_LABELS[entry.c]}
      </span>
    </span>
  );
}

/** 單件裝備列（現在最佳配裝 / 下一套目標共用）。 */
function PieceRow({
  piece,
  showCraftable,
}: {
  piece: TargetPiece;
  showCraftable?: boolean;
}) {
  const url = kiranicoUrl(piece.id);
  return (
    <div className="flex items-start gap-2 py-1.5">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center">
        {piece.part ? (
          <ArmorIcon part={piece.part} rarity={piece.rarity} className="h-6 w-6" />
        ) : piece.weaponType ? (
          <WeaponIcon type={piece.weaponType} className="h-6 w-6 text-muted-foreground" />
        ) : null}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] text-muted-foreground">{piece.partLabel}</span>
          <span className="text-sm font-medium">{piece.nameZh}</span>
          <RarityBadge rarity={piece.rarity} />
          {showCraftable &&
            (piece.craftable ? (
              <span className="inline-flex items-center gap-0.5 rounded bg-emerald-500/15 px-1 text-[10px] text-emerald-400">
                <Check className="h-3 w-3" />
                現在就能做
              </span>
            ) : (
              <span className="inline-flex items-center gap-0.5 rounded bg-rose-500/15 px-1 text-[10px] text-rose-400">
                <X className="h-3 w-3" />
                還做不了
              </span>
            ))}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-2">
          <UnlockBadge entry={piece.entry} />
          {!piece.craftable && piece.entry?.mon && (
            <span className="text-[11px] text-muted-foreground">
              要打：<span className="text-foreground">{piece.entry.mon}</span>
            </span>
          )}
          {url && (
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-0.5 text-[11px] text-sky-400 hover:underline"
            >
              素材細節
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

/** 技能摘要（等級遞減）。 */
function SkillList({ skills }: { skills: SkillMap }) {
  const entries = Object.entries(skills).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {entries.map(([name, lv]) => (
        <span
          key={name}
          className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground"
        >
          {name} <span className="font-mono text-foreground">Lv{lv}</span>
        </span>
      ))}
    </div>
  );
}

export default function GuidePage() {
  const supported = weaponTypes.filter((w) => w.supported);

  const [weaponType, setWeaponType] = useLocalStorage(
    "mhsb.guide.weaponType",
    "long-sword"
  );
  const [progress, setProgress] = useLocalStorage<PlayerProgress>(
    "mhsb.guide.progress",
    DEFAULT_PROGRESS
  );

  const [loading, setLoading] = useState(false);
  const [hasRun, setHasRun] = useState(false);
  const [result, setResult] = useState<GuideResult | null>(null);

  // 預先載入大型資料（進頁面就開始抓，按下按鈕時通常已就緒）
  useEffect(() => {
    loadGameData();
    loadUnlocks();
  }, []);

  const setAxis = (key: keyof PlayerProgress, value: number) =>
    setProgress((prev) => ({ ...prev, [key]: value }));

  const runGuide = async () => {
    setLoading(true);
    setHasRun(true);
    const [gd, unlocks] = await Promise.all([loadGameData(), loadUnlocks()]);
    const p = normalizeProgress(progress);
    const tier = tierForProgress(p);
    const preset = findTierPreset(weaponType, tier);
    if (!preset) {
      setResult(null);
      setLoading(false);
      return;
    }
    const deps = createSearchDeps(gd, [], unlocks.entries);

    // 讓 loading 狀態先繪製，再跑同步搜尋（沿用主頁做法）
    setTimeout(() => {
      // A. 現在最佳：以進度精確篩選；湊不滿必要技能時逐步放寬——
      //    從最後一項必要技能開始逐一移除重搜，直到有結果（最終會退到無必要技能）。
      let current: BuildResult | null = null;
      let currentRelaxed = false;
      const outA = searchBuilds(
        guideRequest(weaponType, preset, { progress: p }),
        deps
      );
      if (outA.results.length > 0) {
        current = outA.results[0];
      } else {
        const relaxedRequired = { ...preset.requiredSkills };
        const dropOrder = Object.keys(relaxedRequired).reverse();
        for (const skill of dropOrder) {
          delete relaxedRequired[skill];
          const outRelaxed = searchBuilds(
            guideRequest(weaponType, preset, {
              progress: p,
              requiredSkills: { ...relaxedRequired },
            }),
            deps
          );
          if (outRelaxed.results.length > 0) {
            current = outRelaxed.results[0];
            currentRelaxed = true;
            break;
          }
        }
      }

      // B. 下一套目標：下一階 preset 的標準搜尋（不限進度，沿用階段 rarity 上限），
      //    再逐件標記「現在能不能做」。還沒進 MR 的玩家，下一套＝本階（初心）
      //    的完整配裝——那是他進入破曉後的第一套目標，而非更遠的拓荒。
      let next: GuideResult["next"] = null;
      const nextInfo = !hasReachedMR(p)
        ? { tier, preset }
        : nextTierPreset(weaponType, tier);
      if (nextInfo) {
        const reqB = guideRequest(weaponType, nextInfo.preset, {
          maxRarity: TIER_MAX_RARITY[nextInfo.tier],
        });
        const outB = searchBuilds(reqB, deps);
        const build = outB.results[0] ?? null;
        next = {
          tier: nextInfo.tier,
          preset: nextInfo.preset,
          build,
          pieces: build ? extractPieces(build, unlocks, p) : [],
        };
      }

      setResult({
        tier,
        preset,
        current,
        currentPieces: current ? extractPieces(current, unlocks, p) : [],
        currentRelaxed,
        next,
      });
      setLoading(false);
    }, 30);
  };

  const preMR = !hasReachedMR(normalizeProgress(progress));

  return (
    <div className="min-h-screen bg-background">
      {/* ---- 頂部列（比照主頁樣式）---- */}
      <header className="flex flex-col gap-3 border-b border-border px-4 py-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15">
            <Compass className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-base font-bold leading-tight">
              新手引導：我現在做得出什麼？
            </h1>
            <p className="text-[11px] text-muted-foreground">
              輸入你的遊戲進度，直接看「現在的最佳配裝」和「下一套該做什麼」
            </p>
          </div>
        </div>
        <Link href="/">
          <Button variant="outline" size="sm" className="gap-1.5">
            <Swords className="h-4 w-4" />
            進階搜尋
          </Button>
        </Link>
      </header>

      <div className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-4">
        {/* ---- 進度輸入 ---- */}
        <Card>
          <CardContent className="flex flex-col gap-4 pt-5">
            <div>
              <Label className="text-sm">你玩哪把武器？</Label>
              <Select value={weaponType} onValueChange={setWeaponType}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {supported.map((w) => (
                    <SelectItem key={w.id} value={w.id}>
                      {w.nameZh}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <Label className="text-sm">村莊任務打到幾星？</Label>
                <Select
                  value={String(progress.village ?? 0)}
                  onValueChange={(v) => setAxis("village", Number(v))}
                >
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[0, 1, 2, 3, 4, 5, 6].map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {n === 0 ? "還沒開始" : `${n}★`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  單人劇情任務（跟村長接的那些）
                </p>
              </div>
              <div>
                <Label className="text-sm">集會所任務打到幾星？</Label>
                <Select
                  value={String(progress.hub ?? 0)}
                  onValueChange={(v) => setAxis("hub", Number(v))}
                >
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {n === 0 ? "還沒開始" : `${n}★${n >= 4 ? "（上位）" : ""}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  可連線的任務；4★ 起是「上位」（裝備和素材都升級）
                </p>
              </div>
              <div>
                <Label className="text-sm">破曉（MR）劇情到第幾章？</Label>
                <Select
                  value={String(progress.mrChapter ?? 0)}
                  onValueChange={(v) => setAxis("mrChapter", Number(v))}
                >
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[0, 1, 2, 3, 4, 5, 6].map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {n === 0 ? "還沒進入破曉" : `M${n}★`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  破曉資料片的大師位（MR）任務星級
                </p>
              </div>
              <div>
                <Label className="text-sm">MR 等級多少？</Label>
                <Input
                  type="number"
                  min={0}
                  className="mt-1.5"
                  value={progress.mrLevel ?? 0}
                  onChange={(e) =>
                    setAxis("mrLevel", Math.max(0, Number(e.target.value) || 0))
                  }
                />
                <p className="mt-1 text-[11px] text-muted-foreground">
                  打完破曉主線（M6★）後才會出現的數字等級；還沒通關就填 0
                </p>
              </div>
            </div>

            <Button
              size="lg"
              className="gap-2"
              onClick={runGuide}
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Compass className="h-4 w-4" />
              )}
              告訴我現在該穿什麼
            </Button>
          </CardContent>
        </Card>

        {/* ---- 結果 ---- */}
        {hasRun && !loading && result && (
          <>
            {/* 現在最佳配裝 */}
            <Card>
              <CardContent className="flex flex-col gap-3 pt-5">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-sm font-bold">你現在的最佳配裝</h2>
                  <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[11px] text-primary">
                    {result.tier}階段 · {result.preset.nameZh}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {result.preset.description}
                </p>
                {preMR && (
                  <p className="rounded bg-sky-500/10 px-2 py-1.5 text-[11px] text-sky-300">
                    你還沒進入破曉（MR），以下是用你目前進度做得出的裝備，朝「
                    {result.preset.nameZh}」的技能方向湊出的最佳解；進度推進後回來再按一次就會更新。
                  </p>
                )}
                {result.currentRelaxed && (
                  <p className="rounded bg-amber-500/10 px-2 py-1.5 text-[11px] text-amber-300">
                    你目前的進度還湊不滿這套流派的必要技能，以下是最接近的近似配裝。
                  </p>
                )}
                {result.current ? (
                  <>
                    <div className="divide-y divide-border/50">
                      {result.currentPieces.map((piece) => (
                        <PieceRow key={piece.id} piece={piece} />
                      ))}
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[11px] font-medium text-muted-foreground">
                        這套的技能（含建議鑲嵌的裝飾珠）
                      </span>
                      <SkillList skills={result.current.finalSkills} />
                      {result.current.decorations.length > 0 && (
                        <p className="text-[11px] text-muted-foreground">
                          裝飾珠：
                          {result.current.decorations
                            .map((d) => d.decorationName)
                            .join("、")}
                        </p>
                      )}
                      <p className="text-[11px] text-muted-foreground">
                        防具防禦合計 {result.current.totalDefense}
                        ・裝飾珠（技能珠）要在上位後才能鑲嵌與合成
                      </p>
                    </div>
                  </>
                ) : (
                  <EmptyState
                    title="目前進度湊不出完整配裝"
                    description={
                      "太早期的進度每個部位的候選還太少。先照主線推進一兩顆星，回來再試一次。"
                    }
                  />
                )}
              </CardContent>
            </Card>

            {/* 下一套目標 */}
            {result.next ? (
              <Card>
                <CardContent className="flex flex-col gap-3 pt-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-sm font-bold">下一套目標</h2>
                    <span className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                      {result.next.tier === result.tier ? "上位" : result.tier}
                      <ArrowRight className="h-3 w-3" />
                      {result.next.tier === result.tier
                        ? "破曉（MR）"
                        : result.next.tier}
                    </span>
                    <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[11px] text-primary">
                      {result.next.preset.nameZh}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {result.next.preset.description}
                  </p>
                  {result.next.tier === result.tier && (
                    <p className="rounded bg-sky-500/10 px-2 py-1.5 text-[11px] text-sky-300">
                      這是你進入破曉（MR）後的第一套目標——先推主線，裝備會跟著到位。
                    </p>
                  )}
                  {result.next.build ? (
                    <>
                      <p className="text-[11px] text-muted-foreground">
                        已可製作{" "}
                        <span className="font-mono text-foreground">
                          {result.next.pieces.filter((x) => x.craftable).length}/
                          {result.next.pieces.length}
                        </span>{" "}
                        件——紅色標記的裝備就是你接下來的狩獵目標：
                      </p>
                      <div className="divide-y divide-border/50">
                        {result.next.pieces.map((piece) => (
                          <PieceRow key={piece.id} piece={piece} showCraftable />
                        ))}
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <span className="text-[11px] font-medium text-muted-foreground">
                          做完這套會有的技能
                        </span>
                        <SkillList skills={result.next.build.finalSkills} />
                      </div>
                    </>
                  ) : (
                    <p className="text-[11px] text-muted-foreground">
                      下一階段的搜尋沒有結果（罕見）。可到進階搜尋手動調整條件。
                    </p>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="pt-5">
                  <p className="text-sm">
                    你已經在<span className="font-bold">畢業</span>
                    階段了——上面的就是終盤 meta 配裝。想微調流派（屬性、舒適、特殊套路），到
                    <Link href="/" className="mx-1 text-sky-400 hover:underline">
                      進階搜尋
                    </Link>
                    挑其他畢業 preset。
                  </p>
                </CardContent>
              </Card>
            )}

            <p className="text-center text-[11px] text-muted-foreground">
              解放條件多為任務星級推導（標「推導」）或稀有度近似（標「未驗證」），可能有誤——
              發現錯誤歡迎到 GitHub 回報。
            </p>
          </>
        )}
      </div>
    </div>
  );
}
