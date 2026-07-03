"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type {
  ArmorPart,
  ArmorPiece,
  BuildResult,
  BuildSearchRequest,
  Charm,
  FixedParts,
  ExcludedItems,
  ReservedSlots,
  SearchMode,
  SkillMap,
  Weapon,
  WeaponSearchMode,
} from "@/types/build";
import {
  buildPresets,
  weaponTypes,
  skills as allSkills,
  getPreset,
  presetsForWeapon,
} from "@/lib/data";
import { loadGameData, type GameData } from "@/lib/game-data";
import { searchBuilds, createSearchDeps, type SearchMeta } from "@/lib/build-search";
import { parseSlotString } from "@/lib/slot-utils";
import { useLocalStorage } from "@/lib/use-local-storage";
import {
  mergeMaxSkills,
  resolveAutoSkills,
  resolvePresetSkills,
} from "@/lib/preset-resolver";

import { WeaponSelector } from "@/components/WeaponSelector";
import { WeaponPicker } from "@/components/WeaponPicker";
import { BuildPresetSelector } from "@/components/BuildPresetSelector";
import { SearchModeSelector } from "@/components/SearchModeSelector";
import { SkillRequirementEditor } from "@/components/SkillRequirementEditor";
import { CharmInput, type CharmRow } from "@/components/CharmInput";
import { ReservedSlotsInput } from "@/components/ReservedSlotsInput";
import { FixedPartsPanel } from "@/components/FixedPartsPanel";
import { AugmentedArmorEditor } from "@/components/AugmentedArmorEditor";
import { BuildResultCard } from "@/components/BuildResultCard";
import { EmptyState } from "@/components/EmptyState";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Search,
  Swords,
  Loader2,
  Check,
  AlertTriangle,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

const EMPTY_CHARM_ROWS: CharmRow[] = [
  { name: "", level: 1 },
  { name: "", level: 1 },
  { name: "", level: 1 },
];

const clone = (m: SkillMap): SkillMap => ({ ...m });

