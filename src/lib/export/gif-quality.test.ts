import { describe, expect, it } from "vitest";
import {
  GIF_QUALITY_KNOBS,
  GIF_QUALITY_LOSSLESS,
  GIF_QUALITY_MAX,
  GIF_QUALITY_MIN,
  LOSSLESS_ENCODE_PARAMS,
  LOSSLESS_QUALITY_LEVELS,
  clampQualityLevel,
  describeKnobLevel,
  encodeParamsKey,
  isLosslessLevels,
  isLosslessParams,
  resolveEncodeParams,
  type GifQualityKnob,
  type GifQualityLevels,
} from "@/lib/export/gif-quality";

const levels = Array.from(
  { length: GIF_QUALITY_MAX - GIF_QUALITY_MIN + 1 },
  (_, i) => GIF_QUALITY_MIN + i,
);

function only(knob: GifQualityKnob, level: number): GifQualityLevels {
  return { ...LOSSLESS_QUALITY_LEVELS, [knob]: level };
}

describe("resolveEncodeParams", () => {
  it("is lossless when every axis is at max", () => {
    const p = resolveEncodeParams(LOSSLESS_QUALITY_LEVELS);
    expect(p).toEqual(LOSSLESS_ENCODE_PARAMS);
    expect(isLosslessParams(p)).toBe(true);
  });

  it("moves only the axis that was lowered", () => {
    const colors = resolveEncodeParams(only("colors", 1));
    expect(colors.maxColors).toBeLessThan(LOSSLESS_ENCODE_PARAMS.maxColors);
    expect(colors.frameStep).toBe(LOSSLESS_ENCODE_PARAMS.frameStep);
    expect(colors.scale).toBe(LOSSLESS_ENCODE_PARAMS.scale);

    const frames = resolveEncodeParams(only("frames", 1));
    expect(frames.frameStep).toBeGreaterThan(LOSSLESS_ENCODE_PARAMS.frameStep);
    expect(frames.maxColors).toBe(LOSSLESS_ENCODE_PARAMS.maxColors);
    expect(frames.scale).toBe(LOSSLESS_ENCODE_PARAMS.scale);

    const scale = resolveEncodeParams(only("scale", 1));
    expect(scale.scale).toBeLessThan(LOSSLESS_ENCODE_PARAMS.scale);
    expect(scale.maxColors).toBe(LOSSLESS_ENCODE_PARAMS.maxColors);
    expect(scale.frameStep).toBe(LOSSLESS_ENCODE_PARAMS.frameStep);
  });

  it("leaves an axis lossless at level 10 whatever the others do", () => {
    for (const knob of GIF_QUALITY_KNOBS) {
      const all1 = { colors: 1, frames: 1, scale: 1, [knob]: 10 };
      const p = resolveEncodeParams(all1 as GifQualityLevels);
      const losslessValue = {
        colors: p.maxColors === LOSSLESS_ENCODE_PARAMS.maxColors,
        frames: p.frameStep === LOSSLESS_ENCODE_PARAMS.frameStep,
        scale: p.scale === LOSSLESS_ENCODE_PARAMS.scale,
      };
      expect(losslessValue[knob], knob).toBe(true);
    }
  });

  it("degrades monotonically as a level drops", () => {
    for (let level = GIF_QUALITY_MAX; level > GIF_QUALITY_MIN; level--) {
      const hi = resolveEncodeParams({
        colors: level,
        frames: level,
        scale: level,
      });
      const lo = resolveEncodeParams({
        colors: level - 1,
        frames: level - 1,
        scale: level - 1,
      });
      expect(lo.maxColors).toBeLessThanOrEqual(hi.maxColors);
      expect(lo.frameStep).toBeGreaterThanOrEqual(hi.frameStep);
      expect(lo.scale).toBeLessThanOrEqual(hi.scale);
    }
  });

  it("stays inside the range the encoder accepts", () => {
    for (const level of levels) {
      const p = resolveEncodeParams({
        colors: level,
        frames: level,
        scale: level,
      });
      // 255 not 256: differencing reserves an index for transparency.
      expect(p.maxColors).toBeLessThanOrEqual(255);
      expect(p.maxColors).toBeGreaterThanOrEqual(2);
      expect(p.frameStep).toBeGreaterThanOrEqual(1);
      expect(p.scale).toBeGreaterThan(0);
      expect(p.scale).toBeLessThanOrEqual(1);
    }
  });

  it("clamps out-of-range levels instead of producing undefined params", () => {
    expect(resolveEncodeParams(only("colors", 0))).toEqual(
      resolveEncodeParams(only("colors", 1)),
    );
    expect(resolveEncodeParams(only("colors", 99))).toEqual(
      LOSSLESS_ENCODE_PARAMS,
    );
    expect(resolveEncodeParams(only("scale", Number.NaN))).toEqual(
      LOSSLESS_ENCODE_PARAMS,
    );
  });
});

describe("isLosslessLevels", () => {
  it("is true only when every axis is at max", () => {
    expect(isLosslessLevels(LOSSLESS_QUALITY_LEVELS)).toBe(true);
    for (const knob of GIF_QUALITY_KNOBS) {
      expect(isLosslessLevels(only(knob, 9)), knob).toBe(false);
    }
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

describe("describeKnobLevel", () => {
  it("names the lossless end of each axis", () => {
    expect(describeKnobLevel("colors", GIF_QUALITY_LOSSLESS)).toBe("255 colors");
    expect(describeKnobLevel("frames", GIF_QUALITY_LOSSLESS)).toBe("every frame");
    expect(describeKnobLevel("scale", GIF_QUALITY_LOSSLESS)).toBe("full size");
  });

  it("reports the real numbers, not vague adjectives", () => {
    expect(describeKnobLevel("colors", 1)).toBe("32 colors");
    expect(describeKnobLevel("scale", 1)).toBe("40% size");
    expect(describeKnobLevel("frames", 5)).toBe("every 2nd frame");
    expect(describeKnobLevel("frames", 3)).toBe("every 3rd frame");
    expect(describeKnobLevel("frames", 1)).toBe("every 4th frame");
  });

  it("describes every level on every axis without producing junk", () => {
    for (const knob of GIF_QUALITY_KNOBS) {
      for (const level of levels) {
        const text = describeKnobLevel(knob, level);
        expect(text, `${knob}@${level}`).toBeTruthy();
        expect(text).not.toMatch(/undefined|NaN/);
      }
    }
  });
});

describe("encodeParamsKey", () => {
  it("separates settings that produce different output", () => {
    expect(
      encodeParamsKey(resolveEncodeParams(only("colors", 5)), "@me"),
    ).not.toBe(encodeParamsKey(resolveEncodeParams(only("frames", 5)), "@me"));
  });

  it("separates watermarked output from unwatermarked", () => {
    expect(encodeParamsKey(LOSSLESS_ENCODE_PARAMS, "@me")).not.toBe(
      encodeParamsKey(LOSSLESS_ENCODE_PARAMS, ""),
    );
  });

  it("collides only when the output really would be identical", () => {
    // Adjacent levels that resolve to the same frame step should share a cache
    // entry rather than re-encoding for no reason.
    const a = resolveEncodeParams(only("frames", 8));
    const b = resolveEncodeParams(only("frames", 9));
    expect(a.frameStep).toBe(b.frameStep);
    expect(encodeParamsKey(a, "@me")).toBe(encodeParamsKey(b, "@me"));
  });
});
