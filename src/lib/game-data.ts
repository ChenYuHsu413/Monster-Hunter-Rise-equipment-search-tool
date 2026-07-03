import type { ArmorPiece, Weapon } from "@/types/build";

/**
 * 大型遊戲資料（防具 1591 件 + 武器 3953 把，合計 ~1.8MB）的延遲載入。
 *
 * 這兩包資料只有在使用者實際操作（開武器選單 / 按搜尋）時才需要，
 * 因此用動態 import 讓 webpack 拆成獨立 chunk，不進首屏 bundle。
 * 載入後以 module 層變數快取，之後同步取用。
 *
 * 小型資料（技能 / 珠子 / 武器類型 / preset）仍在 data.ts 靜態載入（UI 立即需要）。
 */
export type GameData = {
  armors: ArmorPiece[];
  weapons: Weapon[];
  armorById: Record<string, ArmorPiece>;
  weaponById: Record<string, Weapon>;
};

let cache: GameData | null = null;
let inflight: Promise<GameData> | null = null;

function indexById<T extends { id: string }>(items: T[]): Record<string, T> {
  const map: Record<string, T> = {};
  for (const it of items) map[it.id] = it;
  return map;
}

/** 已載入時同步取得，否則 null。 */
export function getLoadedGameData(): GameData | null {
  return cache;
}

/** 載入（並快取）防具與武器資料。重複呼叫共用同一個 in-flight promise。 */
export function loadGameData(): Promise<GameData> {
  if (cache) return Promise.resolve(cache);
  if (!inflight) {
    inflight = Promise.all([
      import("@/data/armors.json"),
      import("@/data/weapons.json"),
    ]).then(([armorsMod, weaponsMod]) => {
      const armors = armorsMod.default as unknown as ArmorPiece[];
      const weapons = weaponsMod.default as unknown as Weapon[];
      cache = {
        armors,
        weapons,
        armorById: indexById(armors),
        weaponById: indexById(weapons),
      };
      return cache;
    });
  }
  return inflight;
}
