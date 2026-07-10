import type { ArmorPart, SkillMap } from "@/types/build";
import type { CommunityBuild, CommunityTalisman } from "@/types/community";
import type { BuilderImport } from "./builder-import";
import type { OwnedCharm } from "./search-conditions";
import { decorations, skillMax, SPECIAL_SKILLS } from "./data";
import { loadGameData } from "./game-data";
import { normalizeSlots } from "./slot-utils";
import jpNameMapData from "../../data/jp-name-map.json";
import cnNameMapData from "../../data/cn-name-map.json";
import cnNameOverridesData from "../../data/cn-name-overrides.json";

/**
 * 社群配裝（data/community-builds/cb_*.json）的延遲載入、名稱解析與索引。
 *
 * 名稱解析序與 scripts/validate-community-builds.mjs 同：專案 id 直命 → 繁中直比
 * （armors/weapons/decorations 比 nameZh、skills 比 name）→ 日文過 jp-name-map →
 * 簡中過 cn-name-overrides（優先）＋ cn-name-map；命中後對映射值再解析一次。
 * 兩側 NFKC 正規化（全形羅馬數字 Ⅱ→II 等）。armor/weapon 用 loadGameData()（已拆
 * 獨立 chunk、不進首屏）；珠子/技能用靜態表。
 */

type ResolveType =
  | "skills"
  | "armors"
  | "weapons"
  | "decorations";

const nfkc = (s: string) => s.normalize("NFKC").trim();

const jpMap = jpNameMapData as unknown as Record<
  string,
  Record<string, string>
>;
const cnMap = cnNameMapData as unknown as Record<string, Record<string, string>>;
const cnOverrides = cnNameOverridesData as unknown as Record<
  string,
  Record<string, string>
>;

/** NFKC(名稱鍵) → 專案標準身分（skills=技能名、其餘=id）。id 與繁中名皆入鍵。 */
type Index = { map: Map<string, string>; };

function buildIndex(pairs: [id: string, zh: string | null][]): Index {
  const map = new Map<string, string>();
  for (const [id, zh] of pairs) {
    map.set(nfkc(id), id);
    if (zh != null) map.set(nfkc(zh), id);
  }
  return { map };
}

// 珠子／技能靜態即可建索引；armor/weapon 待 loadGameData。
const staticIndex: Record<"skills" | "decorations", Index> = {
  skills: buildIndex(Object.keys(skillMax).map((n) => [n, null])),
  decorations: buildIndex(decorations.map((d) => [d.id, d.nameZh])),
};

export type CommunityResolver = {
  resolve: (type: ResolveType, name: string) => string | null;
  /** 專案 id → 顯示繁中名（armor/weapon/deco/skill）。 */
  displayName: (type: ResolveType, id: string) => string;
};

async function createResolver(): Promise<CommunityResolver> {
  const gd = await loadGameData();
  const index: Record<ResolveType, Index> = {
    skills: staticIndex.skills,
    decorations: staticIndex.decorations,
    armors: buildIndex(gd.armors.map((a) => [a.id, a.nameZh])),
    weapons: buildIndex(gd.weapons.map((w) => [w.id, w.nameZh])),
  };
  const canonicalize = (type: ResolveType, v: string): string | null =>
    index[type].map.get(nfkc(v)) ?? null;
  const resolve = (type: ResolveType, name: string): string | null => {
    const raw = nfkc(name);
    const direct = canonicalize(type, raw);
    if (direct) return direct;
    const jp = jpMap[type]?.[raw];
    if (jp != null) return canonicalize(type, jp);
    const cnO = cnOverrides[type]?.[raw];
    if (cnO != null) return canonicalize(type, cnO);
    const cn = cnMap[type]?.[raw];
    if (cn != null) return canonicalize(type, cn);
    return null;
  };
  const decoNameById: Record<string, string> = Object.fromEntries(
    decorations.map((d) => [d.id, d.nameZh])
  );
  const displayName = (type: ResolveType, id: string): string => {
    switch (type) {
      case "skills":
        return id; // 技能 id 即繁中名
      case "armors":
        return gd.armorById[id]?.nameZh ?? id;
      case "weapons":
        return gd.weaponById[id]?.nameZh ?? id;
      case "decorations":
        return decoNameById[id] ?? id;
    }
  };
  return { resolve, displayName };
}

