/**
 * GIF encoding core: one shared palette across the animation, plus
 * transparent-index frame differencing.
 *
 * Deliberately free of DOM and worker APIs so it runs identically on the main
 * thread, inside a worker, and under vitest in node — which is what lets the
 * round-trip losslessness test exercise the real thing.
 *
 * ## Why differencing pays here
 *
 * A composited trading card is mostly static: border, name, type line, ability
 * text and foil frame are byte-identical on every frame, and only the art window
 * moves. Writing those pixels as a reserved transparent index with
 * `dispose: 1` (leave the previous frame in place) leaves the decoded image
 * pixel-for-pixel identical while handing LZW long runs of one repeated symbol.
 *
 * The comparison is against the previous frame's *intended* index image rather
 * than the emitted one. Under `dispose: 1` a pixel displays the last
 * non-transparent index written to it, so the intended image is exactly what is
 * on screen. Frame 0 is fully opaque and covers the canvas, so every pixel is
 * defined from the first frame on and the GIF background never shows through.
 *
 * `gifenc` hardcodes `x=0, y=0` in the image descriptor, so bounding-box
 * sub-rectangles are not available without patching it; differencing captures
 * most of that win anyway.
 */

import { GIFEncoder, quantize } from "gifenc";

/** RGB triples. Index `length` of this array is reserved for transparency. */
export type GifPalette = number[][];

/** Upper bound on palette entries once the transparent slot is reserved. */
export const MAX_OPAQUE_COLORS = 255;

/**
 * Pixels sampled for palette training. Big enough that a 255-color palette is
 * well-conditioned, small enough that the buffer stays a few MB.
 */
const PALETTE_SAMPLE_BUDGET = 240_000;

/**
 * LZW minimum code size / logical-screen color depth for a table of `entries`.
 * A 32-color export writes 6-bit codes instead of 8-bit ones, which is free.
 */
export function colorTableBits(entries: number): number {
  let bits = 2;
  while (1 << bits < entries && bits < 8) bits++;
  return bits;
}

/**
 * Collects a representative pixel sample across frames so one palette can serve
 * the whole animation.
 *
 * Per-frame quantization — what this replaces — costs a 768-byte color table on
 * every frame and lands the same source color on slightly different RGB from
 * frame to frame, which shimmers on flat areas like the card border.
 */
export function createPaletteTrainer(opts: {
  /** Pixels per frame, used to pick a stride. */
  pixelCount: number;
  /** How many frames will be fed in. Only affects sample distribution. */
  expectedFrames: number;
  sampleBudget?: number;
}) {
  const budget = opts.sampleBudget ?? PALETTE_SAMPLE_BUDGET;
  const frames = Math.max(1, opts.expectedFrames);
  const pixels = Math.max(1, opts.pixelCount);
  const perFrame = Math.max(1, Math.ceil(budget / frames));
  // A prime-ish stride avoids sampling the same column of a repeating pattern.
  const stride = Math.max(1, Math.floor(pixels / perFrame));
  const chunks: Uint8ClampedArray[] = [];
  let sampled = 0;

  return {
    stride,
    add(rgba: Uint8ClampedArray): void {
      const take = Math.floor((rgba.length / 4 + stride - 1) / stride);
      const out = new Uint8ClampedArray(take * 4);
      let w = 0;
      for (let p = 0; p < rgba.length / 4; p += stride) {
        const s = p * 4;
        out[w++] = rgba[s];
        out[w++] = rgba[s + 1];
        out[w++] = rgba[s + 2];
        out[w++] = rgba[s + 3];
      }
      chunks.push(w === out.length ? out : out.subarray(0, w));
      sampled += w / 4;
    },
    get sampleCount(): number {
      return sampled;
    },
    /**
     * Flatten the collected samples into one buffer. Split out from `build` so
     * the caller can ship it to a worker and quantize off the main thread.
     */
    mergedSamples(): Uint8ClampedArray {
      const total = chunks.reduce((n, c) => n + c.length, 0);
      if (total === 0) {
        throw new Error("Cannot build a GIF palette from zero frames.");
      }
      const merged = new Uint8ClampedArray(total);
      let at = 0;
      for (const c of chunks) {
        merged.set(c, at);
        at += c.length;
      }
      return merged;
    },
    build(maxColors: number): GifPalette {
      return quantizeSamples(this.mergedSamples(), maxColors);
    },
  };
}

