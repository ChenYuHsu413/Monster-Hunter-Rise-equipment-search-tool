import type {
  ArmorPiece,
  BuildResult,
  BuildSearchRequest,
  Charm,
  Decoration,
  SkillMap,
  Weapon,
} from "@/types/build";
import { ARMOR_PARTS, ARMOR_PART_LABELS } from "@/types/build";
import {
  decorationsBySkill as defaultDecosBySkill,
  skillMax as defaultSkillMax,
} from "./data";
import type { GameData } from "./game-data";
import { isCraftable, type UnlockEntry } from "./unlocks";
import {
  applyFixedParts,
  buildEquipmentPools,
  buildWeaponPool,
  prunePools,
} from "./equipment-pools";
import { collectSlots, formatSlots } from "./slot-utils";
import {
  calculateSkills,
  clampSkillsToMax,
  mergeSkills,
} from "./skill-calculator";
import { mergeMaxSkills, resolveAutoSkills } from "./preset-resolver";
import { formatWeaponStats } from "./weapon-utils";
import { solveDecorations } from "./decoration-solver";
import { computeEfr, EFR_RELEVANT_SKILLS } from "./efr";

/** 可注入的資料相依（測試用）；預設使用本地 JSON。 */
export type SearchDeps = {
  armors: ArmorPiece[];
  armorById: Record<string, ArmorPiece>;
  decorationsBySkill: Record<string, Decoration[]>;
  skillMax: Record<string, number>;
  weaponById: Record<string, Weapon>;
  weapons: Weapon[];
  /** 解放條件資料（可選）。與 request.progress 同時給定時啟用進度篩選。 */
  unlocks?: Record<string, UnlockEntry>;
};

/**
 * 由延遲載入的 GameData（防具 + 武器）搭配靜態小資料組出搜尋相依。
 * 可注入額外防具（例如傀異鍊成產生的自訂版本），與原始防具並存於候選池。
 */
export function createSearchDeps(
  gameData: GameData,
  extraArmors: ArmorPiece[] = [],
  /** 解放條件資料（loadUnlocks() 的 entries）；給定後 request.progress 才會生效。 */
  unlocks?: Record<string, UnlockEntry>
): SearchDeps {
  let armors = gameData.armors;
  let armorById = gameData.armorById;
  if (extraArmors.length > 0) {
    armors = [...gameData.armors, ...extraArmors];
    armorById = { ...gameData.armorById };
    for (const a of extraArmors) armorById[a.id] = a;
  }
  return {
    armors,
    armorById,
    weapons: gameData.weapons,
    weaponById: gameData.weaponById,
    decorationsBySkill: defaultDecosBySkill,
    skillMax: defaultSkillMax,
    ...(unlocks ? { unlocks } : {}),
  };
}

export type SearchMeta = {
  combosEvaluated: number;
  validBuilds: number;
  truncated: boolean;
  mode: string;
  candidatesPerPart: Record<string, number>;
  /** 參與搜尋的武器候選數（fixed 為 1；後援手動洞數為 0）。 */
  weaponsTried: number;
  /** 參與組合計算的護石數（不使用護石時為 0）。 */
  charmsTried: number;
  elapsedMs: number;
};

export type SearchOutput = {
  results: BuildResult[];
  meta: SearchMeta;
};

/** 內部候選緩衝（規格：內部保留 300~500 做二次排序）。 */
const INTERNAL_BUFFER = 500;
/** 防止資料變大後組合爆炸的硬上限（含護石維度的解算次數）。 */
const MAX_COMBOS = 300000;
/** 條件技能觸發率（傳入 EFR；校準時可調）。 */
const CONDITIONAL_UPTIME = 0.75;

/** 沒有護石時的佔位（不提供技能與洞位）。 */
const NO_CHARM: Charm = { skills: {}, slots: [] };

