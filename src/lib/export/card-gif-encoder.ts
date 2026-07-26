"use client";

/**
 * Composites a card to an animated GIF.
 *
 * Two passes over the source:
 *
 *  1. **Palette training** — composite a sparse sample of frames and subsample
 *     their pixels, then quantize once. One palette for the whole animation
 *     drops a 768-byte color table per frame and stops the same source color
 *     landing on slightly different RGB from frame to frame, which shimmers on
 *     flat areas like the card border.
 *  2. **Encode** — composite every kept frame and stream it to the encoder,
 *     which writes unchanged pixels as a transparent index (see
 *     `gif-encode-core`).
 *
 * Compositing twice is the price of a global palette at flat memory. Pass 1
 * draws roughly one frame in eight, so it costs a small fraction of pass 2 —
 * far cheaper than the alternative of holding every composited frame in RAM,
 * which for a 280-frame card would be over a gigabyte of RGBA.
 */

import { parseGIF, decompressFrames } from "gifuct-js";
import type { ParsedGif, ParsedFrame } from "gifuct-js";
import { cardCanvasSize, drawTradingCard } from "@/lib/compositor/draw-card";
import type { LuminanceProbe } from "@/lib/compositor/watermark-ink";
import { ensureCardFontsLoaded } from "@/lib/compositor/canvas-font";
import { parseLayout } from "@/lib/card-layout";
import {
  CARD_GIF_EXPORT_PIXEL_RATIO,
  CARD_LAYOUT_WIDTH,
} from "@/lib/compositor/card-resolution";
import { cardMediaMode, withPlaybackMime } from "@/lib/media/card-media-mode";
import { loadArtForCompositor } from "@/lib/media/compositor-source";
import { loadUserBlob } from "@/lib/media/storage";
import type { CardExportRow } from "@/lib/export/types";
import {
  createPaletteTrainer,
  decimateFrameDelays,
} from "@/lib/export/gif-encode-core";
import {
  createGifEncodeSession,
  type GifEncodeSession,
} from "@/lib/export/gif-encode-session";
import {
  LOSSLESS_ENCODE_PARAMS,
  type GifEncodeParams,
} from "@/lib/export/gif-quality";

/** Frames actually encoded. Bounds encode time and output size. */
export const MAX_GIF_FRAMES = 280;

/**
 * Source frames decoded. Higher than `MAX_GIF_FRAMES` so the Frames knob can
 * bring a long GIF under the encode cap, but still bounded — decoding is not
 * free either.
 */
export const MAX_GIF_SOURCE_FRAMES = MAX_GIF_FRAMES * 4;

/** Composite one frame in this many during palette training. */
const PALETTE_FRAME_STRIDE = 8;

export class CardGifExportAborted extends Error {
  constructor() {
    super("GIF export cancelled.");
    this.name = "CardGifExportAborted";
  }
}

export type CardGifProgress = {
  phase: "palette" | "encode";
  /** 0–1 within the current phase. */
  fraction: number;
  frame: number;
  totalFrames: number;
};

export type CardGifEncodeOptions = {
  watermarkText?: string;
  params?: GifEncodeParams;
  onProgress?: (p: CardGifProgress) => void;
  signal?: AbortSignal;
};

export type CardGifResult = {
  blob: Blob;
  bytes: number;
  width: number;
  height: number;
  /** Frames written, after any decimation. */
  frames: number;
  /** False when the encoder had to run on the main thread. */
  offThread: boolean;
};

function rgbFillFromGifBackground(gif: ParsedGif): string {
  const idx = gif.lsd.backgroundColorIndex ?? 0;
  const c = gif.gct[idx] ?? [0, 0, 0];
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

/**
 * Walk decoded GIF frames into full logical-screen bitmaps
 * (disposal 1 = cumulative, 2 = clear before draw).
 *
 * Every frame must be composed even when only a sample is wanted, because each
 * one builds on the last — hence `wanted`, which decides whether to pay for the
 * `createImageBitmap` rather than whether to advance the accumulator.
 */
async function* fullFramesFromGif(
  gif: ParsedGif,
  frames: ParsedFrame[],
  wanted: (index: number) => boolean,
): AsyncGenerator<{ index: number; bitmap: ImageBitmap }> {
  const w = gif.lsd.width;
  const h = gif.lsd.height;
  const bg = rgbFillFromGifBackground(gif);

  const acc = document.createElement("canvas");
  acc.width = w;
  acc.height = h;
  const accCtx = acc.getContext("2d", { willReadFrequently: true });
  if (!accCtx) throw new Error("Canvas unsupported");

  const patchCanvas = document.createElement("canvas");
  const patchCtx = patchCanvas.getContext("2d");
  if (!patchCtx) throw new Error("Canvas unsupported");

  accCtx.fillStyle = bg;
  accCtx.fillRect(0, 0, w, h);

  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i];
    if (i > 0 && frames[i - 1].disposalType === 2) {
      accCtx.fillStyle = bg;
      accCtx.fillRect(0, 0, w, h);
    }

    const d = frame.dims;
    patchCanvas.width = d.width;
    patchCanvas.height = d.height;
    const id = patchCtx.createImageData(d.width, d.height);
    id.data.set(frame.patch);
    patchCtx.putImageData(id, 0, 0);
    accCtx.drawImage(patchCanvas, d.left, d.top);

    if (wanted(i)) {
      yield { index: i, bitmap: await createImageBitmap(acc) };
    }
  }
}