/** Quantize a sample buffer to at most `maxColors`, leaving room for transparency. */
export function quantizeSamples(
  samples: Uint8ClampedArray,
  maxColors: number,
): GifPalette {
  if (samples.length === 0) {
    throw new Error("Cannot build a GIF palette from zero frames.");
  }
  const cap = Math.min(MAX_OPAQUE_COLORS, Math.max(2, Math.floor(maxColors)));
  return quantize(samples, cap);
}

/** rgb565 bucket for a color. Matches the bucketing gifenc already used. */
function rgb565Key(r: number, g: number, b: number): number {
  return ((r >> 3) << 11) | ((g >> 2) << 5) | (b >> 3);
}

/**
 * The canonical color of a bucket, expanded back to 8 bits per channel. High
 * bits are replicated into the low ones so a full bucket maps to 255, not 248.
 */
function keyToRgb(key: number): [number, number, number] {
  const r = (key >> 11) & 0x1f;
  const g = (key >> 5) & 0x3f;
  const b = key & 0x1f;
  return [(r << 3) | (r >> 2), (g << 2) | (g >> 4), (b << 3) | (b >> 2)];
}

function nearestIndexForKey(key: number, palette: GifPalette): number {
  const [r, g, b] = keyToRgb(key);
  let best = 0;
  let bestDistance = Infinity;
  for (let i = 0; i < palette.length; i++) {
    const dr = r - palette[i][0];
    const dg = g - palette[i][1];
    const db = b - palette[i][2];
    const d = dr * dr + dg * dg + db * db;
    if (d < bestDistance) {
      bestDistance = d;
      best = i;
    }
  }
  return best;
}

/**
 * Maps RGBA to palette indices such that the same color always yields the same
 * index — across pixels, across frames, whatever else is in the image.
 *
 * This replaces gifenc's `applyPalette`, which is *not* stable in that way and
 * was the cause of a visible flicker. Its cache is keyed on the rgb565 bucket
 * but stores the nearest match for the **exact color of whichever pixel reached
 * that bucket first in scan order**. Several distinct colors share a bucket, so
 * when the art changed, a different color seeded the bucket and every later
 * pixel using that key — including completely static card chrome — was handed a
 * different palette index. Differencing then had nothing to eliminate and the
 * card border, name and text crawled between frames.
 *
 * Measured on a real card: with `applyPalette`, pixels whose RGB was identical
 * between two frames still changed index right across the card
 * (x[3..836] y[28..1172] of an 840×1176 export). With this mapper the changes
 * collapse to exactly the art window (x[49..790] y[28..769]) — the region whose
 * pixels genuinely differ.
 *
 * The index is derived from the bucket alone, so it is a pure function of the
 * key and the cache is plain memoization. Buckets are filled lazily, keeping a
 * single-frame still as cheap as it was.
 */
export function createPaletteMapper(
  palette: GifPalette,
): (rgba: Uint8ClampedArray) => Uint8Array {
  const cache = new Int16Array(65536).fill(-1);
  return function mapFrame(rgba: Uint8ClampedArray): Uint8Array {
    const pixels = rgba.length >> 2;
    const out = new Uint8Array(pixels);
    for (let p = 0; p < pixels; p++) {
      const o = p << 2;
      const key = rgb565Key(rgba[o], rgba[o + 1], rgba[o + 2]);
      let idx = cache[key];
      if (idx < 0) {
        idx = nearestIndexForKey(key, palette);
        cache[key] = idx;
      }
      out[p] = idx;
    }
    return out;
  };
}

export type GifStream = {
  addFrame(rgba: Uint8ClampedArray, delayMs: number): void;
  finish(): Uint8Array;
  /** Frames emitted so far. */
  readonly frameCount: number;
};

