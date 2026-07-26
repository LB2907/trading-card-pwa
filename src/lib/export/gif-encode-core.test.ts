import { describe, expect, it } from "vitest";
import { applyPalette } from "gifenc";
import { parseGIF, decompressFrames } from "gifuct-js";
import {
  colorTableBits,
  createGifStream,
  createPaletteTrainer,
  decimateFrameDelays,
} from "@/lib/export/gif-encode-core";

const W = 48;
const H = 64;

/**
 * A frame shaped like a composited card: a fixed border and a fixed text bar
 * that never change, plus a moving block in the "art" window. Differencing
 * should find most of this identical between frames.
 */
function cardLikeFrame(t: number): Uint8ClampedArray {
  const rgba = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 4;
      const border = x < 4 || y < 4 || x >= W - 4 || y >= H - 4;
      const textBar = y >= H - 16 && !border;
      const inArt = !border && !textBar;
      const blockY = 8 + ((t * 5) % 24);
      const inBlock = inArt && y >= blockY && y < blockY + 8 && x >= 10 && x < 34;

      let r: number, g: number, b: number;
      if (border) [r, g, b] = [201, 168, 96];
      else if (textBar) [r, g, b] = [24, 22, 28];
      else if (inBlock) [r, g, b] = [220, 60 + t * 12, 120];
      else [r, g, b] = [40, 38, 46];

      rgba[o] = r;
      rgba[o + 1] = g;
      rgba[o + 2] = b;
      rgba[o + 3] = 255;
    }
  }
  return rgba;
}

function buildPalette(frames: Uint8ClampedArray[], maxColors: number) {
  const trainer = createPaletteTrainer({
    pixelCount: W * H,
    expectedFrames: frames.length,
    // Sample every pixel: the fixture has few colors and we want the palette to
    // contain all of them, so quantization is not what the round trip measures.
    sampleBudget: W * H * frames.length,
  });
  for (const f of frames) trainer.add(f);
  return trainer.build(maxColors);
}

function encode(
  frames: Uint8ClampedArray[],
  maxColors: number,
  difference: boolean,
): Uint8Array {
  const palette = buildPalette(frames, maxColors);
  const stream = createGifStream({
    width: W,
    height: H,
    palette,
    difference,
  });
  for (const f of frames) stream.addFrame(f, 100);
  return stream.finish();
}

/** Decode back to one full index-equivalent RGB image per frame. */
function decodeToRgb(bytes: Uint8Array): Uint8ClampedArray[] {
  const copy = new Uint8Array(bytes);
  const parsed = parseGIF(copy.buffer as ArrayBuffer);
  const decoded = decompressFrames(parsed, true);
  const out: Uint8ClampedArray[] = [];
  // gifuct-js hands back patches; compose them the way a viewer would.
  const canvas = new Uint8ClampedArray(W * H * 4);
  for (const frame of decoded) {
    const { left, top, width, height } = frame.dims;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const s = (y * width + x) * 4;
        // Alpha 0 means "transparent index" — leave whatever is underneath.
        if (frame.patch[s + 3] === 0) continue;
        const d = ((top + y) * W + (left + x)) * 4;
        canvas[d] = frame.patch[s];
        canvas[d + 1] = frame.patch[s + 1];
        canvas[d + 2] = frame.patch[s + 2];
        canvas[d + 3] = 255;
      }
    }
    out.push(canvas.slice());
  }
  return out;
}

/** What the frame looks like after palettization — the honest losslessness target. */
function palettized(
  rgba: Uint8ClampedArray,
  palette: number[][],
): Uint8ClampedArray {
  const index = applyPalette(rgba, palette);
  const out = new Uint8ClampedArray(rgba.length);
  for (let i = 0; i < index.length; i++) {
    const c = palette[index[i]];
    out[i * 4] = c[0];
    out[i * 4 + 1] = c[1];
    out[i * 4 + 2] = c[2];
    out[i * 4 + 3] = 255;
  }
  return out;
}

