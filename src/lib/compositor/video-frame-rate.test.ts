import { describe, expect, it } from "vitest";
import {
  DEFAULT_CAPTURE_FPS,
  MAX_CAPTURE_FPS,
  MIN_CAPTURE_FPS,
  fpsFromFrameSamples,
  normalizeSourceFps,
} from "@/lib/compositor/video-frame-rate";

describe("fpsFromFrameSamples", () => {
  it("derives the rate from presented frames over media time", () => {
    const fps = fpsFromFrameSamples(
      { mediaTime: 0, presentedFrames: 1 },
      { mediaTime: 1, presentedFrames: 31 },
    );
    expect(fps).toBeCloseTo(30, 5);
  });

  it("reads a 60 fps source as 60, not as the old hardcoded 30", () => {
    const fps = fpsFromFrameSamples(
      { mediaTime: 0.5, presentedFrames: 30 },
      { mediaTime: 1, presentedFrames: 60 },
    );
    expect(fps).toBeCloseTo(60, 5);
  });

  it("refuses a window too short to mean anything", () => {
    expect(
      fpsFromFrameSamples(
        { mediaTime: 0, presentedFrames: 1 },
        { mediaTime: 0.01, presentedFrames: 2 },
      ),
    ).toBeNull();
  });

  it("refuses a window with no new frames", () => {
    expect(
      fpsFromFrameSamples(
        { mediaTime: 0, presentedFrames: 4 },
        { mediaTime: 1, presentedFrames: 4 },
      ),
    ).toBeNull();
  });

  it("survives a non-finite sample rather than poisoning the bitrate", () => {
    expect(
      fpsFromFrameSamples(
        { mediaTime: Number.NaN, presentedFrames: 0 },
        { mediaTime: 1, presentedFrames: 30 },
      ),
    ).toBeNull();
  });
});

describe("normalizeSourceFps", () => {
  it("falls back to the default when nothing could be measured", () => {
    expect(normalizeSourceFps(null)).toBe(DEFAULT_CAPTURE_FPS);
    expect(normalizeSourceFps(undefined)).toBe(DEFAULT_CAPTURE_FPS);
    expect(normalizeSourceFps(0)).toBe(DEFAULT_CAPTURE_FPS);
    expect(normalizeSourceFps(Number.NaN)).toBe(DEFAULT_CAPTURE_FPS);
  });

  it("snaps a noisy measurement onto the cadence it obviously is", () => {
    expect(normalizeSourceFps(29.4)).toBe(30);
    expect(normalizeSourceFps(23.976)).toBe(24);
    expect(normalizeSourceFps(59.1)).toBe(60);
    expect(normalizeSourceFps(25.3)).toBe(25);
  });

  it("keeps an unusual but plausible rate rather than forcing it to 30", () => {
    expect(normalizeSourceFps(36)).toBe(36);
  });

  it("clamps rates we are not willing to encode at", () => {
    expect(normalizeSourceFps(240)).toBe(MAX_CAPTURE_FPS);
    expect(normalizeSourceFps(2)).toBe(MIN_CAPTURE_FPS);
  });

  it("always returns a whole frame rate", () => {
    expect(normalizeSourceFps(33.4)).toBe(33);
  });
});