export type GifStreamOptions = {
  width: number;
  height: number;
  palette: GifPalette;
  /**
   * Off only so tests can measure what differencing is worth. Production always
   * leaves this on — it costs nothing and changes no decoded pixel.
   */
  difference?: boolean;
  /** GIF loop count: 0 = forever, -1 = once. */
  repeat?: number;
};

/**
 * Incremental encoder. Frames are handed in one at a time and released
 * immediately, so peak memory is one frame rather than the whole animation —
 * a 280-frame card at full size would otherwise be over a gigabyte of RGBA.
 */
export function createGifStream(options: GifStreamOptions): GifStream {
  const { width, height, palette } = options;
  const difference = options.difference ?? true;
  const repeat = options.repeat ?? 0;

  if (!Number.isInteger(width) || width < 1 || !Number.isInteger(height) || height < 1) {
    throw new Error("Invalid GIF dimensions.");
  }
  if (palette.length < 1 || palette.length > MAX_OPAQUE_COLORS) {
    throw new Error(
      `GIF palette must hold 1–${MAX_OPAQUE_COLORS} colors (got ${palette.length}).`,
    );
  }

  const transparentIndex = palette.length;
  // One sentinel entry past the real colors. The mapper only ever sees the
  // opaque palette, so it can never emit this index by accident — we write it
  // ourselves, and only for pixels that did not change.
  const tablePalette: GifPalette = [...palette, [0, 0, 0]];
  const colorDepth = colorTableBits(tablePalette.length);

  const gif = GIFEncoder();
  // One mapper for the whole animation: a colour must resolve to the same index
  // in every frame, or static pixels stop differencing away and visibly crawl.
  const mapFrame = createPaletteMapper(palette);
  let previous: Uint8Array | null = null;
  let frameCount = 0;

  return {
    get frameCount() {
      return frameCount;
    },
    addFrame(rgba: Uint8ClampedArray, delayMs: number): void {
      if (rgba.length !== width * height * 4) {
        throw new Error(
          `Frame is ${rgba.length} bytes, expected ${width * height * 4}.`,
        );
      }
      // GIF stores delay in hundredths of a second; anything under 20ms is
      // clamped by browsers to ~100ms anyway, so keep the existing floor.
      const delay = Math.max(20, Math.min(Math.round(delayMs) || 100, 60_000));
      const index = mapFrame(rgba);

      if (!previous) {
        gif.writeFrame(index, width, height, {
          palette: tablePalette,
          delay,
          repeat,
          colorDepth,
        });
      } else if (!difference) {
        gif.writeFrame(index, width, height, { delay, colorDepth });
      } else {
        const out = new Uint8Array(index.length);
        for (let i = 0; i < index.length; i++) {
          out[i] = index[i] === previous[i] ? transparentIndex : index[i];
        }
        gif.writeFrame(out, width, height, {
          delay,
          colorDepth,
          transparent: true,
          transparentIndex,
          // 1 = do not dispose: leave this frame on screen so the transparent
          // pixels of the next one reveal it.
          dispose: 1,
        });
      }

      previous = index;
      frameCount++;
    },
    finish(): Uint8Array {
      if (frameCount === 0) {
        throw new Error("Cannot finish a GIF with no frames.");
      }
      gif.finish();
      return gif.bytes();
    },
  };
}

/**
 * Fold `frameStep` source frames into one, summing the delays so the animation
 * still runs for the same wall-clock duration — dropping frames without this
 * silently speeds the clip up.
 */
export function decimateFrameDelays(
  delaysMs: readonly number[],
  frameStep: number,
): { keptIndices: number[]; delaysMs: number[] } {
  const step = Math.max(1, Math.floor(frameStep));
  if (step === 1) {
    return { keptIndices: delaysMs.map((_, i) => i), delaysMs: [...delaysMs] };
  }
  const keptIndices: number[] = [];
  const out: number[] = [];
  for (let i = 0; i < delaysMs.length; i += step) {
    keptIndices.push(i);
    let sum = 0;
    for (let j = i; j < Math.min(i + step, delaysMs.length); j++) {
      sum += delaysMs[j];
    }
    out.push(sum);
  }
  return { keptIndices, delaysMs: out };
}