/**
 * 孔位支配：a 的孔位能否容納 b 的所有孔位（兩者皆須先降冪正規化、去零）。
 * 依 Hall 定理，降冪逐位比較即為最佳配對：a 至少和 b 一樣多孔，且每一位 ≥ b。
 */
function slotsDominate(a: number[], b: number[]): boolean {
  if (a.length < b.length) return false;
  for (let i = 0; i < b.length; i++) {
    if (a[i] < b[i]) return false;
  }
  return true;
}

/**
 * 護石支配：a 是否在「每個相關技能等級」與「孔位」上都 ≥ b。
 * relevant = 必要技能 ∪ EFR 技能；非相關技能（純舒適/冷門）不影響配裝合法性與 EFR
 * 排名，故不列入比較，以剪掉更多冗餘護石（wiki-db 能吃數百顆護石即靠此）。
 * 成立時 b 為冗餘——任何用 b 的合法配裝換成 a 後，必要技能仍達成、EFR 不降、
 * 孔位不減，故 b 可安全剔除。代價僅：b 若帶有非相關的額外技能，該「賺到」的
 * 技能可能不再出現在結果中（EFR 與必要技能完全不受影響）。
 */
function charmDominates(
  a: Charm,
  aSlots: number[],
  b: Charm,
  bSlots: number[],
  relevant: ReadonlySet<string>
): boolean {
  for (const [skill, lvl] of Object.entries(b.skills)) {
    if (!relevant.has(skill)) continue;
    if ((a.skills[skill] ?? 0) < lvl) return false;
  }
  return slotsDominate(aSlots, bSlots);
}

/**
 * 護石支配剪枝：剔除被其他護石在相關技能與孔位上完全支配的冗餘護石。
 * 這是配裝器控制護石維度爆炸的經典手法——玩家囤的數十顆護石裡，大量是
 * 早期留下、被後期護石全面壓過的冗餘品，剪掉後不影響任何最優解。
 *
 * 依「相關技能總等級 + 孔位價值」由強到弱處理，逐一保留「未被任何已保留護石支配」者：
 * 因支配關係可遞移且較強者先處理，被支配者必有一顆已保留的護石支配它；
 * 完全相同的重複護石只會保留第一顆。
 */
export function pruneDominatedCharms(
  charms: Charm[],
  relevant: ReadonlySet<string>
): Charm[] {
  const items = charms.map((c) => ({
    c,
    slots: [...c.slots].filter((s) => s > 0).sort((x, y) => y - x),
  }));
  const strength = (it: (typeof items)[number]) => {
    let s = 0;
    for (const [skill, lvl] of Object.entries(it.c.skills)) {
      if (relevant.has(skill)) s += lvl;
    }
    for (const sl of it.slots) s += sl * 0.1;
    return s;
  };
  items.sort((a, b) => strength(b) - strength(a));
  const kept: typeof items = [];
  for (const it of items) {
    if (!kept.some((k) => charmDominates(k.c, k.slots, it.c, it.slots, relevant))) {
      kept.push(it);
    }
  }
  return kept.map((k) => k.c);
}

