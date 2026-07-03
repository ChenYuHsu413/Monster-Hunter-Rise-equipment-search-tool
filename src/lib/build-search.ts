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
  armors as defaultArmors,
  armorById as defaultArmorById,
  decorationsBySkill as defaultDecosBySkill,
  skillMax as defaultSkillMax,
  skillIsSpecial as defaultSkillIsSpecial,
  weaponById as defaultWeaponById,
} from "./data";
import {
  applyFixedParts,
  buildEquipmentPools,
  prunePools,
} from "./equipment-pools";
import { collectSlots, formatSlots } from "./slot-utils";
import {
  calculateSkills,
  clampSkillsToMax,
  mergeSkills,
} from "./skill-calculator";
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
};

const defaultDeps: SearchDeps = {
  armors: defaultArmors,
  armorById: defaultArmorById,
  decorationsBySkill: defaultDecosBySkill,
  skillMax: defaultSkillMax,
  skillIsSpecial: defaultSkillIsSpecial,
  weaponById: defaultWeaponById,
};

/**
 * 建立搜尋相依，可注入額外防具（例如傀異鍊成產生的自訂版本）。
 * 額外防具會與原始防具並存於候選池中，並更新 armorById 索引。
 */
export function createSearchDeps(extraArmors: ArmorPiece[] = []): SearchDeps {
  if (extraArmors.length === 0) return defaultDeps;
  const armors = [...defaultDeps.armors, ...extraArmors];
  const armorById = { ...defaultDeps.armorById };
  for (const a of extraArmors) armorById[a.id] = a;
  return { ...defaultDeps, armors, armorById };
}

export type SearchMeta = {
  combosEvaluated: number;
  validBuilds: number;
  truncated: boolean;
  mode: string;
  candidatesPerPart: Record<string, number>;
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

export function searchBuilds(
  request: BuildSearchRequest,
  deps: SearchDeps = defaultDeps,
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
  } = normalizeRequest(request);

  // 護石：固定護石即使用者輸入的護石，兩者在第一版等價
  const effectiveCharm: Charm = fixedParts.charm ?? charm;

  // 武器：固定武器用其洞位與技能，否則用使用者輸入的武器洞
  let weapon: Weapon | undefined;
  let weaponSlots = request.weaponSlots;
  if (fixedParts.weapon && deps.weaponById[fixedParts.weapon]) {
    weapon = deps.weaponById[fixedParts.weapon];
    weaponSlots = weapon.slots;
  }

  // 候選池：分組 → 排除 → 固定 → 依模式裁切
  let pools = buildEquipmentPools(deps.armors, excludedItems);
  pools = applyFixedParts(pools, fixedParts, deps.armorById);
  pools = prunePools(
    pools,
    { requiredSkills, preferredSkills, avoidSkills, skillWeights },
    searchMode,
    fixedParts
  );

  const candidatesPerPart: Record<string, number> = {};
  for (const part of ARMOR_PARTS) candidatesPerPart[part] = pools[part].length;

  // 武器/護石不動的既有技能
  const baseSkills = mergeSkills(effectiveCharm.skills, weapon?.skills);

  const buffer: BuildResult[] = [];
  let combos = 0;
  let valid = 0;
  let truncated = false;

  const heads = pools.head;
  const chests = pools.chest;
  const armsArr = pools.arms;
  const waists = pools.waist;
  const legsArr = pools.legs;

  outer: for (const head of heads) {
    for (const chest of chests) {
      for (const arms of armsArr) {
        for (const waist of waists) {
          for (const legs of legsArr) {
            combos++;
            if (combos > MAX_COMBOS) {
              truncated = true;
              break outer;
            }
            const pieces: ArmorPiece[] = [head, chest, arms, waist, legs];

            const armorSkills = calculateSkills(pieces, undefined);
            const currentSkills = mergeSkills(armorSkills, baseSkills);
            const slots = collectSlots(pieces, effectiveCharm, weaponSlots);

            const solve = solveDecorations({
              slots,
              currentSkills,
              requiredSkills,
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
              requiredSkills,
              preferredSkills,
              avoidSkills,
              skillWeights,
              remainingSlots: solve.remainingSlots,
              reservedSlots,
              meetsReserved: true,
              fixedParts,
              skillMax: deps.skillMax,
              skillIsSpecial: deps.skillIsSpecial,
            });

            const result: BuildResult = {
              id: `${head.id}|${chest.id}|${arms.id}|${waist.id}|${legs.id}`,
              weapon,
              armor: { head, chest, arms, waist, legs },
              charm: effectiveCharm,
              decorations: solve.assignments,
              finalSkills,
              remainingSlots: solve.remainingSlots,
              score,
              missingRequiredSkills: {},
              meetsReservedSlots: true,
              summary: "",
            };
            result.summary = formatBuildResult(result);
            buffer.push(result);
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
  return {
    charm: req.charm ?? { skills: {}, slots: [] },
    fixedParts: req.fixedParts ?? {},
    excludedItems: req.excludedItems ?? { armorIds: [], weaponIds: [] },
    requiredSkills: req.requiredSkills ?? {},
    preferredSkills: req.preferredSkills ?? {},
    avoidSkills: req.avoidSkills ?? {},
    skillWeights: req.skillWeights ?? {},
    reservedSlots: req.reservedSlots ?? { 4: 0, 3: 0, 2: 0, 1: 0 },
    searchMode: req.searchMode ?? "fast",
    resultLimit: req.resultLimit ?? 100,
  };
}

/** 產生一段人類可讀的配裝摘要（也用於「複製配裝摘要」）。 */
export function formatBuildResult(build: BuildResult): string {
  const lines: string[] = [];
  if (build.weapon) {
    lines.push(`武器：${build.weapon.nameZh}（${formatSlots(build.weapon.slots)}）`);
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
