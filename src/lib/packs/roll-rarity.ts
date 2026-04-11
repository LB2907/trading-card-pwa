/** Pure helpers for pack rarity rolls (used by `openPack` and tests). */

export function parsePackWeights(json: string): Record<string, number> {
  try {
    const o = JSON.parse(json) as unknown;
    if (!o || typeof o !== "object" || Array.isArray(o)) return { common: 1 };
    return o as Record<string, number>;
  } catch {
    return { common: 1 };
  }
}

export function rollRarityFromWeights(
  weights: Record<string, number>,
  rng: () => number,
): string {
  const entries = Object.entries(weights);
  if (!entries.length) return "common";
  const total = entries.reduce((s, [, w]) => s + w, 0);
  if (total <= 0) return entries[0][0];
  let r = rng() * total;
  for (const [k, w] of entries) {
    r -= w;
    if (r <= 0) return k;
  }
  return entries[entries.length - 1][0];
}