export function searchBuilds(
  request: BuildSearchRequest,
  deps: SearchDeps,
  /** 可傳入計時器；預設 0（避免非決定性，交由呼叫端量測亦可）。 */
  now: () => number = () => 0
): SearchOutput {
  const start = now();
  const {
    charms,
    fixedParts,
    excludedItems,
    requiredSkills,
    excludedSkills,
    reservedSlots,
    searchMode,
    resultLimit,
    weaponSearchMode,
    fixedWeaponId,
    autoRules,
    elementFilter,
    minDefense,
    minResistances,
  } = normalizeRequest(request);

  const excludedSet = new Set(excludedSkills);

  // 防禦/耐性過濾：只在有設定時才作用。耐性只檢查使用者有指定的屬性。
  const resFilter = Object.entries(minResistances) as [
    keyof typeof minResistances,
    number
  ][];

  // 屬性流：候選武器以屬性值優先
  const preferElement =
    request.preferElement ?? !!autoRules?.addElementAttackSkill;

  // 護石清單：帶有排除技能的護石直接跳過；清單為空（或全被排除）＝不使用護石。
  // 再做支配剪枝剔除冗餘護石（玩家常囤數十顆，多數被完全壓過），控制組合維度。
  const usableCharms = charms.filter(
    (c) => !Object.keys(c.skills).some((s) => excludedSet.has(s))
  );
  // 相關技能 = 必要技能 ∪ EFR 技能（含各屬性攻擊強化，故已涵蓋逐武器自動技能）。
  const relevantCharmSkills = new Set<string>([
    ...Object.keys(requiredSkills),
    ...EFR_RELEVANT_SKILLS,
  ]);
  const prunedCharms = pruneDominatedCharms(usableCharms, relevantCharmSkills);
  const charmCandidates: Charm[] =
    prunedCharms.length > 0 ? prunedCharms : [NO_CHARM];

  // 進度解放篩選：request.progress 與 deps.unlocks 同時給定才啟用（旗標疊加，
  // 未啟用時行為與既有搜尋完全相同）。固定部位/武器照舊不受限。
  const progress = request.progress;
  const unlockMap = deps.unlocks;
  const craftable =
    progress && unlockMap
      ? (id: string) => isCraftable(unlockMap[id], progress)
      : undefined;

  // 武器候選池：fixed → 單一指定武器；search → 同類型武器依分數取前 N
  const weaponPool = buildWeaponPool({
    weapons: deps.weapons,
    weaponById: deps.weaponById,
    weaponType: request.weaponType,
    weaponSearchMode,
    fixedWeaponId,
    fixedPartsWeapon: fixedParts.weapon,
    excludedWeaponIds: excludedItems.weaponIds,
    requiredSkills,
    excludedSkills: excludedSet,
    mode: searchMode,
    elementFilter,
    preferElement,
    maxRarity: request.maxRarity,
    craftable,
  });
  // 後援：無任何武器候選（無資料或全被排除）時，退回舊版手動洞數
  const weaponCandidates: (Weapon | undefined)[] =
    weaponPool.length > 0 ? weaponPool : [undefined];
  const weaponFixed = weaponSearchMode === "fixed";

  // 防具基礎池：分組（依 rarity 上限/進度解放/排除技能限制）→ 排除 → 固定
  const basePools0 = buildEquipmentPools(
    deps.armors,
    excludedItems,
    request.maxRarity,
    craftable,
    excludedSet
  );
  const basePools = applyFixedParts(basePools0, fixedParts, deps.armorById);

  const candidatesPerPart: Record<string, number> = {};
  const buffer: BuildResult[] = [];
  let combos = 0;
  let valid = 0;
  let truncated = false;

  weaponLoop: for (const weapon of weaponCandidates) {
    // 依武器屬性套用自動技能（硬條件：併入必要技能）
    const autoSkills = resolveAutoSkills(autoRules, weapon);
    const effRequired = mergeMaxSkills(requiredSkills, autoSkills);

    const pools = prunePools(
      basePools,
      effRequired,
      searchMode,
      fixedParts,
      weaponCandidates.length,
      charmCandidates.length
    );
    for (const part of ARMOR_PARTS) {
      candidatesPerPart[part] = pools[part].length;
    }

    const weaponSlots = weapon ? weapon.slots : (request.weaponSlots ?? []);
    const weaponSkills = weapon?.skills;

    const heads = pools.head;
    const chests = pools.chest;
    const armsArr = pools.arms;
    const waists = pools.waist;
    const legsArr = pools.legs;

    for (const head of heads) {
      for (const chest of chests) {
        for (const arms of armsArr) {
          for (const waist of waists) {
            for (const legs of legsArr) {
              const pieces: ArmorPiece[] = [head, chest, arms, waist, legs];

              // 防禦/耐性：由 5 件防具加總，與珠子/護石無關，故在昂貴的解算前先過濾。
              let totalDefense = 0;
              const totalResistances = {
                fire: 0,
                water: 0,
                thunder: 0,
                ice: 0,
                dragon: 0,
              };
              for (const p of pieces) {
                totalDefense += p.defense ?? 0;
                const er = p.elementRes;
                if (er) {
                  totalResistances.fire += er.fire;
                  totalResistances.water += er.water;
                  totalResistances.thunder += er.thunder;
                  totalResistances.ice += er.ice;
                  totalResistances.dragon += er.dragon;
                }
              }
              if (minDefense > 0 && totalDefense < minDefense) continue;
              let resOk = true;
              for (const [key, min] of resFilter) {
                if (totalResistances[key] < min) {
                  resOk = false;
                  break;
                }
              }
              if (!resOk) continue;

              // 防具技能與護石無關，每個防具組合只算一次
              const armorSkills = calculateSkills(pieces, undefined);

              for (const charm of charmCandidates) {
                combos++;
                if (combos > MAX_COMBOS) {
                  truncated = true;
                  break weaponLoop;
                }

                const currentSkills = mergeSkills(
                  armorSkills,
                  mergeSkills(charm.skills, weaponSkills)
                );
                const slots = collectSlots(pieces, charm, weaponSlots);

                const solve = solveDecorations({
                  slots,
                  currentSkills,
                  requiredSkills: effRequired,
                  reservedSlots,
                  decorationsBySkill: deps.decorationsBySkill,
                  skillMax: deps.skillMax,
                });

                if (!solve.success) continue; // 必要技能或保留洞位不符 → 淘汰

                const finalSkills = clampSkillsToMax(
                  mergeSkills(currentSkills, decoSkillMap(solve.assignments)),
                  deps.skillMax
                );

                // 排除技能最終防線（候選池已預濾，這裡擋固定部位等漏網）
                if (
                  excludedSet.size > 0 &&
                  Object.keys(finalSkills).some(
                    (s) => excludedSet.has(s) && finalSkills[s] > 0
                  )
                ) {
                  continue;
                }

                valid++;
                const efr = weapon
                  ? computeEfr({
                      weapon,
                      skills: finalSkills,
                      conditionalUptime: CONDITIONAL_UPTIME,
                    })
                  : undefined;

                const result: BuildResult = {
                  id: `${weapon?.id ?? "custom"}|${head.id}|${chest.id}|${arms.id}|${waist.id}|${legs.id}|${charm.id ?? "none"}`,
                  weapon,
                  armor: { head, chest, arms, waist, legs },
                  charm,
                  decorations: solve.assignments,
                  finalSkills,
                  remainingSlots: solve.remainingSlots,
                  totalDefense,
                  totalResistances,
                  efr: {
                    raw: Math.round(efr?.raw ?? 0),
                    element: Math.round(efr?.element ?? 0),
                    total: Math.round(efr?.total ?? 0),
                  },
                  missingRequiredSkills: {},
                  meetsReservedSlots: true,
                  autoSkills: Object.keys(autoSkills).length
                    ? autoSkills
                    : undefined,
                  weaponFixed: weapon ? weaponFixed : undefined,
                  summary: "",
                };
                result.summary = formatBuildResult(result);
                buffer.push(result);
              }
            }
          }
        }
      }
    }
  }

  // 二次排序：預設依 EFR 綜合值（物理＋屬性）→ 取內部緩衝上限 → 最終 resultLimit
  buffer.sort((a, b) => b.efr.total - a.efr.total);
  const pooled = buffer.slice(0, INTERNAL_BUFFER);
  const limit = Math.min(resultLimit, 100);
  const results = pooled.slice(0, limit);

  return {
    results,
    meta: {
      combosEvaluated: combos,
      validBuilds: valid,
      truncated,
      mode: searchMode,
      candidatesPerPart,
      weaponsTried: weaponPool.length,
      charmsTried: prunedCharms.length,
      elapsedMs: now() - start,
    },
  };
}