/** GIF frame delays, floored the way browsers treat them. */
function sourceDelays(frames: ParsedFrame[]): number[] {
  return frames.map((f) => Math.max(20, Math.min(f.delay || 100, 60_000)));
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new CardGifExportAborted();
}

/**
 * Composite a card to GIF at the given quality parameters.
 *
 * Defaults to `LOSSLESS_ENCODE_PARAMS`: full palette, every frame, full size.
 */
export async function buildCardGif(
  row: CardExportRow,
  opts?: CardGifEncodeOptions,
): Promise<CardGifResult> {
  const params = opts?.params ?? LOSSLESS_ENCODE_PARAMS;
  const signal = opts?.signal;
  throwIfAborted(signal);

  await ensureCardFontsLoaded();
  const rawBlob = await loadUserBlob(row.instance.mediaPath);
  if (!rawBlob) {
    throw new Error("Art file missing from local storage — cannot render card.");
  }
  const layout = parseLayout(row.layoutJson);
  const typed = withPlaybackMime(rawBlob, row.instance.mediaPath);
  const mode = cardMediaMode(row.instance);
  const watermarkText = opts?.watermarkText;

  const pixelRatio = CARD_GIF_EXPORT_PIXEL_RATIO * params.scale;
  const { bufW, bufH } = cardCanvasSize(CARD_LAYOUT_WIDTH, pixelRatio);
  if (!Number.isFinite(bufW) || bufW < 1 || !Number.isFinite(bufH) || bufH < 1) {
    throw new Error("Invalid export dimensions.");
  }

  const canvas = document.createElement("canvas");
  canvas.width = bufW;
  canvas.height = bufH;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas unsupported");

  // Measured once and held: re-probing per frame costs a readback each time and
  // makes watermark tiles near the light/dark threshold flip tone as the art
  // moves. Shared across both passes so the palette is trained on the same ink
  // the encode pass will produce.
  let sharedProbe: LuminanceProbe | undefined;

  const composite = (art: CanvasImageSource): Uint8ClampedArray => {
    const probe = drawTradingCard(ctx, {
      instance: row.instance,
      layout,
      artImage: art,
      width: CARD_LAYOUT_WIDTH,
      pixelRatio,
      watermarkText,
      watermarkProbe: sharedProbe,
    });
    sharedProbe ??= probe;
    return ctx.getImageData(0, 0, bufW, bufH).data;
  };

  const session = await createGifEncodeSession();
  try {
    if (mode === "gif") {
      return await encodeAnimated(
        typed,
        { session, composite, params, bufW, bufH, signal },
        opts?.onProgress,
      );
    }
    return await encodeStill(
      typed,
      row,
      { session, composite, params, bufW, bufH, signal },
      opts?.onProgress,
    );
  } finally {
    session.dispose();
  }
}

type EncodeContext = {
  session: GifEncodeSession;
  composite: (art: CanvasImageSource) => Uint8ClampedArray;
  params: GifEncodeParams;
  bufW: number;
  bufH: number;
  signal?: AbortSignal;
};

function toBlob(bytes: Uint8Array): Blob {
  return new Blob([bytes.slice()], { type: "image/gif" });
}

