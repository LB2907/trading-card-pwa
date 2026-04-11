/**
 * Gacha-style rarity ladder (slug → display). Used for sort, packs, and UI lists.
 */
export const RARITY_DEFINITIONS = [
  { id: "common", label: "Common (N)", short: "N" },
  { id: "uncommon", label: "Uncommon (R)", short: "R" },
  { id: "rare", label: "Rare (SR)", short: "SR" },
  { id: "super_rare", label: "Super Rare (SSR)", short: "S+" },
  { id: "ultra_rare", label: "Ultra Rare (UR)", short: "UR" },
  { id: "legendary", label: "Legendary (LR)", short: "LR" },
  { id: "mythic", label: "Mythic (EX)", short: "EX" },
] as const;

export type GameRarityId = (typeof RARITY_DEFINITIONS)[number]["id"];

export const GAME_RARITY_IDS: GameRarityId[] = RARITY_DEFINITIONS.map((d) => d.id);

/** 0 = common … 6 = mythic; -1 = unknown (no frame tier, sorts last). */
export function rarityTier(slug: string): number {
  const r = slug.toLowerCase();
  const i = GAME_RARITY_IDS.indexOf(r as GameRarityId);
  return i >= 0 ? i : -1;
}

/** Text inside the small rarity gem on the card (kept short for layout). */
export function rarityGemShort(slug: string): string {
  const r = slug.toLowerCase();
  const row = RARITY_DEFINITIONS.find((d) => d.id === r);
  if (row) return row.short;
  return (slug[0] || "?").toUpperCase();
}

export function rarityLabel(slug: string): string {
  const r = slug.toLowerCase();
  const row = RARITY_DEFINITIONS.find((d) => d.id === r);
  return row?.label ?? slug;
}
