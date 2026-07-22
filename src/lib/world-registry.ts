import type { Charm, SetBonus, Skill } from "@/types/build";
import * as worldEfr from "./efr-world";
import { buildStaticData, registerGameStaticData, type GameStaticData } from "./data";
import {
  WORLD_PROFILE_PLAN,
  getGameProfile,
  registerGameProfile,
  type GameProfile,
} from "./game-profile";
import type { SearchDeps, WorldSearchExt } from "./build-search";

/**
 * World（MHW: Iceborne）執行期註冊（PLAN Phase 3）。
 *
 * 把 Phase 2 產出的 world 資料接上 game-profile / game-data 抽象層：
 *  - 建 world 小資料索引（buildStaticData）並註冊 getGameStaticData("world")。
 *  - 建構並註冊 world GameProfile（動態上限 resolveSkillMax 兩條解放路徑）。
 *  - 提供 loadWorldSearchDeps() 給搜尋（含 WorldSearchExt）。
 *
 * 所有 world JSON 皆以動態 import 載入 → 獨立 chunk、不進首屏 bundle
 * （PLAN 整合驗收 #4）。
 *
 * EFR：world profile 的 efr ＝ `efr-world.ts`（Phase 4，World 逐級數值 + 斬味倍率，
 * 與 efr.ts 同介面）。已可據 EFR 排序（近似假設見 docs/efr-world-notes.md）。
 */

export type WorldStatic = {
  data: GameStaticData;
  skillByName: Record<string, Skill>;
  setBonusById: Record<string, SetBonus>;
  secretSkillNames: string[];
  charms: Charm[];
};

let worldStatic: WorldStatic | null = null;

/**
 * resolveSkillMax（world）：依當前觸發的 set bonus 技能動態解析技能上限。
 *  (b) 全域解放器（Fatalis Inheritance，unlocksAllSecrets）觸發 → 任一 secret 技能升至 secretMaxLevel。
 *  (a) 該技能專屬「○‧極意」（secretUnlockedBy）觸發 → 該技能升至 secretMaxLevel。
 *  皆無 → 原生上限 maxLevel（Phase 2 修正方向：maxLevel = dataMax − Δ）。
 */
function makeResolveSkillMax(skillByName: Record<string, Skill>) {
  return (skill: string, active: Record<string, number>): number => {
    const s = skillByName[skill];
    if (!s) return Infinity; // 未知技能不截斷（與 rise 對未列技能語意一致）
    if (s.secretMaxLevel == null) return s.maxLevel;
    // (b) 全域解放器
    for (const name of Object.keys(active)) {
      if (active[name] > 0 && skillByName[name]?.unlocksAllSecrets) {
        return s.secretMaxLevel;
      }
    }
    // (a) 專屬極意
    if (s.secretUnlockedBy && (active[s.secretUnlockedBy] ?? 0) > 0) {
      return s.secretMaxLevel;
    }
    return s.maxLevel;
  };
}

/** 載入並註冊 world 小資料 + profile（冪等；動態 import，不進首屏）。 */
export async function ensureWorldRegistered(): Promise<WorldStatic> {
  if (worldStatic) return worldStatic;
  const [decMod, skMod, wtMod, sbMod, chMod] = await Promise.all([
    import("@/data/world/decorations.json"),
    import("@/data/world/skills.json"),
    import("@/data/world/weaponTypes.json"),
    import("@/data/world/setBonuses.json"),
    import("@/data/world/charms.json"),
  ]);
  const skills = skMod.default as unknown as Skill[];
  const setBonuses = sbMod.default as unknown as SetBonus[];
  const charms = chMod.default as unknown as Charm[];

  const data = buildStaticData(
    decMod.default as never,
    skills,
    wtMod.default as never,
    setBonuses
  );
  registerGameStaticData("world", data);

  const skillByName: Record<string, Skill> = {};
  for (const s of skills) skillByName[s.name] = s;
  const setBonusById: Record<string, SetBonus> = {};
  for (const b of setBonuses) setBonusById[b.id] = b;
  const secretSkillNames = skills
    .filter((s) => s.secretMaxLevel != null)
    .map((s) => s.name);

  // 註冊 world profile（Phase 4：efr = efr-world.ts，World 逐級數值/斬味倍率，與 efr.ts 同介面）
  const profile: GameProfile = {
    ...WORLD_PROFILE_PLAN,
    efr: {
      computeEfr: worldEfr.computeEfr,
      EFR_RELEVANT_SKILLS: worldEfr.EFR_RELEVANT_SKILLS,
    },
    resolveSkillMax: makeResolveSkillMax(skillByName),
  };
  registerGameProfile(profile);

  worldStatic = { data, skillByName, setBonusById, secretSkillNames, charms };
  return worldStatic;
}

function indexById<T extends { id: string }>(items: T[]): Record<string, T> {
  const m: Record<string, T> = {};
  for (const it of items) m[it.id] = it;
  return m;
}

/** 建 world 搜尋相依（含 WorldSearchExt）。armors/weapons 動態 import。 */
export async function loadWorldSearchDeps(): Promise<SearchDeps> {
  const s = await ensureWorldRegistered();
  const [armorsMod, weaponsMod] = await Promise.all([
    import("@/data/world/armors.json"),
    import("@/data/world/weapons.json"),
  ]);
  const armors = armorsMod.default as never[];
  const weapons = weaponsMod.default as never[];
  const world: WorldSearchExt = {
    profile: getGameProfile("world"),
    setBonusById: s.setBonusById,
    secretSkillNames: s.secretSkillNames,
    skillByName: s.skillByName,
    charmPool: s.charms,
  };
  return {
    armors,
    weapons,
    armorById: indexById(armors),
    weaponById: indexById(weapons),
    decorationsBySkill: s.data.decorationsBySkill,
    skillMax: s.data.skillMax,
    world,
  };
}