async function encodeStill(
  typed: Blob,
  row: CardExportRow,
  ctx: EncodeContext,
  onProgress?: (p: CardGifProgress) => void,
): Promise<CardGifResult> {
  const { source, dispose } = await loadArtForCompositor(typed, row.instance);
  let rgba: Uint8ClampedArray;
  try {
    rgba = ctx.composite(source);
  } finally {
    dispose();
  }
  throwIfAborted(ctx.signal);

  onProgress?.({ phase: "palette", fraction: 1, frame: 0, totalFrames: 1 });
  const trainer = createPaletteTrainer({
    pixelCount: ctx.bufW * ctx.bufH,
    expectedFrames: 1,
  });
  trainer.add(rgba);
  const palette = await ctx.session.trainPalette(
    trainer.mergedSamples(),
    ctx.params.maxColors,
  );
  throwIfAborted(ctx.signal);

  await ctx.session.init({
    width: ctx.bufW,
    height: ctx.bufH,
    palette,
    difference: true,
  });
  await ctx.session.addFrame(rgba, 100);
  onProgress?.({ phase: "encode", fraction: 1, frame: 1, totalFrames: 1 });
  const bytes = await ctx.session.finish();

  return {
    blob: toBlob(bytes),
    bytes: bytes.byteLength,
    width: ctx.bufW,
    height: ctx.bufH,
    frames: 1,
    offThread: ctx.session.offThread,
  };
}

async function encodeAnimated(
  typed: Blob,
  ctx: EncodeContext,
  onProgress?: (p: CardGifProgress) => void,
): Promise<CardGifResult> {
  const parsed = parseGIF(await typed.arrayBuffer());
  const frames = decompressFrames(parsed, true);
  if (frames.length === 0) {
    throw new Error("This GIF contains no frames.");
  }
  if (frames.length > MAX_GIF_SOURCE_FRAMES) {
    throw new Error(
      `This GIF has ${frames.length} frames (max ${MAX_GIF_SOURCE_FRAMES}). Use video export for long clips, or trim the GIF.`,
    );
  }

  const { keptIndices, delaysMs } = decimateFrameDelays(
    sourceDelays(frames),
    ctx.params.frameStep,
  );
  if (keptIndices.length > MAX_GIF_FRAMES) {
    throw new Error(
      `This GIF would encode ${keptIndices.length} frames (max ${MAX_GIF_FRAMES}). Turn on the Frames quality knob to drop frames, or use video export.`,
    );
  }

  const keptSet = new Set(keptIndices);
  const total = keptIndices.length;

  // Pass 1 — palette training on a sparse sample of the kept frames. Frame 0 is
  // always included so the probe and the palette are established together.
  const sampled = keptIndices.filter(
    (_, n) => n === 0 || n % PALETTE_FRAME_STRIDE === 0,
  );
  const sampledSet = new Set(sampled);
  const trainer = createPaletteTrainer({
    pixelCount: ctx.bufW * ctx.bufH,
    expectedFrames: sampled.length,
  });

  let trained = 0;
  for await (const { bitmap } of fullFramesFromGif(parsed, frames, (i) =>
    sampledSet.has(i),
  )) {
    try {
      throwIfAborted(ctx.signal);
      trainer.add(ctx.composite(bitmap));
      trained++;
      onProgress?.({
        phase: "palette",
        fraction: sampled.length ? trained / sampled.length : 1,
        frame: trained,
        totalFrames: sampled.length,
      });
    } finally {
      bitmap.close();
    }
  }

  const palette = await ctx.session.trainPalette(
    trainer.mergedSamples(),
    ctx.params.maxColors,
  );
  throwIfAborted(ctx.signal);

  // Pass 2 — encode every kept frame against that palette.
  await ctx.session.init({
    width: ctx.bufW,
    height: ctx.bufH,
    palette,
    difference: true,
  });

  let written = 0;
  for await (const { bitmap } of fullFramesFromGif(parsed, frames, (i) =>
    keptSet.has(i),
  )) {
    let rgba: Uint8ClampedArray;
    try {
      throwIfAborted(ctx.signal);
      rgba = ctx.composite(bitmap);
    } finally {
      bitmap.close();
    }
    // Frames arrive in source order and the filter preserves it, so the count
    // written so far is this frame's slot in the decimated delay list.
    await ctx.session.addFrame(rgba, delaysMs[written] ?? 100);
    written++;
    onProgress?.({
      phase: "encode",
      fraction: total ? written / total : 1,
      frame: written,
      totalFrames: total,
    });
  }

  throwIfAborted(ctx.signal);
  const bytes = await ctx.session.finish();
  return {
    blob: toBlob(bytes),
    bytes: bytes.byteLength,
    width: ctx.bufW,
    height: ctx.bufH,
    frames: written,
    offThread: ctx.session.offThread,
  };
}