export default function Home() {
  const firstPreset = presetsForWeapon("long-sword")[0] ?? buildPresets[0];

  // ---- 延遲載入的防具 / 武器資料（不進首屏 bundle）----
  const [gameData, setGameData] = useState<GameData | null>(null);
  useEffect(() => {
    let alive = true;
    loadGameData().then((gd) => {
      if (alive) setGameData(gd);
    });
    return () => {
      alive = false;
    };
  }, []);

  // ---- 基礎設定（persist 到 localStorage）----
  const [weaponType, setWeaponType] = useLocalStorage("mhsb.weaponType", "long-sword");
  const [presetId, setPresetId] = useLocalStorage("mhsb.presetId", firstPreset.id);
  const [searchMode, setSearchMode] = useLocalStorage<SearchMode>("mhsb.searchMode", "fast");

  // ---- 武器設定 ----
  const [weaponSearchMode, setWeaponSearchMode] = useLocalStorage<WeaponSearchMode>(
    "mhsb.weaponSearchMode",
    "search"
  );
  // 固定武器 id，"" 表示未選（localStorage 不便存 undefined）。
  const [fixedWeaponId, setFixedWeaponId] = useLocalStorage("mhsb.fixedWeaponId", "");
  /** 目前套用在技能編輯器中的自動技能（依 preset autoRules 與固定武器屬性）。 */
  const [autoSkills, setAutoSkills] = useLocalStorage<SkillMap>("mhsb.autoSkills", {});

  // ---- 技能條件（由 preset 帶入，可編輯）----
  const [required, setRequired] = useLocalStorage<SkillMap>("mhsb.required", clone(firstPreset.requiredSkills));
  const [preferred, setPreferred] = useLocalStorage<SkillMap>("mhsb.preferred", clone(firstPreset.preferredSkills));
  const [avoid, setAvoid] = useLocalStorage<SkillMap>("mhsb.avoid", clone(firstPreset.avoidSkills));
  const [weights, setWeights] = useLocalStorage<SkillMap>("mhsb.weights", clone(firstPreset.skillWeights));

  // ---- 護石 / 保留洞位 ----
  const [charmRows, setCharmRows] = useLocalStorage<CharmRow[]>("mhsb.charmRows", EMPTY_CHARM_ROWS);
  const [charmSlotsStr, setCharmSlotsStr] = useLocalStorage("mhsb.charmSlots", "2-1-0");
  const [reservedSlots, setReservedSlots] = useLocalStorage<ReservedSlots>("mhsb.reserved", {
    4: 0,
    3: 0,
    2: 0,
    1: 0,
  });

  // ---- 固定 / 排除 / 鍊成 ----
  const [fixedParts, setFixedParts] = useLocalStorage<FixedParts>("mhsb.fixedParts", {});
  const [excludedItems, setExcludedItems] = useLocalStorage<ExcludedItems>("mhsb.excluded", {
    armorIds: [],
    weaponIds: [],
  });
  const [augments, setAugments] = useLocalStorage<ArmorPiece[]>("mhsb.augments", []);

  // ---- 結果（不 persist）----
  const [results, setResults] = useState<BuildResult[]>([]);
  const [meta, setMeta] = useState<SearchMeta | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [resultLimit, setResultLimit] = useLocalStorage("mhsb.resultLimit", 100);

  // 收藏 / 比較（存為陣列以利序列化）
  const [favorites, setFavorites] = useLocalStorage<string[]>("mhsb.favorites", []);
  const [compared, setCompared] = useLocalStorage<string[]>("mhsb.compared", []);
  const [toast, setToast] = useState<string | null>(null);

  // 手機版：搜尋條件面板是否展開（桌機恆顯示，此狀態只影響 <lg）。
  const [conditionsOpen, setConditionsOpen] = useState(true);
  const toggleRef = useRef<HTMLButtonElement>(null);

  const presets = useMemo(() => presetsForWeapon(weaponType), [weaponType]);
  const weaponById = gameData?.weaponById ?? {};
  const allArmors = gameData?.armors ?? [];
  const typeWeapons = useMemo(
    () => (gameData ? gameData.weapons.filter((w) => w.weaponType === weaponType) : []),
    [gameData, weaponType]
  );
  const currentPreset = getPreset(presetId);
  const pickedWeapon: Weapon | undefined =
    weaponSearchMode === "fixed" && fixedWeaponId
      ? weaponById[fixedWeaponId]
      : undefined;

  // 合併鍊成防具的 armorById（供固定面板顯示名稱）
  const armorById = useMemo(() => {
    const m: Record<string, ArmorPiece> = { ...(gameData?.armorById ?? {}) };
    for (const a of augments) m[a.id] = a;
    return m;
  }, [gameData, augments]);

  /** 以 preset（+ 目前固定武器）重設技能編輯器。 */
  const applyPreset = (id: string, weapon?: Weapon) => {
    setPresetId(id);
    const p = getPreset(id);
    if (!p) return;
    const resolved = resolvePresetSkills(p, weapon);
    setRequired(resolved.requiredSkills);
    setPreferred(resolved.preferredSkills);
    setAvoid(resolved.avoidSkills);
    setWeights(resolved.skillWeights);
    setAutoSkills(resolved.autoAddedSkills);
  };

  /**
   * 武器（或模式）變更時，只重算自動技能：
   * 移除舊自動技能（若使用者未改動其等級），併入新武器對應的自動技能，保留其他手動編輯。
   */
  const reapplyAutoSkills = (weapon: Weapon | undefined) => {
    const p = getPreset(presetId);
    const newAuto = resolveAutoSkills(p?.autoRules, weapon);
    setRequired((prev) => {
      const next = { ...prev };
      for (const [k, v] of Object.entries(autoSkills)) {
        if (next[k] === v) delete next[k];
      }
      return mergeMaxSkills(next, newAuto);
    });
    setAutoSkills(newAuto);
  };

  const changeWeapon = (w: string) => {
    setWeaponType(w);
    setFixedWeaponId("");
    setFixedParts((prev) => {
      const next = { ...prev };
      delete next.weapon;
      return next;
    });
    const first = presetsForWeapon(w)[0];
    if (first) applyPreset(first.id, undefined);
  };

  const changeWeaponSearchMode = (m: WeaponSearchMode) => {
    setWeaponSearchMode(m);
    if (m === "search") {
      setFixedParts((prev) => {
        const next = { ...prev };
        delete next.weapon;
        return next;
      });
      reapplyAutoSkills(undefined);
    } else {
      const w = fixedWeaponId ? weaponById[fixedWeaponId] : undefined;
      if (w) {
        setFixedParts((prev) => ({ ...prev, weapon: w.id }));
      }
      reapplyAutoSkills(w);
    }
  };

  const pickWeapon = (id: string) => {
    setFixedWeaponId(id);
    setFixedParts((prev) => ({ ...prev, weapon: id }));
    reapplyAutoSkills(weaponById[id]);
  };

  const buildCharm = (): Charm => {
    const skillMap: SkillMap = {};
    for (const r of charmRows) {
      if (r.name) skillMap[r.name] = (skillMap[r.name] ?? 0) + r.level;
    }
    return { skills: skillMap, slots: parseSlotString(charmSlotsStr) };
  };

  const runSearch = async () => {
    setLoading(true);
    setHasSearched(true);
    // 確保防具/武器資料已載入（第一次搜尋可能還在載）
    const gd = gameData ?? (await loadGameData());
    if (!gameData) setGameData(gd);
    const request: BuildSearchRequest = {
      weaponType,
      presetId,
      weaponSearchMode,
      fixedWeaponId:
        weaponSearchMode === "fixed" ? fixedWeaponId || undefined : undefined,
      // fixed 模式的自動技能已在編輯器中；search 模式由搜尋引擎逐武器套用
      autoRules:
        weaponSearchMode === "search" ? currentPreset?.autoRules : undefined,
      charm: buildCharm(),
      fixedParts,
      excludedItems,
      requiredSkills: required,
      preferredSkills: preferred,
      avoidSkills: avoid,
      skillWeights: weights,
      reservedSlots,
      searchMode,
      resultLimit,
    };
    const deps = createSearchDeps(gd, augments);
    // 讓 UI 先繪製 loading 狀態，再執行同步搜尋
    setTimeout(() => {
      const out = searchBuilds(request, deps, () =>
        typeof performance !== "undefined" ? performance.now() : 0
      );
      setResults(out.results);
      setMeta(out.meta);
      setLoading(false);
      // 手機版：搜尋後自動收合條件並跳到結果（桌機恆顯示，收合僅影響視覺）。
      // 延遲捲動，等收合的版面重排完成後再對齊到（sticky 的）條件收合列。
      if (typeof window !== "undefined" && window.innerWidth < 1024) {
        setConditionsOpen(false);
        setTimeout(
          () =>
            toggleRef.current?.scrollIntoView({
              behavior: "smooth",
              block: "start",
            }),
          140
        );
      }
    }, 20);
  };

  // ---- 結果卡片操作 ----
  const fixArmor = (part: ArmorPart, id: string) =>
    setFixedParts((prev) => ({ ...prev, [part]: id }));

  const excludeArmor = (id: string) => {
    setExcludedItems((prev) =>
      prev.armorIds.includes(id)
        ? prev
        : { ...prev, armorIds: [...prev.armorIds, id] }
    );
    // 若該裝備正被固定，一併解除
    setFixedParts((prev) => {
      const next = { ...prev };
      for (const k of ["head", "chest", "arms", "waist", "legs"] as ArmorPart[]) {
        if (next[k] === id) delete next[k];
      }
      return next;
    });
  };

  const clearFixed = (key: ArmorPart | "weapon" | "charm") => {
    setFixedParts((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    if (key === "weapon") {
      setFixedWeaponId("");
      setWeaponSearchMode("search");
      reapplyAutoSkills(undefined);
    }
  };

  // ---- 武器固定 / 排除（結果卡片操作）----
  const fixWeapon = (id: string) => {
    setWeaponSearchMode("fixed");
    setFixedWeaponId(id);
    setFixedParts((prev) => ({ ...prev, weapon: id }));
    reapplyAutoSkills(weaponById[id]);
  };

  const excludeWeapon = (id: string) => {
    setExcludedItems((prev) =>
      prev.weaponIds.includes(id)
        ? prev
        : { ...prev, weaponIds: [...prev.weaponIds, id] }
    );
    if (fixedWeaponId === id) {
      clearFixed("weapon");
    }
  };

  const removeExcluded = (id: string) =>
    setExcludedItems((prev) => ({
      armorIds: prev.armorIds.filter((x) => x !== id),
      weaponIds: prev.weaponIds.filter((x) => x !== id),
    }));

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 1800);
  };

  const copySummary = async (summary: string) => {
    try {
      await navigator.clipboard.writeText(summary);
      showToast("已複製配裝摘要");
    } catch {
      showToast("複製失敗，請手動選取");
    }
  };

  const toggleInList = (
    setter: React.Dispatch<React.SetStateAction<string[]>>,
    id: string
  ) =>
    setter((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );

  // 自動技能提示（WeaponPicker 顯示）
  const autoHint = (() => {
    if (!currentPreset?.autoRules?.addElementAttackSkill) return null;
    if (weaponSearchMode === "fixed") {
      const entries = Object.entries(autoSkills);
      if (entries.length === 0) return null;
      return `已根據目前武器屬性自動加入：${entries
        .map(([n, l]) => `${n} Lv${l}`)
        .join("、")}`;
    }
    return "搜尋時將依各候選武器屬性自動加入對應的屬性攻擊強化。";
  })();

  return (
    <div className="flex min-h-screen flex-col bg-background lg:h-screen">
      {/* ---- 頂部列 ---- */}
      <header className="flex shrink-0 flex-col gap-3 border-b border-border px-4 py-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15">
            <Swords className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-base font-bold leading-tight">
              魔物獵人 Rise：破曉配裝搜尋器
            </h1>
            <p className="text-[11px] text-muted-foreground">
              選擇武器、技能條件與固定部位，搜尋符合條件的前 100 套配裝
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-[260px]">
            <SearchModeSelector value={searchMode} onChange={setSearchMode} />
          </div>
          <Button
            size="lg"
            onClick={runSearch}
            disabled={loading || Object.keys(required).length === 0}
            className="gap-2"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
            {!gameData && !loading ? "資料載入中…" : "搜尋配裝"}
          </Button>
        </div>
      </header>

      {/* ---- 手機版：搜尋條件收合列（sticky，桌機隱藏）---- */}
      <button
        ref={toggleRef}
        type="button"
        onClick={() => setConditionsOpen((o) => !o)}
        className="sticky top-0 z-20 flex shrink-0 items-center justify-between border-b border-border bg-background px-4 py-2.5 text-sm font-medium lg:hidden"
      >
        <span className="flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-primary" />
          搜尋條件
        </span>
        {conditionsOpen ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            展開修改
            <ChevronDown className="h-4 w-4" />
          </span>
        )}
      </button>

      {/* ---- 主體：左右雙欄（桌機固定分欄捲動；手機正常堆疊捲動）---- */}
      <div className="flex flex-1 flex-col lg:min-h-0 lg:flex-row">
        {/* 左側控制欄（手機可收合，桌機恆顯示）*/}
        <aside
          className={`${
            conditionsOpen ? "flex" : "hidden"
          } w-full flex-col gap-3 border-b border-border p-3 scrollbar-thin lg:flex lg:w-[400px] lg:shrink-0 lg:overflow-y-auto lg:border-b-0 lg:border-r`}
        >
          <Card>
            <CardContent className="space-y-3 p-3">
              <WeaponSelector
                weaponTypes={weaponTypes}
                value={weaponType}
                onChange={changeWeapon}
              />
              <WeaponPicker
                weapons={typeWeapons}
                loading={!gameData}
                mode={weaponSearchMode}
                onModeChange={changeWeaponSearchMode}
                fixedWeaponId={fixedWeaponId}
                onPickWeapon={pickWeapon}
                autoHint={autoHint}
              />
              <BuildPresetSelector
                presets={presets}
                value={presetId}
                onChange={(id) => applyPreset(id, pickedWeapon)}
              />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-3">
              <Tabs defaultValue="skills">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="skills">技能</TabsTrigger>
                  <TabsTrigger value="gear">裝備</TabsTrigger>
                  <TabsTrigger value="locks">鎖定</TabsTrigger>
                </TabsList>

                <TabsContent value="skills" className="pt-2">
                  <SkillRequirementEditor
                    required={required}
                    preferred={preferred}
                    avoid={avoid}
                    onChangeRequired={setRequired}
                    onChangePreferred={setPreferred}
                    onChangeAvoid={setAvoid}
                    allSkills={allSkills}
                  />
                </TabsContent>

                <TabsContent value="gear" className="space-y-4 pt-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">
                      護石
                    </Label>
                    <CharmInput
                      rows={charmRows}
                      slotsStr={charmSlotsStr}
                      onChangeRows={setCharmRows}
                      onChangeSlots={setCharmSlotsStr}
                      allSkills={allSkills}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">
                      保留洞位
                    </Label>
                    <ReservedSlotsInput
                      value={reservedSlots}
                      onChange={setReservedSlots}
                    />
                  </div>
                </TabsContent>

                <TabsContent value="locks" className="space-y-4 pt-2">
                  <FixedPartsPanel
                    fixedParts={fixedParts}
                    excludedItems={excludedItems}
                    armorById={armorById}
                    weaponById={weaponById}
                    onClearFixed={clearFixed}
                    onRemoveExcluded={removeExcluded}
                  />
                  <div className="space-y-1.5 border-t border-border pt-3">
                    <Label className="text-xs text-muted-foreground">
                      傀異鍊成（自訂防具）
                    </Label>
                    <AugmentedArmorEditor
                      allArmors={allArmors}
                      allSkills={allSkills}
                      augments={augments}
                      onAdd={(p) => setAugments((prev) => [...prev, p])}
                      onRemove={(id) =>
                        setAugments((prev) => prev.filter((a) => a.id !== id))
                      }
                    />
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </aside>

        {/* 右側結果 */}
        <main className="flex flex-1 flex-col lg:min-h-0">
          {/* 結果工具列 */}
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2">
            <div className="flex items-center gap-2 text-sm">
              <span className="font-medium">搜尋結果</span>
              {meta && (
                <span className="text-xs text-muted-foreground">
                  顯示前 {results.length} 套 · 有效組合 {meta.validBuilds} ·
                  評估 {meta.combosEvaluated} 組 · {Math.round(meta.elapsedMs)}ms
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {(favorites.length > 0 || compared.length > 0) && (
                <span className="text-xs text-muted-foreground">
                  收藏 {favorites.length} · 比較 {compared.length}
                </span>
              )}
              <Label className="text-[11px] text-muted-foreground">
                顯示上限
              </Label>
              <Input
                type="number"
                min={1}
                max={100}
                value={resultLimit}
                onChange={(e) =>
                  setResultLimit(
                    Math.max(1, Math.min(100, Number(e.target.value) || 1))
                  )
                }
                className="h-7 w-16 font-mono"
              />
            </div>
          </div>

          {/* 結果列表 */}
          <div className="flex-1 p-4 scrollbar-thin lg:min-h-0 lg:overflow-y-auto">
            {searchMode === "exact" && !loading && (
              <div className="mb-3 flex items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
                <AlertTriangle className="h-3.5 w-3.5" />
                完整搜尋會枚舉所有裝備，組合數量大時可能較慢。
              </div>
            )}
            {searchMode === "greedy" && !loading && (
              <div className="mb-3 flex items-center gap-2 rounded-md border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-xs text-sky-300">
                <AlertTriangle className="h-3.5 w-3.5" />
                推薦模式速度最快，優先補足必要技能，但結果可能不是最佳解。
              </div>
            )}

            {loading ? (
              <div className="flex flex-col items-center justify-center gap-3 py-24 text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm">搜尋配裝中…</p>
              </div>
            ) : !hasSearched ? (
              <EmptyState
                icon="swords"
                title="尚未搜尋配裝"
                description={`你可以先完成：
1. 選擇武器與流派（會自動帶入技能需求）
2. 調整必要技能、偏好技能與排除技能
3. 輸入護石與武器洞數
4. 視需要固定部位或排除裝備
5. 按下搜尋配裝

搜尋後會顯示前 100 套符合硬條件的配裝。`}
              />
            ) : results.length === 0 ? (
              <EmptyState
                title="找不到符合條件的配裝"
                description="試著放寬必要技能、減少保留洞位，或解除部分固定／排除設定。"
              />
            ) : (
              <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                {results.map((r, i) => (
                  <BuildResultCard
                    key={r.id}
                    result={r}
                    rank={i + 1}
                    weaponSlotsLabel="—"
                    requiredSkills={required}
                    preferredSkills={preferred}
                    avoidSkills={avoid}
                    reservedSlots={reservedSlots}
                    fixedParts={fixedParts}
                    isFavorite={favorites.includes(r.id)}
                    isCompared={compared.includes(r.id)}
                    onFixArmor={fixArmor}
                    onExcludeArmor={excludeArmor}
                    onFixWeapon={fixWeapon}
                    onExcludeWeapon={excludeWeapon}
                    onCopy={copySummary}
                    onToggleFavorite={(id) => toggleInList(setFavorites, id)}
                    onToggleCompare={(id) => toggleInList(setCompared, id)}
                  />
                ))}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm shadow-lg">
          <Check className="h-4 w-4 text-emerald-400" />
          {toast}
        </div>
      )}
    </div>
  );
}