// ---------- 解析後的顯示模型 ----------
export type ResolvedName = { raw: string; id?: string; name: string; resolved: boolean };
export type ResolvedDeco = ResolvedName & { count?: number };

export type ResolvedArmorPiece = {
  slot: ArmorPart;
  armor: ResolvedName;
  decorations: ResolvedDeco[];
  augment?: string;
};

export type ResolvedCommunityBuild = {
  raw: CommunityBuild;
  armor: ResolvedArmorPiece[];
  weapon?: { armor: ResolvedName; slots?: number[]; decorations: ResolvedDeco[]; rampageRaw: string[] };
  targetSkills: (ResolvedName & { level: number })[];
  talisman?: { skills: (ResolvedName & { level: number })[]; slots?: number[]; decorations: ResolvedDeco[] };
  /** 有無任何細節（護石／任一部位珠／武器珠）——無＝純骨架，UI 顯示「以你的護石計算」提示。 */
  hasDetails: boolean;
};

export type CommunityIndex = {
  /** weaponType → 該武器種類的社群配裝。 */
  byWeaponType: Map<string, ResolvedCommunityBuild[]>;
  /** 無 weaponType 的泛用防具骨架（對所有武器種類皆適用）。 */
  unbound: ResolvedCommunityBuild[];
  /** 全部（含 unbound），供計數。 */
  all: ResolvedCommunityBuild[];
};

function resolveNameRef(
  r: CommunityResolver,
  type: ResolveType,
  raw: string
): ResolvedName {
  const id = r.resolve(type, raw) ?? undefined;
  return { raw, id, name: id ? r.displayName(type, id) : raw, resolved: !!id };
}

function resolveBuild(
  r: CommunityResolver,
  raw: CommunityBuild
): ResolvedCommunityBuild {
  const armor: ResolvedArmorPiece[] = (raw.armor ?? []).map((p) => ({
    slot: p.slot as ArmorPart,
    armor: resolveNameRef(r, "armors", p.name),
    decorations: (p.decorations ?? []).map((d) => ({
      ...resolveNameRef(r, "decorations", d.name),
      count: d.count,
    })),
    augment: p.augment,
  }));
  const weapon = raw.weapon
    ? {
        armor: resolveNameRef(r, "weapons", raw.weapon.name),
        slots: raw.weapon.slots,
        decorations: (raw.weapon.decorations ?? []).map((d) => ({
          ...resolveNameRef(r, "decorations", d.name),
          count: d.count,
        })),
        rampageRaw: (raw.weapon.rampageDecorations ?? []).map((d) => d.name),
      }
    : undefined;
  const talisman = raw.talisman
    ? {
        skills: (raw.talisman.skills ?? []).map((s) => ({
          ...resolveNameRef(r, "skills", s.name),
          level: s.level,
        })),
        slots: raw.talisman.slots,
        decorations: (raw.talisman.decorations ?? []).map((d) => ({
          ...resolveNameRef(r, "decorations", d.name),
          count: d.count,
        })),
      }
    : undefined;
  const targetSkills = (raw.targetSkills ?? []).map((s) => ({
    ...resolveNameRef(r, "skills", s.name),
    level: s.level,
  }));
  const hasDetails =
    !!talisman ||
    !!weapon?.decorations.length ||
    armor.some((p) => p.decorations.length > 0);
  return { raw, armor, weapon, targetSkills, talisman, hasDetails };
}

