/** Default pack / set rarity distribution (percent-style weights, sum ≈ 100). */
export const DEFAULT_SET_RARITY_WEIGHTS = {
  common: 52,
  uncommon: 22,
  rare: 12,
  super_rare: 7,
  ultra_rare: 4,
  legendary: 2,
  mythic: 1,
} as const;

export function defaultRarityWeightsJson(): string {
  return JSON.stringify(DEFAULT_SET_RARITY_WEIGHTS);
}