/** 將珠子指派彙整成技能 map。 */
function decoSkillMap(
  assignments: { skillName: string; skillLevel: number }[]
): SkillMap {
  const out: SkillMap = {};
  for (const a of assignments) {
    out[a.skillName] = (out[a.skillName] ?? 0) + a.skillLevel;
  }
  return out;
}

/** 補齊 request 缺省欄位，避免 undefined。 */
function normalizeRequest(req: BuildSearchRequest) {
  const fixedParts = req.fixedParts ?? {};
  const fixedWeaponId = req.fixedWeaponId ?? fixedParts.weapon;
  return {
    charms: req.charms ?? [],
    fixedParts,
    excludedItems: req.excludedItems ?? { armorIds: [], weaponIds: [] },
    requiredSkills: req.requiredSkills ?? {},
    excludedSkills: req.excludedSkills ?? [],
    reservedSlots: req.reservedSlots ?? { 4: 0, 3: 0, 2: 0, 1: 0 },
    searchMode: req.searchMode ?? "fast",
    resultLimit: req.resultLimit ?? 100,
    minDefense: req.minDefense ?? 0,
    minResistances: req.minResistances ?? {},
    // 相容舊請求：未指定模式時，有固定武器視為 fixed，否則 search
    weaponSearchMode:
      req.weaponSearchMode ?? (fixedWeaponId ? "fixed" : "search"),
    fixedWeaponId,
    autoRules: req.autoRules,
    elementFilter: req.elementFilter,
  };
}

