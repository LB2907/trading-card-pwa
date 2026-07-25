import { createCanvas } from "@napi-rs/canvas";
import { describe, expect, it } from "vitest";
import { drawExportWatermarkOnRect } from "@/lib/compositor/draw-card";
import { buildLuminanceProbe } from "@/lib/compositor/watermark-ink";

const W = 420;
const H = 588;

function probeOf(level: number) {
  const w = 8;
  const h = 11;
  const d = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    d[i * 4] = level;
    d[i * 4 + 1] = level;
    d[i * 4 + 2] = level;
    d[i * 4 + 3] = 255;
  }
  return buildLuminanceProbe(d, w, h);
}

/** Paint the watermark over a flat background and return the pixels. */
function paint(bg: number, probe?: Parameters<typeof drawExportWatermarkOnRect>[5]) {
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;
  ctx.fillStyle = `rgb(${bg},${bg},${bg})`;
  ctx.fillRect(0, 0, W, H);
  drawExportWatermarkOnRect(ctx, W, H, "@studio", "card", probe);
  return (ctx.getImageData(0, 0, W, H) as ImageData).data;
}

/** Mean absolute difference from the flat background — how much ink landed overall. */
function contrastAgainst(pixels: Uint8ClampedArray, bg: number): number {
  let sum = 0;
  const n = pixels.length / 4;
  for (let i = 0; i < n; i++) sum += Math.abs(pixels[i * 4] - bg);
  return sum / n;
}

/**
 * How strongly the strongest pixel departs from the background. This tracks
 * whether the glyph *body* contrasts, rather than only its offset halo fringe.
 */
function peakDeviation(pixels: Uint8ClampedArray, bg: number): number {
  let peak = 0;
  const n = pixels.length / 4;
  for (let i = 0; i < n; i++) {
    const d = Math.abs(pixels[i * 4] - bg);
    if (d > peak) peak = d;
  }
  return peak;
}

describe("watermark rendering", () => {
  it("puts solid ink on the glyph body over bright art, not just a halo fringe", () => {
    // Without the probe the mark is white-on-bright: only its dark offset
    // halo registers. The probe must flip the glyph itself dark.
    const adaptive = peakDeviation(paint(240, probeOf(240)), 240);
    const fixedWhite = peakDeviation(paint(240), 240);
    expect(adaptive).toBeGreaterThan(fixedWhite);
    // Ink at 10% over a 240 background lands near 216 — a ~24 level drop.
    expect(adaptive).toBeGreaterThan(18);
  });

  it("still marks a dark background", () => {
    expect(contrastAgainst(paint(12, probeOf(12)), 12)).toBeGreaterThan(0.15);
  });

  it("is more visible than the previous fixed-alpha mark", () => {
    // Old constants were fill 0.055 / halo 0.045. Over a 12-level background,
    // white ink lifts pixels by alpha × (255 − 12): ~13 levels at 5.5%,
    // ~24 at 10%.
    expect(peakDeviation(paint(12, probeOf(12)), 12)).toBeGreaterThan(18);
  });

  it("does not black out the card", () => {
    // A sheen, not a scrim: most of the face is untouched.
    expect(contrastAgainst(paint(12, probeOf(12)), 12)).toBeLessThan(12);
    expect(peakDeviation(paint(12, probeOf(12)), 12)).toBeLessThan(60);
  });

  it("draws nothing for empty text", () => {
    expect(contrastAgainst(paint(12, probeOf(12)), 12)).toBeGreaterThan(0);
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;
    ctx.fillStyle = "rgb(12,12,12)";
    ctx.fillRect(0, 0, W, H);
    drawExportWatermarkOnRect(ctx, W, H, "   ", "card", probeOf(12));
    const d = (ctx.getImageData(0, 0, W, H) as ImageData).data;
    expect(contrastAgainst(d, 12)).toBe(0);
  });
});
