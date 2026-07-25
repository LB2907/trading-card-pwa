import { describe, expect, it } from "vitest";
import {
  buildLuminanceProbe,
  probeLuminanceAt,
  tileCenterInCardSpace,
  watermarkInkForLuminance,
  WATERMARK_ALPHA,
} from "@/lib/compositor/watermark-ink";

/** RGBA buffer of a uniform colour, w×h. */
function solid(w: number, h: number, r: number, g: number, b: number) {
  const d = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    d[i * 4] = r;
    d[i * 4 + 1] = g;
    d[i * 4 + 2] = b;
    d[i * 4 + 3] = 255;
  }
  return d;
}

describe("luminance probe", () => {
  it("reads a dark surface as low luminance", () => {
    const probe = buildLuminanceProbe(solid(4, 4, 10, 10, 12), 4, 4);
    expect(probeLuminanceAt(probe, 0.5, 0.5)).toBeLessThan(0.1);
  });

  it("reads a bright surface as high luminance", () => {
    const probe = buildLuminanceProbe(solid(4, 4, 240, 236, 225), 4, 4);
    expect(probeLuminanceAt(probe, 0.5, 0.5)).toBeGreaterThan(0.85);
  });

  it("resolves luminance locally, not as a whole-image average", () => {
    // Left half black, right half white.
    const w = 4;
    const h = 2;
    const d = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const v = x < w / 2 ? 0 : 255;
        const i = (y * w + x) * 4;
        d[i] = v;
        d[i + 1] = v;
        d[i + 2] = v;
        d[i + 3] = 255;
      }
    }
    const probe = buildLuminanceProbe(d, w, h);
    expect(probeLuminanceAt(probe, 0.1, 0.5)).toBeLessThan(0.1);
    expect(probeLuminanceAt(probe, 0.9, 0.5)).toBeGreaterThan(0.9);
  });

  it("clamps out-of-range sample coordinates instead of reading garbage", () => {
    const probe = buildLuminanceProbe(solid(4, 4, 10, 10, 12), 4, 4);
    expect(probeLuminanceAt(probe, -3, 9)).toBeLessThan(0.1);
    expect(Number.isFinite(probeLuminanceAt(probe, -3, 9))).toBe(true);
  });
});

describe("adaptive watermark ink", () => {
  it("paints light ink over a dark background", () => {
    const ink = watermarkInkForLuminance(0.05, WATERMARK_ALPHA.card);
    expect(ink.ink).toContain("255,255,255");
    expect(ink.halo).toContain("0,0,0");
  });

  it("flips to dark ink over a bright background", () => {
    const ink = watermarkInkForLuminance(0.92, WATERMARK_ALPHA.card);
    expect(ink.ink).toContain("0,0,0");
    expect(ink.halo).toContain("255,255,255");
  });

  it("is more opaque than the previous fixed 5.5% mark", () => {
    // The old constants were fill 0.055 / shadow 0.045 on every tile.
    expect(WATERMARK_ALPHA.card.fill).toBeGreaterThan(0.055);
    expect(WATERMARK_ALPHA.card.halo).toBeGreaterThan(0.045);
  });

  it("keeps the mark a sheen, not a blackout", () => {
    expect(WATERMARK_ALPHA.card.fill).toBeLessThanOrEqual(0.16);
  });

  it("carries the requested alpha into the emitted colours", () => {
    const ink = watermarkInkForLuminance(0.05, { fill: 0.2, halo: 0.1 });
    expect(ink.ink).toBe("rgba(255,255,255,0.2)");
    expect(ink.halo).toBe("rgba(0,0,0,0.1)");
  });
});

describe("tile position mapping", () => {
  const R = (deg: number) => (deg * Math.PI) / 180;

  it("maps the origin of the rotated space to the rect centre", () => {
    const p = tileCenterInCardSpace(0, 0, 420, 588, R(-26));
    expect(p.x).toBeCloseTo(210, 5);
    expect(p.y).toBeCloseTo(294, 5);
  });

  it("rotates an offset tile by the given angle", () => {
    // At -26°, a tile one unit along +x lands up and to the right.
    const p = tileCenterInCardSpace(100, 0, 420, 588, R(-26));
    expect(p.x).toBeCloseTo(210 + 100 * Math.cos(R(-26)), 5);
    expect(p.y).toBeCloseTo(294 + 100 * Math.sin(R(-26)), 5);
    expect(p.y).toBeLessThan(294);
  });

  it("is the identity mapping at zero rotation", () => {
    const p = tileCenterInCardSpace(30, -40, 420, 588, 0);
    expect(p.x).toBeCloseTo(240, 5);
    expect(p.y).toBeCloseTo(254, 5);
  });
});