// require.context：build 期打包所有 cb_*.json（新增檔自動納入，無需維護清單）。
function loadRawBuilds(): CommunityBuild[] {
  // @ts-expect-error webpack require.context（非標準 Node API，Next/webpack 提供）。
  const ctx = require.context("../../data/community-builds", false, /cb_.*\.json$/);
  return ctx.keys().map((k: string) => ctx(k) as CommunityBuild);
}

let cache: CommunityIndex | null = null;
let inflight: Promise<CommunityIndex> | null = null;

export function loadCommunityBuilds(): Promise<CommunityIndex> {
  if (cache) return Promise.resolve(cache);
  if (!inflight) {
    inflight = createResolver().then((r) => {
      const all = loadRawBuilds()
        .map((b) => resolveBuild(r, b))
        .sort((a, b) => a.raw.slug.localeCompare(b.raw.slug));
      const byWeaponType = new Map<string, ResolvedCommunityBuild[]>();
      const unbound: ResolvedCommunityBuild[] = [];
      for (const b of all) {
        const wt = b.raw.weaponType;
        if (!wt) unbound.push(b);
        else {
          const list = byWeaponType.get(wt);
          if (list) list.push(b);
          else byWeaponType.set(wt, [b]);
        }
      }
      cache = { byWeaponType, unbound, all };
      return cache;
    });
  }
  return inflight;
}

// ---------- 匯出到配裝器（community-build payload） ----------

/** 社群護石 → OwnedCharm（標 source:"reco"）。技能名須先解析到 id。 */
function communityTalismanToCharm(
  talisman: CommunityTalisman | undefined,
  resolvedSkills: (ResolvedName & { level: number })[],
  slug: string
): OwnedCharm | undefined {
  if (!talisman) return undefined;
  const skills = resolvedSkills
    .filter((s) => s.id)
    .slice(0, 2)
    .map((s) => ({ name: s.id as string, level: s.level }));
  const slots = normalizeSlots(
    (talisman.slots ?? []).map((n) => Number(n)).filter((n) => Number.isFinite(n))
  );
  if (skills.length === 0 && slots.length === 0) return undefined;
  return { id: `charm_reco_cb_${slug}`, skills, slots, source: "reco" };
}

/**
 * 由已解析的社群配裝組出匯入 payload。
 *
 * 與 Game8 full-build（selectCoreSkillRows 蒸餾總表取前 N）不同：社群 targetSkills 是
 * 作者已收斂的目標，故『直接全帶』（clamp skillMax、排除 special），不做 top-N。
 * 並鎖定解析成功的防具部位（骨架就是重點；珠由 solver 用使用者資源算）。
 */
export function buildCommunityImport(
  b: ResolvedCommunityBuild
): Extract<BuilderImport, { kind: "community-build" }> {
  const requiredSkills: SkillMap = {};
  const excludedSpecial: string[] = [];
  for (const s of b.targetSkills) {
    if (!s.id) continue; // 解析不到的技能：跳過（不硬塞無效條件）
    if (SPECIAL_SKILLS.has(s.id)) {
      if (!excludedSpecial.includes(s.id)) excludedSpecial.push(s.id);
      continue;
    }
    const max = skillMax[s.id];
    if (max == null) continue;
    requiredSkills[s.id] = Math.min(s.level, max);
  }

  const fixedArmor: Partial<Record<ArmorPart, string>> = {};
  for (const p of b.armor) if (p.armor.id) fixedArmor[p.slot] = p.armor.id;

  return {
    kind: "community-build",
    weaponType: b.raw.weaponType,
    requiredSkills,
    fixedArmor,
    charm: communityTalismanToCharm(
      b.raw.talisman,
      b.talisman?.skills ?? [],
      b.raw.slug
    ),
    skillCount: Object.keys(requiredSkills).length,
    lockedArmorCount: Object.keys(fixedArmor).length,
    totalArmorCount: b.armor.length,
    excludedSpecial,
  };
}
