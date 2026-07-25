/**
 * Where the rarity gem sits in the name row.
 *
 * Two things used to go wrong. The gem was centred on the *name text* while the
 * nameplate bar is positioned independently, so it rode ~2 px high in the bar;
 * and its right edge was placed at exactly `cardWidth - pad`, which is the bar's
 * own edge — so the circle's 1.25 px stroke, plus the inward curve of the bar's
 * rounded corner, pushed it visibly outside the bar outline.
 */

export type GemBar = {
  /** Bar top, in the same coordinate space as the gem. */
  top: number;
  height: number;
  /** Corner radius used by `drawNameplateBar`. */
  radius: number;
};

export type GemPlacementInput = {
  cardWidth: number;
  pad: number;
  gemSize: number;
  /** Width of the circle's outline; half of it sits outside the radius. */
  strokeWidth: number;
  /** Vertical centre of the name text — used only when there is no bar. */
  textCenterY: number;
  bar?: GemBar;
};

export type GemPlacement = {
  centerX: number;
  centerY: number;
  /** Left edge, for callers that lay out from the gem's box. */
  left: number;
};

/**
 * X of the bar's right edge at height `y`. Along the straight section this is
 * `rightLimit`; within a corner radius it curves inward.
 */
export function barEdgeXAt(
  y: number,
  barTop: number,
  barHeight: number,
  radius: number,
  rightLimit: number,
): number {
  const d = Math.min(y - barTop, barTop + barHeight - y);
  if (d >= radius) return rightLimit;
  const dy = radius - Math.max(0, d);
  return rightLimit - radius + Math.sqrt(Math.max(0, radius * radius - dy * dy));
}

/**
 * Daylight left between the gem's stroke and the bar's inner border, at the
 * 420 px design width. Without it the gem sits flush against the border and
 * reads as cramped even though it is technically inside.
 */
export const GEM_BAR_CLEARANCE = 3;

/** How many points along the circle to test when fitting it against the bar. */
const FIT_SAMPLES = 48;

export function rarityGemPlacement(input: GemPlacementInput): GemPlacement {
  const { cardWidth, pad, gemSize, strokeWidth, textCenterY, bar } = input;
  const R = gemSize / 2;
  const halfStroke = strokeWidth / 2;
  const rightLimit = cardWidth - pad;

  const centerY = bar ? bar.top + bar.height / 2 : textCenterY;

  let centerX = rightLimit - halfStroke - R;
  if (bar) {
    // Walk the circle and keep the tightest constraint: at every height the
    // stroked edge must stay inside the bar, including around its corners.
    for (let i = 0; i <= FIT_SAMPLES; i++) {
      const y = centerY - R + (2 * R * i) / FIT_SAMPLES;
      const circleHalfW = Math.sqrt(Math.max(0, R * R - (y - centerY) ** 2));
      const edge = barEdgeXAt(y, bar.top, bar.height, bar.radius, rightLimit);
      centerX = Math.min(
        centerX,
        edge - circleHalfW - halfStroke - GEM_BAR_CLEARANCE,
      );
    }
  }

  return { centerX, centerY, left: centerX - R };
}

/** Outline width of the rarity gem; half of it falls outside the circle's radius. */
export const RARITY_GEM_STROKE = 1.25;

/**
 * Lighten (positive) or darken (negative) a `#rrggbb` colour, staying opaque.
 * Non-hex input is returned unchanged.
 */
export function shadeHex(hex: string, amount: number): string {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return hex;
  const n = parseInt(hex.slice(1), 16);
  const mix = (c: number) =>
    Math.round(
      amount >= 0 ? c + (255 - c) * amount : c * (1 + amount),
    );
  const clamp = (c: number) => Math.min(255, Math.max(0, c));
  const r = clamp(mix((n >> 16) & 255));
  const g = clamp(mix((n >> 8) & 255));
  const b = clamp(mix(n & 255));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

/**
 * Body gradient for the rarity gem.
 *
 * Every stop is opaque on purpose. The old inner stop was `#fff8` — white at
 * ~53% — which let the near-black card show through and read as a grey blob in
 * the middle of the gem, most obvious on the warm high rarities.
 */
export function gemGradientStops(primary: string): {
  inner: string;
  mid: string;
  outer: string;
} {
  return {
    inner: shadeHex(primary, 0.42),
    mid: primary,
    outer: shadeHex(primary, -0.72),
  };
}
