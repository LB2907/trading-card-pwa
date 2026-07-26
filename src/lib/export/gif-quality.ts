/**
 * Quality controls → encoder parameters.
 *
 * A GIF of a 24-bit canvas render can never be "lossless" in the absolute sense
 * — the format caps at 256 colors per frame. What is lossless here is the *top
 * of each control*: at 10 the encoder uses the full palette, every frame and
 * full size, and only spends the byte savings that change no pixel (frame
 * differencing, one shared color table).
 *
 * Each axis has its own control, because they trade completely different things
 * and the right setting for one says nothing about the right setting for
 * another. A long looping GIF wants fewer frames at full color; a short one with
 * flat art wants fewer colors at every frame.
 */

/** The independent axes the user can spend quality on. */
export type GifQualityKnob = "colors" | "frames" | "scale";

export const GIF_QUALITY_KNOBS: readonly GifQualityKnob[] = [
  "colors",
  "frames",
  "scale",
] as const;

export const GIF_QUALITY_MIN = 1;
export const GIF_QUALITY_MAX = 10;

/** The level at which an axis costs nothing. */
export const GIF_QUALITY_LOSSLESS = GIF_QUALITY_MAX;

/**
 * Palette size at each level. Index 0 is level 1.
 *
 * Tops out at 255, not 256: differencing reserves one index for transparency.
 */
const COLORS_BY_LEVEL = [32, 48, 64, 80, 96, 128, 160, 192, 224, 255] as const;

/** Keep every Nth frame. Index 0 is level 1. */
const FRAME_STEP_BY_LEVEL = [4, 4, 3, 3, 2, 2, 2, 1, 1, 1] as const;

/** Linear dimension multiplier. Index 0 is level 1. */
const SCALE_BY_LEVEL = [
  0.4, 0.5, 0.55, 0.65, 0.7, 0.8, 0.85, 0.9, 0.95, 1,
] as const;

/** One level per axis, each 1–10. */
export type GifQualityLevels = Record<GifQualityKnob, number>;

export const LOSSLESS_QUALITY_LEVELS: GifQualityLevels = {
  colors: GIF_QUALITY_LOSSLESS,
  frames: GIF_QUALITY_LOSSLESS,
  scale: GIF_QUALITY_LOSSLESS,
};

export type GifEncodeParams = {
  /** Real colors in the palette. One further index is reserved for transparency. */
  maxColors: number;
  /** Keep every Nth source frame; dropped frames' delays fold into the kept one. */
  frameStep: number;
  /** Linear scale applied to the composited card. */
  scale: number;
};

export const LOSSLESS_ENCODE_PARAMS: GifEncodeParams = {
  maxColors: 255,
  frameStep: 1,
  scale: 1,
};

export function clampQualityLevel(level: number): number {
  if (!Number.isFinite(level)) return GIF_QUALITY_MAX;
  return Math.min(GIF_QUALITY_MAX, Math.max(GIF_QUALITY_MIN, Math.round(level)));
}

/** Resolve per-axis levels to encoder parameters. */
export function resolveEncodeParams(
  levels: GifQualityLevels,
): GifEncodeParams {
  return {
    maxColors: COLORS_BY_LEVEL[clampQualityLevel(levels.colors) - 1],
    frameStep: FRAME_STEP_BY_LEVEL[clampQualityLevel(levels.frames) - 1],
    scale: SCALE_BY_LEVEL[clampQualityLevel(levels.scale) - 1],
  };
}

export function isLosslessParams(p: GifEncodeParams): boolean {
  return (
    p.maxColors === LOSSLESS_ENCODE_PARAMS.maxColors &&
    p.frameStep === LOSSLESS_ENCODE_PARAMS.frameStep &&
    p.scale === LOSSLESS_ENCODE_PARAMS.scale
  );
}

export function isLosslessLevels(levels: GifQualityLevels): boolean {
  return GIF_QUALITY_KNOBS.every(
    (k) => clampQualityLevel(levels[k]) === GIF_QUALITY_LOSSLESS,
  );
}

/** Stable cache key for a set of parameters plus the watermark that was baked in. */
export function encodeParamsKey(
  p: GifEncodeParams,
  watermarkText: string,
): string {
  return `${p.maxColors}|${p.frameStep}|${p.scale}|${watermarkText}`;
}

/**
 * What a level actually means on each axis, for the value shown beside its
 * slider. Vague sliders make people guess; these are the real numbers.
 */
export function describeKnobLevel(
  knob: GifQualityKnob,
  level: number,
): string {
  const l = clampQualityLevel(level);
  const params = resolveEncodeParams({ ...LOSSLESS_QUALITY_LEVELS, [knob]: l });
  switch (knob) {
    case "colors":
      return `${params.maxColors} colors`;
    case "frames":
      return params.frameStep === 1
        ? "every frame"
        : `every ${params.frameStep}${params.frameStep === 2 ? "nd" : params.frameStep === 3 ? "rd" : "th"} frame`;
    case "scale":
      return params.scale === 1
        ? "full size"
        : `${Math.round(params.scale * 100)}% size`;
  }
}

export const GIF_KNOB_LABELS: Record<
  GifQualityKnob,
  { label: string; hint: string }
> = {
  colors: {
    label: "Colors",
    hint: "255 → 32. Gradients and foil band first; text stays sharp.",
  },
  frames: {
    label: "Frames",
    hint: "Drops frames and lengthens the rest. Choppier motion, nothing blurs.",
  },
  scale: {
    label: "Size",
    hint: "Scales the whole card down. Card name and ability text go soft fast.",
  },
};