describe("createGifStream", () => {
  const frames = [0, 1, 2, 3, 4, 5].map(cardLikeFrame);

  it("round-trips every frame pixel-identically with differencing on", () => {
    const palette = buildPalette(frames, 255);
    const stream = createGifStream({ width: W, height: H, palette });
    for (const f of frames) stream.addFrame(f, 100);
    const decoded = decodeToRgb(stream.finish());

    expect(decoded).toHaveLength(frames.length);
    frames.forEach((frame, i) => {
      // Compare against the palettized source, not the raw RGBA: GIF cannot
      // hold 24-bit color, so palettization is the floor. What must be lossless
      // is the differencing on top of it.
      expect(Array.from(decoded[i])).toEqual(
        Array.from(palettized(frame, palette)),
      );
    });
  });

  it("produces identical output with and without differencing", () => {
    const withDiff = decodeToRgb(encode(frames, 255, true));
    const withoutDiff = decodeToRgb(encode(frames, 255, false));
    withDiff.forEach((f, i) => {
      expect(Array.from(f)).toEqual(Array.from(withoutDiff[i]));
    });
  });

  it("is smaller with differencing than without", () => {
    const diffed = encode(frames, 255, true);
    const plain = encode(frames, 255, false);
    expect(diffed.byteLength).toBeLessThan(plain.byteLength);
  });

  it("round-trips losslessly at a reduced palette too", () => {
    const palette = buildPalette(frames, 32);
    const stream = createGifStream({ width: W, height: H, palette });
    for (const f of frames) stream.addFrame(f, 100);
    const decoded = decodeToRgb(stream.finish());
    frames.forEach((frame, i) => {
      expect(Array.from(decoded[i])).toEqual(
        Array.from(palettized(frame, palette)),
      );
    });
  });

  it("handles a repeated frame without corrupting the next one", () => {
    const repeated = [cardLikeFrame(0), cardLikeFrame(0), cardLikeFrame(3)];
    const palette = buildPalette(repeated, 255);
    const stream = createGifStream({ width: W, height: H, palette });
    for (const f of repeated) stream.addFrame(f, 100);
    const decoded = decodeToRgb(stream.finish());
    repeated.forEach((frame, i) => {
      expect(Array.from(decoded[i])).toEqual(
        Array.from(palettized(frame, palette)),
      );
    });
  });

  it("encodes a single frame", () => {
    const palette = buildPalette([frames[0]], 255);
    const stream = createGifStream({ width: W, height: H, palette });
    stream.addFrame(frames[0], 100);
    const bytes = stream.finish();
    expect(bytes.byteLength).toBeGreaterThan(0);
    expect(decodeToRgb(bytes)).toHaveLength(1);
  });

  it("rejects a frame of the wrong size", () => {
    const palette = buildPalette(frames, 255);
    const stream = createGifStream({ width: W, height: H, palette });
    expect(() => stream.addFrame(new Uint8ClampedArray(16), 100)).toThrow(
      /expected/,
    );
  });

  it("rejects finishing with no frames", () => {
    const palette = buildPalette(frames, 255);
    const stream = createGifStream({ width: W, height: H, palette });
    expect(() => stream.finish()).toThrow(/no frames/);
  });
});

describe("createPaletteTrainer", () => {
  it("is deterministic for identical input", () => {
    const frames = [0, 1, 2].map(cardLikeFrame);
    expect(buildPalette(frames, 64)).toEqual(buildPalette(frames, 64));
  });

  it("never exceeds the requested color count", () => {
    const frames = [0, 1, 2, 3].map(cardLikeFrame);
    expect(buildPalette(frames, 16).length).toBeLessThanOrEqual(16);
  });

  it("throws rather than emitting an empty palette", () => {
    const trainer = createPaletteTrainer({ pixelCount: 100, expectedFrames: 1 });
    expect(() => trainer.build(64)).toThrow(/zero frames/);
  });
});

describe("colorTableBits", () => {
  it("sizes the LZW code width to the table", () => {
    expect(colorTableBits(4)).toBe(2);
    expect(colorTableBits(5)).toBe(3);
    expect(colorTableBits(33)).toBe(6);
    expect(colorTableBits(256)).toBe(8);
  });

  it("never goes below the 2-bit GIF minimum", () => {
    expect(colorTableBits(1)).toBe(2);
    expect(colorTableBits(2)).toBe(2);
  });
});

describe("decimateFrameDelays", () => {
  it("keeps everything at step 1", () => {
    const r = decimateFrameDelays([100, 80, 60], 1);
    expect(r.keptIndices).toEqual([0, 1, 2]);
    expect(r.delaysMs).toEqual([100, 80, 60]);
  });

  it("preserves total duration when dropping frames", () => {
    const delays = [100, 100, 100, 100, 100, 100, 100];
    const r = decimateFrameDelays(delays, 3);
    expect(r.keptIndices).toEqual([0, 3, 6]);
    expect(r.delaysMs.reduce((a, b) => a + b, 0)).toBe(
      delays.reduce((a, b) => a + b, 0),
    );
  });

  it("folds a ragged tail into the last kept frame", () => {
    const r = decimateFrameDelays([50, 60, 70, 80, 90], 2);
    expect(r.keptIndices).toEqual([0, 2, 4]);
    expect(r.delaysMs).toEqual([110, 150, 90]);
  });
});