/** 產生一段人類可讀的配裝摘要（也用於「複製配裝摘要」）。 */
export function formatBuildResult(build: BuildResult): string {
  const lines: string[] = [];
  if (build.weapon) {
    lines.push(
      `武器：${build.weapon.nameZh}（${formatSlots(build.weapon.slots)}）${formatWeaponStats(build.weapon)}`
    );
  }
  if (build.autoSkills && Object.keys(build.autoSkills).length) {
    lines.push(
      `自動技能：${Object.entries(build.autoSkills)
        .map(([n, l]) => `${n} Lv${l}`)
        .join("、")}`
    );
  }
  for (const part of ARMOR_PARTS) {
    const piece = build.armor[part];
    lines.push(
      `${ARMOR_PART_LABELS[part]}：${piece.nameZh}（${formatSlots(piece.slots)}）`
    );
  }
  const charmSkills = Object.entries(build.charm.skills)
    .map(([n, l]) => `${n}${l}`)
    .join("、");
  lines.push(
    `護石：${charmSkills || "無"}（${formatSlots(build.charm.slots)}）`
  );

  const r = build.totalResistances;
  lines.push(
    `防禦：${build.totalDefense}　耐性：火${r.fire} 水${r.water} 雷${r.thunder} 冰${r.ice} 龍${r.dragon}`
  );

  const topSkills = Object.entries(build.finalSkills)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([n, l]) => `${n} Lv${l}`)
    .join("、");
  lines.push(`技能：${topSkills}`);

  if (build.decorations.length) {
    const decoText = summarizeDecorations(build.decorations);
    lines.push(`裝飾珠：${decoText}`);
  }
  lines.push(`剩餘洞位：${formatSlots(build.remainingSlots)}`);
  if (build.efr.raw > 0) {
    lines.push(
      `EFR：${build.efr.raw}${build.efr.element > 0 ? `　期望屬性值：${build.efr.element}` : ""}`
    );
  }
  return lines.join("\n");
}

/** 將珠子指派彙整成「珠名 ×n」的可讀字串。 */
export function summarizeDecorations(
  assignments: { decorationName: string }[]
): string {
  const counts: Record<string, number> = {};
  for (const a of assignments) {
    counts[a.decorationName] = (counts[a.decorationName] ?? 0) + 1;
  }
  return Object.entries(counts)
    .map(([name, n]) => (n > 1 ? `${name}×${n}` : name))
    .join("、");
}
