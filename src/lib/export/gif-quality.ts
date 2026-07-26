/**
 * Quality slider → encoder parameters.
 *
 * A GIF of a 24-bit canvas render can never be "lossless" in the absolute sense
 * — the format caps at 256 colors per frame. What is lossless here is the *top
 * of the slider*: level 10 encodes at full palette, every frame, full size, and
 * only spends the byte savings that change no pixel (frame differencing, one
 * shared color table). Everything below 10 trades something visible, and only
 * through knobs the user has explicitly switched on.
 */

/** What the slider is permitted to sacrifice. Opt-in, per export. */
export type GifQualityKnob = "colors" | "frames" | "scale";

export const GIF_QUALITY_KNOBS: readonly GifQualityKnob[] = [
  "colors",
  "frames",
  "scale",
] as const;

export const GIF_QUALITY_MIN = 1;
export const GIF_QUALITY_MAX = 10;

/** The level at which every knob resolves to its lossless value. */
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

export type GifQualitySettings = {
  /** 1–10; 10 is lossless. */
  level: number;
  /** Knobs the user switched on. Empty means lossless regardless of `level`. */
  knobs: readonly GifQualityKnob[];
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

/**
 * Resolve the slider to encoder parameters. A knob that is off holds its
 * lossless value no matter where the slider sits.
 */
export function resolveEncodeParams(
  settings: GifQualitySettings,
): GifEncodeParams {
  const level = clampQualityLevel(settings.level);
  const i = level - 1;
  const on = (k: GifQualityKnob) => settings.knobs.includes(k);
  return {
    maxColors: on("colors")
      ? COLORS_BY_LEVEL[i]
      : LOSSLESS_ENCODE_PARAMS.maxColors,
    frameStep: on("frames")
      ? FRAME_STEP_BY_LEVEL[i]
      : LOSSLESS_ENCODE_PARAMS.frameStep,
    scale: on("scale") ? SCALE_BY_LEVEL[i] : LOSSLESS_ENCODE_PARAMS.scale,
  };
}

export function isLosslessParams(p: GifEncodeParams): boolean {
  return (
    p.maxColors === LOSSLESS_ENCODE_PARAMS.maxColors &&
    p.frameStep === LOSSLESS_ENCODE_PARAMS.frameStep &&
    p.scale === LOSSLESS_ENCODE_PARAMS.scale
  );
}

/** Stable cache key for a set of parameters plus the watermark that was baked in. */
export function encodeParamsKey(
  p: GifEncodeParams,
  watermarkText: string,
): string {
  return `${p.maxColors}|${p.frameStep}|${p.scale}|${watermarkText}`;
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
