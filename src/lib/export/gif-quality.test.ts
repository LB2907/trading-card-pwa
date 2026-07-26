import { describe, expect, it } from "vitest";
import {
  GIF_QUALITY_KNOBS,
  GIF_QUALITY_LOSSLESS,
  GIF_QUALITY_MAX,
  GIF_QUALITY_MIN,
  LOSSLESS_ENCODE_PARAMS,
  clampQualityLevel,
  encodeParamsKey,
  isLosslessParams,
  resolveEncodeParams,
  type GifQualityKnob,
} from "@/lib/export/gif-quality";

const ALL: GifQualityKnob[] = ["colors", "frames", "scale"];

/** Every subset of the knobs, so "level 10 is lossless" is checked exhaustively. */
function knobSubsets(): GifQualityKnob[][] {
  const out: GifQualityKnob[][] = [];
  for (let mask = 0; mask < 1 << ALL.length; mask++) {
    out.push(ALL.filter((_, i) => mask & (1 << i)));
  }
  return out;
}

const levels = Array.from(
  { length: GIF_QUALITY_MAX - GIF_QUALITY_MIN + 1 },
  (_, i) => GIF_QUALITY_MIN + i,
);

describe("resolveEncodeParams", () => {
  it("is lossless at level 10 for every knob combination", () => {
    for (const knobs of knobSubsets()) {
      const p = resolveEncodeParams({ level: GIF_QUALITY_LOSSLESS, knobs });
      expect(p, `knobs=${knobs.join(",") || "none"}`).toEqual(
        LOSSLESS_ENCODE_PARAMS,
      );
      expect(isLosslessParams(p)).toBe(true);
    }
  });

  it("is lossless at every level when no knob is enabled", () => {
    for (const level of levels) {
      expect(resolveEncodeParams({ level, knobs: [] })).toEqual(
        LOSSLESS_ENCODE_PARAMS,
      );
    }
  });

  it("only moves the knobs that are switched on", () => {
    const p = resolveEncodeParams({ level: 1, knobs: ["colors"] });
    expect(p.maxColors).toBeLessThan(LOSSLESS_ENCODE_PARAMS.maxColors);
    expect(p.frameStep).toBe(LOSSLESS_ENCODE_PARAMS.frameStep);
    expect(p.scale).toBe(LOSSLESS_ENCODE_PARAMS.scale);
  });

  it("degrades monotonically as the level drops", () => {
    for (let level = GIF_QUALITY_MAX; level > GIF_QUALITY_MIN; level--) {
      const hi = resolveEncodeParams({ level, knobs: ALL });
      const lo = resolveEncodeParams({ level: level - 1, knobs: ALL });
      expect(lo.maxColors).toBeLessThanOrEqual(hi.maxColors);
      expect(lo.frameStep).toBeGreaterThanOrEqual(hi.frameStep);
      expect(lo.scale).toBeLessThanOrEqual(hi.scale);
    }
  });

  it("never exceeds the 255 opaque colors differencing leaves available", () => {
    for (const level of levels) {
      const p = resolveEncodeParams({ level, knobs: ALL });
      expect(p.maxColors).toBeLessThanOrEqual(255);
      expect(p.maxColors).toBeGreaterThanOrEqual(2);
      expect(p.frameStep).toBeGreaterThanOrEqual(1);
      expect(p.scale).toBeGreaterThan(0);
      expect(p.scale).toBeLessThanOrEqual(1);
    }
  });

  it("clamps out-of-range levels instead of producing undefined params", () => {
    expect(resolveEncodeParams({ level: 0, knobs: ALL })).toEqual(
      resolveEncodeParams({ level: 1, knobs: ALL }),
    );
    expect(resolveEncodeParams({ level: 99, knobs: ALL })).toEqual(
      LOSSLESS_ENCODE_PARAMS,
    );
    expect(resolveEncodeParams({ level: Number.NaN, knobs: ALL })).toEqual(
      LOSSLESS_ENCODE_PARAMS,
    );
  });
});

describe("clampQualityLevel", () => {
  it("clamps and rounds", () => {
    expect(clampQualityLevel(-4)).toBe(GIF_QUALITY_MIN);
    expect(clampQualityLevel(4.4)).toBe(4);
    expect(clampQualityLevel(1000)).toBe(GIF_QUALITY_MAX);
  });

  it("falls back to lossless for junk", () => {
    expect(clampQualityLevel(Number.NaN)).toBe(GIF_QUALITY_MAX);
    expect(clampQualityLevel(Number.POSITIVE_INFINITY)).toBe(GIF_QUALITY_MAX);
  });
});

describe("encodeParamsKey", () => {
  it("separates settings that produce different output", () => {
    const a = resolveEncodeParams({ level: 5, knobs: ["colors"] });
    const b = resolveEncodeParams({ level: 5, knobs: ["frames"] });
    expect(encodeParamsKey(a, "@me")).not.toBe(encodeParamsKey(b, "@me"));
  });

  it("separates watermarked output from unwatermarked", () => {
    const p = LOSSLESS_ENCODE_PARAMS;
    expect(encodeParamsKey(p, "@me")).not.toBe(encodeParamsKey(p, ""));
  });

  it("collides only when the output really would be identical", () => {
    // Different knob sets, same resolved params — the cache should reuse.
    const a = resolveEncodeParams({ level: 10, knobs: ["colors"] });
    const b = resolveEncodeParams({ level: 10, knobs: ["scale"] });
    expect(encodeParamsKey(a, "@me")).toBe(encodeParamsKey(b, "@me"));
  });
});

describe("GIF_QUALITY_KNOBS", () => {
  it("matches the knobs resolveEncodeParams understands", () => {
    expect([...GIF_QUALITY_KNOBS].sort()).toEqual([...ALL].sort());
  });
});
