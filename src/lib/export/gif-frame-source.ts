"use client";

/**
 * Decoding a source GIF into full logical-screen frames.
 *
 * Shared by the GIF encoder and the GIF→video recorder: both need the same
 * disposal-correct walk over the source, and neither should own it.
 */

import { parseGIF, decompressFrames } from "gifuct-js";
import type { ParsedGif, ParsedFrame } from "gifuct-js";

/** Frames actually encoded. Bounds encode time and output size. */
export const MAX_GIF_FRAMES = 280;

/**
 * Source frames decoded. Higher than `MAX_GIF_FRAMES` so the Frames knob can
 * bring a long GIF under the encode cap, but still bounded — decoding is not
 * free either.
 */
export const MAX_GIF_SOURCE_FRAMES = MAX_GIF_FRAMES * 4;

export type DecodedGif = {
  parsed: ParsedGif;
  frames: ParsedFrame[];
  /** Per-frame delays, floored the way browsers treat them. */
  delaysMs: number[];
};

function rgbFillFromGifBackground(gif: ParsedGif): string {
  const idx = gif.lsd.backgroundColorIndex ?? 0;
  const c = gif.gct[idx] ?? [0, 0, 0];
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

/** Browsers clamp absurd delays; match that so timing is what the user sees. */
export function normalizeGifDelay(delay: number): number {
  return Math.max(20, Math.min(delay || 100, 60_000));
}

export async function decodeGif(blob: Blob): Promise<DecodedGif> {
  const parsed = parseGIF(await blob.arrayBuffer());
  const frames = decompressFrames(parsed, true);
  if (frames.length === 0) {
    throw new Error("This GIF contains no frames.");
  }
  if (frames.length > MAX_GIF_SOURCE_FRAMES) {
    throw new Error(
      `This GIF has ${frames.length} frames (max ${MAX_GIF_SOURCE_FRAMES}). Trim the GIF first.`,
    );
  }
  return {
    parsed,
    frames,
    delaysMs: frames.map((f) => normalizeGifDelay(f.delay)),
  };
}

/**
 * Walk decoded GIF frames into full logical-screen bitmaps
 * (disposal 1 = cumulative, 2 = clear before draw).
 *
 * Every frame must be composed even when only a sample is wanted, because each
 * one builds on the last — hence `wanted`, which decides whether to pay for the
 * `createImageBitmap` rather than whether to advance the accumulator.
 */
export async function* fullFramesFromGif(
  gif: ParsedGif,
  frames: ParsedFrame[],
  wanted: (index: number) => boolean = () => true,
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
