import type {
  RecommendedBuild,
  RecommendedBuildsFile,
  RecommendedCategory,
} from "@/types/recommended";
import { decorations } from "./data";
import { loadGameData } from "./game-data";

/**
 * 推薦配裝資料（data/recommended-builds.json，~2.4MB）的延遲載入與索引。
 *
 * 與 game-data.ts 同策略：動態 import 讓 webpack 拆成獨立 chunk（build 期打包、
 * 非 runtime 外部 fetch），不進首屏 bundle。名稱解析所需的防具/武器資料沿用
 * loadGameData()；珠子用 data.ts 的靜態 decorations。
 */

/** 階段分類的中文標籤。真相來源＝scripts/game8-sources.json 的 categories，
 * 該檔在 scripts/（唯讀、且含來源 URL），故此處僅複製顯示所需的 6 條標籤。 */
export const CATEGORY_LABELS: Record<RecommendedCategory, string> = {
  riseLow: "下位裝",
  riseHigh: "上位過渡裝",
  riseEndgame: "上位畢業裝（本篇）",
  mrEarly: "大師位拓荒裝",
  mrEndgame: "大師位畢業裝",
  weaponRecommend: "推薦武器一覽",
};

/** 分區顯示順序（下位 → 上位過渡 → 上位畢業 → 大師位拓荒 → 大師位畢業）。 */
export const STAGE_CATEGORY_ORDER: RecommendedCategory[] = [
  "riseLow",
  "riseHigh",
  "riseEndgame",
  "mrEarly",
  "mrEndgame",
];

export type RecommendedIndex = {
  /** weaponType → category → 該類配裝（保持原始順序）。 */
  byWeaponType: Map<string, Map<RecommendedCategory, RecommendedBuild[]>>;
};

let cache: RecommendedIndex | null = null;
let inflight: Promise<RecommendedIndex> | null = null;

function buildIndex(builds: RecommendedBuild[]): RecommendedIndex {
  const byWeaponType = new Map<
    string,
    Map<RecommendedCategory, RecommendedBuild[]>
  >();
  for (const b of builds) {
    let byCat = byWeaponType.get(b.weaponType);
    if (!byCat) {
      byCat = new Map();
      byWeaponType.set(b.weaponType, byCat);
    }
    const list = byCat.get(b.category);
    if (list) list.push(b);
    else byCat.set(b.category, [b]);
  }
  return { byWeaponType };
}

/** 載入並快取推薦配裝索引。重複呼叫共用同一個 in-flight promise。 */
export function loadRecommendedBuilds(): Promise<RecommendedIndex> {
  if (cache) return Promise.resolve(cache);
  if (!inflight) {
    inflight = import("../../data/recommended-builds.json").then((mod) => {
      const file = mod.default as unknown as RecommendedBuildsFile;
      cache = buildIndex(file.builds);
      return cache;
    });
  }
  return inflight;
}

/** 已載入時同步取得，否則 null。 */
export function getLoadedRecommendedBuilds(): RecommendedIndex | null {
  return cache;
}

/** deco id → 中文名稱（含手工合成 deco_manual_*）。 */
const decoNameById: Record<string, string> = Object.fromEntries(
  decorations.map((d) => [d.id, d.nameZh])
);

/**
 * 名稱解析：以載入後的 gameData 建立 armor/weapon 中文名對照。
 * 珠子用靜態表。回傳 { name, resolved }：resolved=false 代表對應不到內部資料，
 * 顯示端應以 rawNameJa fallback 並加警告樣式。
 */
export type ResolvedName = { name: string; resolved: boolean };

export type NameResolver = {
  armor: (id?: string, rawNameJa?: string) => ResolvedName;
  weapon: (id?: string, rawNameJa?: string) => ResolvedName;
  deco: (id?: string, rawNameJa?: string) => ResolvedName;
};

function fallback(rawNameJa?: string): ResolvedName {
  return { name: rawNameJa || "（未知）", resolved: false };
}

/** 建立名稱解析器（需先 loadGameData()）。 */
export async function createNameResolver(): Promise<NameResolver> {
  const gd = await loadGameData();
  return {
    armor: (id, rawNameJa) => {
      const a = id ? gd.armorById[id] : undefined;
      return a ? { name: a.nameZh, resolved: true } : fallback(rawNameJa);
    },
    weapon: (id, rawNameJa) => {
      const w = id ? gd.weaponById[id] : undefined;
      return w ? { name: w.nameZh, resolved: true } : fallback(rawNameJa);
    },
    deco: (id, rawNameJa) => {
      const name = id ? decoNameById[id] : undefined;
      return name ? { name, resolved: true } : fallback(rawNameJa);
    },
  };
}
