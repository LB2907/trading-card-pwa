/**
 * Keeps the export watermark legible wherever it lands.
 *
 * A single fixed white-on-transparent mark disappears over the bright art
 * window and only reads over the near-black frame. Sampling the composited
 * card into a small luminance probe lets each tile pick the tone that actually
 * shows against what is behind it, which buys visibility without raising alpha
 * to the point where the mark defaces the card.
 */

export type WatermarkAlpha = {
  /** Opacity of the mark itself. */
  fill: number;
  /** Opacity of the 1 px offset copy that separates it from the background. */
  halo: number;
};

export const WATERMARK_ALPHA: Record<"card" | "sheet", WatermarkAlpha> = {
  card: { fill: 0.1, halo: 0.085 },
  sheet: { fill: 0.16, halo: 0.13 },
};

/** Luminance above this reads as a bright background and flips the ink dark. */
const FLIP_AT = 0.55;

export type LuminanceProbe = {
  w: number;
  h: number;
  /** Row-major perceived luminance, 0..1. */
  cells: Float32Array;
};

/** Perceived luminance of one RGB triple, 0..1 (Rec. 601 weights). */
function luminance(r: number, g: number, b: number): number {
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

/** Reduce an RGBA buffer to a per-cell luminance grid. */
export function buildLuminanceProbe(
  data: Uint8ClampedArray,
  w: number,
  h: number,
): LuminanceProbe {
  const cells = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    cells[i] = luminance(data[i * 4], data[i * 4 + 1], data[i * 4 + 2]);
  }
  return { w, h, cells };
}

/** Sample the probe at normalized coordinates; out-of-range clamps to the edge. */
export function probeLuminanceAt(
  probe: LuminanceProbe,
  u: number,
  v: number,
): number {
  if (probe.w < 1 || probe.h < 1) return 0;
  const cx = Math.min(probe.w - 1, Math.max(0, Math.floor(u * probe.w)));
  const cy = Math.min(probe.h - 1, Math.max(0, Math.floor(v * probe.h)));
  const l = probe.cells[cy * probe.w + cx];
  return Number.isFinite(l) ? l : 0;
}

export type WatermarkInk = {
  /** Colour of the mark. */
  ink: string;
  /** Colour of the offset copy drawn beneath it. */
  halo: string;
};

/** Pick ink and halo colours that stay readable at the given background luminance. */
export function watermarkInkForLuminance(
  bgLuminance: number,
  alpha: WatermarkAlpha,
): WatermarkInk {
  return bgLuminance > FLIP_AT
    ? {
        ink: `rgba(0,0,0,${alpha.fill})`,
        halo: `rgba(255,255,255,${alpha.halo})`,
      }
    : {
        ink: `rgba(255,255,255,${alpha.fill})`,
        halo: `rgba(0,0,0,${alpha.halo})`,
      };
}

/**
 * Where a tile drawn at (x, y) in the rotated, centre-translated watermark
 * space actually lands on the card, so its background can be sampled.
 */
export function tileCenterInCardSpace(
  x: number,
  y: number,
  rectW: number,
  rectH: number,
  angleRad: number,
): { x: number; y: number } {
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);
  return {
    x: rectW / 2 + x * cos - y * sin,
    y: rectH / 2 + x * sin + y * cos,
  };
}
