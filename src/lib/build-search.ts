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
  skillIsSpecial as defaultSkillIsSpecial,
} from "./data";
import type { GameData } from "./game-data";
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
import { scoreBuild } from "./score-build";

/** 可注入的資料相依（測試用）；預設使用本地 JSON。 */
export type SearchDeps = {
  armors: ArmorPiece[];
  armorById: Record<string, ArmorPiece>;
  decorationsBySkill: Record<string, Decoration[]>;
  skillMax: Record<string, number>;
  skillIsSpecial: Record<string, boolean>;
  weaponById: Record<string, Weapon>;
  weapons: Weapon[];
};

/**
 * 由延遲載入的 GameData（防具 + 武器）搭配靜態小資料組出搜尋相依。
 * 可注入額外防具（例如傀異鍊成產生的自訂版本），與原始防具並存於候選池。
 */
export function createSearchDeps(
  gameData: GameData,
  extraArmors: ArmorPiece[] = []
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
    skillIsSpecial: defaultSkillIsSpecial,
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
  elapsedMs: number;
};

export type SearchOutput = {
  results: BuildResult[];
  meta: SearchMeta;
};

/** 內部候選緩衝（規格：內部保留 300~500 做二次排序）。 */
const INTERNAL_BUFFER = 500;
/** 防止資料變大後組合爆炸的硬上限。 */
const MAX_COMBOS = 300000;
/** 五屬性集合（屬性流武器屬性加分用）。 */
const FIVE_ELEMENTS = new Set(["fire", "water", "thunder", "ice", "dragon"]);
/** 屬性流：武器屬性值計入配裝總分的權重（讓屬攻優先延伸到最終排序）。 */
const ELEMENT_SCORE_WEIGHT = 3;

export function searchBuilds(
  request: BuildSearchRequest,
  deps: SearchDeps,
  /** 可傳入計時器；預設 0（避免非決定性，交由呼叫端量測亦可）。 */
  now: () => number = () => 0
): SearchOutput {
  const start = now();
  const {
    charm,
    fixedParts,
    excludedItems,
    requiredSkills,
    preferredSkills,
    avoidSkills,
    skillWeights,
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

  // 防禦/耐性過濾：只在有設定時才作用。耐性只檢查使用者有指定的屬性。
  const resFilter = Object.entries(minResistances) as [
    keyof typeof minResistances,
    number
  ][];

  // 屬性流：候選武器與最終排序皆以屬性值優先
  const preferElement =
    request.preferElement ?? !!autoRules?.addElementAttackSkill;

  // 護石：固定護石即使用者輸入的護石，兩者在第一版等價
  const effectiveCharm: Charm = fixedParts.charm ?? charm;

  // 武器候選池：fixed → 單一指定武器；search → 同類型武器依分數取前 N
  const weaponPool = buildWeaponPool({
    weapons: deps.weapons,
    weaponById: deps.weaponById,
    weaponType: request.weaponType,
    weaponSearchMode,
    fixedWeaponId,
    fixedPartsWeapon: fixedParts.weapon,
    excludedWeaponIds: excludedItems.weaponIds,
    preset: { requiredSkills, preferredSkills, skillWeights },
    mode: searchMode,
    elementFilter,
    preferElement,
    maxRarity: request.maxRarity,
  });
  // 後援：無任何武器候選（無資料或全被排除）時，退回舊版手動洞數
  const weaponCandidates: (Weapon | undefined)[] =
    weaponPool.length > 0 ? weaponPool : [undefined];
  const weaponFixed = weaponSearchMode === "fixed";

  // 防具基礎池：分組（依 rarity 上限限制取得門檻）→ 排除 → 固定
  const basePools0 = buildEquipmentPools(
    deps.armors,
    excludedItems,
    request.maxRarity
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

    // 屬性流：此武器的屬性值加分（併入配裝總分，讓屬攻優先延伸到最終排序）
    const weaponElementScore =
      preferElement && weapon?.element && FIVE_ELEMENTS.has(weapon.element.type)
        ? weapon.element.value * ELEMENT_SCORE_WEIGHT
        : 0;

    const pools = prunePools(
      basePools,
      {
        requiredSkills: effRequired,
        preferredSkills,
        avoidSkills,
        skillWeights,
      },
      searchMode,
      fixedParts,
      weaponCandidates.length
    );
    for (const part of ARMOR_PARTS) {
      candidatesPerPart[part] = pools[part].length;
    }

    const weaponSlots = weapon ? weapon.slots : (request.weaponSlots ?? []);
    // 武器/護石不動的既有技能
    const baseSkills = mergeSkills(effectiveCharm.skills, weapon?.skills);

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
              combos++;
              if (combos > MAX_COMBOS) {
                truncated = true;
                break weaponLoop;
              }
              const pieces: ArmorPiece[] = [head, chest, arms, waist, legs];

              // 防禦/耐性：由 5 件防具加總，與珠子無關，故在昂貴的解算前先過濾。
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

              const armorSkills = calculateSkills(pieces, undefined);
              const currentSkills = mergeSkills(armorSkills, baseSkills);
              const slots = collectSlots(pieces, effectiveCharm, weaponSlots);

              const solve = solveDecorations({
                slots,
                currentSkills,
                requiredSkills: effRequired,
                preferredSkills,
                reservedSlots,
                decorationsBySkill: deps.decorationsBySkill,
                skillMax: deps.skillMax,
              });

              if (!solve.success) continue; // 必要技能或保留洞位不符 → 淘汰

              valid++;
              const finalSkills = clampSkillsToMax(
                mergeSkills(currentSkills, decoSkillMap(solve.assignments)),
                deps.skillMax
              );

              const score = scoreBuild({
                finalSkills,
                requiredSkills: effRequired,
                preferredSkills,
                avoidSkills,
                skillWeights,
                remainingSlots: solve.remainingSlots,
                reservedSlots,
                meetsReserved: true,
                fixedParts,
                skillMax: deps.skillMax,
                skillIsSpecial: deps.skillIsSpecial,
                elementScore: weaponElementScore,
              });

              const result: BuildResult = {
                id: `${weapon?.id ?? "custom"}|${head.id}|${chest.id}|${arms.id}|${waist.id}|${legs.id}`,
                weapon,
                armor: { head, chest, arms, waist, legs },
                charm: effectiveCharm,
                decorations: solve.assignments,
                finalSkills,
                remainingSlots: solve.remainingSlots,
                totalDefense,
                totalResistances,
                score,
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

  // 二次排序：取內部緩衝上限 → 最終 resultLimit
  buffer.sort((a, b) => b.score.total - a.score.total);
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
    charm: req.charm ?? { skills: {}, slots: [] },
    fixedParts,
    excludedItems: req.excludedItems ?? { armorIds: [], weaponIds: [] },
    requiredSkills: req.requiredSkills ?? {},
    preferredSkills: req.preferredSkills ?? {},
    avoidSkills: req.avoidSkills ?? {},
    skillWeights: req.skillWeights ?? {},
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
  lines.push(`總分：${build.score.total}`);
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
