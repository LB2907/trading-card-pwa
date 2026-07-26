import { describe, expect, it } from "vitest";
import {
  exportTimelineOrigin,
  exportedDuration,
  rebaseToOrigin,
} from "@/lib/export/video-timeline";

describe("exportTimelineOrigin", () => {
  it("leaves a clip that already starts at zero alone", () => {
    expect(exportTimelineOrigin(0)).toBe(0);
  });

  it("clamps a negative start to zero", () => {
    // A negative first timestamp means the track's timing was offset, and those
    // samples are not meant to be presented. Keeping the offset would push
    // negative timestamps into the muxer, which rejects them.
    expect(exportTimelineOrigin(-0.0416666)).toBe(0);
    expect(exportTimelineOrigin(-2)).toBe(0);
  });

  it("adopts a positive start so the output begins at zero", () => {
    expect(exportTimelineOrigin(0.5)).toBe(0.5);
  });

  it("falls back to zero rather than poisoning every timestamp", () => {
    expect(exportTimelineOrigin(Number.NaN)).toBe(0);
    expect(exportTimelineOrigin(Number.POSITIVE_INFINITY)).toBe(0);
  });
});

describe("rebaseToOrigin", () => {
  it("passes timestamps through when the origin is zero", () => {
    expect(rebaseToOrigin(0, 0)).toBe(0);
    expect(rebaseToOrigin(1.5, 0)).toBe(1.5);
  });

  it("never returns a negative timestamp", () => {
    // The sample sink yields the one frame straddling the origin, so this case
    // is reached on every clip with an offset start.
    expect(rebaseToOrigin(-0.0416666, 0)).toBe(0);
    expect(rebaseToOrigin(0.4, 0.5)).toBe(0);
  });

  it("shifts an offset clip back to zero", () => {
    expect(rebaseToOrigin(0.5, 0.5)).toBe(0);
    expect(rebaseToOrigin(2, 0.5)).toBe(1.5);
  });

  it("keeps a frame sequence non-negative and non-decreasing", () => {
    // The real shape of the reported failure: a 24 fps clip whose first frame
    // sits one frame before zero.
    const source = [-1 / 24, 0, 1 / 24, 2 / 24, 3 / 24];
    const origin = exportTimelineOrigin(source[0]!);
    const rebased = source.map((t) => rebaseToOrigin(t, origin));

    expect(rebased.every((t) => t >= 0)).toBe(true);
    for (let i = 1; i < rebased.length; i++) {
      expect(rebased[i]!).toBeGreaterThanOrEqual(rebased[i - 1]!);
    }
  });
});

describe("exportedDuration", () => {
  it("measures from the origin, not from the source's zero", () => {
    // `computeDuration` reports an end timestamp, so an offset clip is shorter
    // than its end value suggests; progress must not stall short of 100%.
    expect(exportedDuration(10, 0.5)).toBe(9.5);
    expect(exportedDuration(10, 0)).toBe(10);
  });

  it("never reports a negative length", () => {
    expect(exportedDuration(0.2, 0.5)).toBe(0);
  });

  it("reports zero for an unknown duration rather than a fraction of NaN", () => {
    expect(exportedDuration(Number.NaN, 0)).toBe(0);
    expect(exportedDuration(Number.POSITIVE_INFINITY, 0)).toBe(0);
  });
});
