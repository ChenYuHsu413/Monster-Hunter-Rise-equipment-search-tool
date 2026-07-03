import type { ElementType, Weapon } from "@/types/build";

/** 屬性/狀態異常的中文標籤。 */
export const ELEMENT_LABELS: Record<ElementType, string> = {
  fire: "火",
  water: "水",
  thunder: "雷",
  ice: "冰",
  dragon: "龍",
  poison: "毒",
  paralysis: "麻痺",
  sleep: "睡眠",
  blast: "爆破",
  none: "無",
};

const BOW_SHOT_LABELS = { rapid: "連射", pierce: "貫通", spread: "擴散" } as const;
const SHELLING_LABELS = { normal: "通常", long: "放射", wide: "擴散" } as const;
const PHIAL_LABELS: Record<string, string> = {
  power: "強屬性瓶",
  element: "屬性瓶",
  impact: "榴彈瓶",
  dragon: "龍擊瓶",
  poison: "毒瓶",
  paralysis: "麻痺瓶",
  exhaust: "減氣瓶",
};
const AMMO_LABELS: Record<string, string> = {
  normal: "通常彈",
  pierce: "貫通彈",
  spread: "散彈",
  shrapnel: "碎龍彈",
  sticky: "黏著彈",
  slicing: "斬裂彈",
};

/** 武器屬性簡述，例如「冰 35」；無屬性回傳 null。 */
export function formatWeaponElement(weapon: Weapon): string | null {
  const e = weapon.element;
  if (!e || e.type === "none") return null;
  return `${ELEMENT_LABELS[e.type]} ${e.value}`;
}

/**
 * 武器專屬資訊摘要（彈種 / 射法 / 砲擊 / 瓶種 / 獵蟲），每項一行。
 * 沒有專屬資訊時回傳空陣列。
 */
export function formatWeaponSpecial(weapon: Weapon): string[] {
  const lines: string[] = [];
  if (weapon.ammo) {
    if (weapon.ammo.rapidFire?.length) {
      lines.push(`速射：${weapon.ammo.rapidFire.join("、")}`);
    }
    const mains = Object.entries(AMMO_LABELS)
      .filter(([key]) => {
        const v = weapon.ammo?.[key as keyof NonNullable<Weapon["ammo"]>];
        return Array.isArray(v) && v.length > 0;
      })
      .map((entry) => entry[1]);
    if (mains.length) lines.push(`主要彈種：${mains.join("、")}`);
  }
  if (weapon.bow) {
    const parts: string[] = [];
    if (weapon.bow.shotType) parts.push(`${BOW_SHOT_LABELS[weapon.bow.shotType]}射法`);
    if (weapon.bow.coatings?.length) parts.push(`瓶：${weapon.bow.coatings.join("、")}`);
    if (parts.length) lines.push(parts.join("　"));
  }
  if (weapon.shelling) {
    lines.push(`砲擊：${SHELLING_LABELS[weapon.shelling.type]}型 Lv${weapon.shelling.level}`);
  }
  if (weapon.phial) {
    lines.push(PHIAL_LABELS[weapon.phial.type] ?? weapon.phial.type);
  }
  if (weapon.kinsectLevel) {
    lines.push(`獵蟲 Lv${weapon.kinsectLevel}`);
  }
  return lines;
}

/** 一行式基礎數值摘要：「攻擊 330 · 會心 15% · 冰 35 · 百龍 Lv2」。 */
export function formatWeaponStats(weapon: Weapon): string {
  const parts = [`攻擊 ${weapon.attack}`, `會心 ${weapon.affinity}%`];
  const elem = formatWeaponElement(weapon);
  if (elem) parts.push(elem);
  if (weapon.rampageSlot) parts.push(`百龍 Lv${weapon.rampageSlot}`);
  return parts.join(" · ");
}
