"use client";

import { useEffect, useRef } from "react";
import { WEAPON_ICONS, ARMOR_ICONS } from "@/lib/equipment-icons";
import { rarityColor } from "@/lib/rarity";
import { cn } from "@/lib/utils";

/**
 * 以命令式（ref + innerHTML）注入 SVG 內容，避開 dangerouslySetInnerHTML 在 SVG 上的
 * hydration 問題：render 出空 svg（SSR/client 一致），掛載後才填入圖形。
 */
function IconSvg({
  inner,
  color,
  className,
  title,
}: {
  inner: string;
  color?: string;
  className?: string;
  title?: string;
}) {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.innerHTML = inner;
  }, [inner]);
  return (
    <svg
      ref={ref}
      viewBox="0 0 64 64"
      className={cn("shrink-0", className)}
      style={color ? { color } : undefined}
      fill="currentColor"
      role="img"
      aria-label={title}
    />
  );
}

/** 武器類型圖示。中性色（沿用 currentColor，由呼叫端設定）。 */
export function WeaponIcon({
  type,
  className,
  title,
}: {
  type: string;
  className?: string;
  title?: string;
}) {
  const inner = WEAPON_ICONS[type];
  if (!inner) return null;
  return <IconSvg inner={inner} className={className} title={title} />;
}

/** 防具部位圖示。依稀有度上色（rarity 給定時）。 */
export function ArmorIcon({
  part,
  rarity,
  className,
  title,
}: {
  part: string;
  rarity?: number;
  className?: string;
  title?: string;
}) {
  const inner = ARMOR_ICONS[part];
  if (!inner) return null;
  return (
    <IconSvg
      inner={inner}
      color={rarity != null ? rarityColor(rarity) : undefined}
      className={className}
      title={title}
    />
  );
}
