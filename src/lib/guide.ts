import type { BuildPreset, PlayerProgress, PresetTier } from "@/types/build";
import { PRESET_TIER_ORDER } from "@/types/build";
import { presetsForWeapon } from "./data";

/**
 * 引導模式的純邏輯：進度 → preset 階段、同流派 preset 鏈的上下階解析。
 *
 * preset id 慣例（見 buildPresets.json）：`{武器縮寫}-{階段 slug}[-流派]`，
 * 例：ls-initiate → ls-pioneer → ls-advanced → ls-endgame（泛用鏈）、
 * ls-initiate-element → …（屬性鏈）。引導模式第一版走泛用鏈。
 */

const TIER_SLUG: Record<PresetTier, string> = {
  初心: "initiate",
  拓荒: "pioneer",
  進階: "advanced",
  畢業: "endgame",
};

/**
 * 玩家進度 → 對應的 preset 階段。
 * 階段語意（見 preset 描述）：初心＝剛進 MR（M1~2）、拓荒＝MR 中期（M3~5）、
 * 進階＝通關（M6）後、畢業＝MR100 起的終盤 meta。
 * 尚未進 MR 的玩家也回傳「初心」——以初心流派的技能方向搭配進度篩選，
 * 給出當下湊得出的最佳近似（引導頁會標註）。
 */
export function tierForProgress(p: PlayerProgress): PresetTier {
  const chapter = p.mrChapter ?? 0;
  const level = p.mrLevel ?? 0;
  if (level >= 100) return "畢業";
  if (chapter >= 6) return "進階";
  if (chapter >= 3) return "拓荒";
  return "初心";
}

/** 玩家是否已進入 MR（決定引導頁是否顯示「HR 過渡」註記）。 */
export function hasReachedMR(p: PlayerProgress): boolean {
  return (p.mrChapter ?? 0) >= 1;
}

/**
 * 進度正規化：補上遊戲流程蘊含的前置進度，讓新手少填幾格也算得對。
 * - 有 MR 等級（通關後才有）→ MR 劇情視為第 6 章完成
 * - 已進 MR（需通關集會所 7★，且 8★ 於擊破雷神龍後即開放）→ 集會所視為 8★
 */
export function normalizeProgress(p: PlayerProgress): PlayerProgress {
  const mrLevel = p.mrLevel ?? 0;
  const mrChapter = mrLevel > 0 ? 6 : (p.mrChapter ?? 0);
  const hub = mrChapter >= 1 ? Math.max(p.hub ?? 0, 8) : (p.hub ?? 0);
  return { village: p.village ?? 0, hub, mrChapter, mrLevel };
}

/** 取某武器在指定階段的泛用鏈 preset（id 以 `-{slug}` 結尾者）。 */
export function findTierPreset(
  weaponType: string,
  tier: PresetTier
): BuildPreset | undefined {
  const suffix = `-${TIER_SLUG[tier]}`;
  return presetsForWeapon(weaponType).find((p) => p.id.endsWith(suffix));
}

/** 同流派（泛用鏈）的下一階 preset；已是畢業則回傳 undefined。 */
export function nextTierPreset(
  weaponType: string,
  tier: PresetTier
): { tier: PresetTier; preset: BuildPreset } | undefined {
  const idx = PRESET_TIER_ORDER.indexOf(tier);
  if (idx < 0 || idx >= PRESET_TIER_ORDER.length - 1) return undefined;
  const next = PRESET_TIER_ORDER[idx + 1];
  const preset = findTierPreset(weaponType, next);
  return preset ? { tier: next, preset } : undefined;
}
