import { describe, expect, it } from "vitest";
import {
  VIDEO_BITS_PER_PIXEL,
  VIDEO_BITRATE_CEILING,
  videoBitrateFor,
} from "@/lib/compositor/card-resolution";

const W = 1260;
const H = 1764;

describe("videoBitrateFor", () => {
  it("lifts the current export well above the old fixed 4 Mbps", () => {
    // 1260x1764 @30fps at 4 Mbps was 0.060 bits/pixel/frame — about half of
    // what H.264 needs for text and fine gold linework.
    expect(videoBitrateFor(W, H, 30)).toBeGreaterThan(4_000_000);
  });

  it("lands in the healthy bits-per-pixel band for this content", () => {
    const bpp = videoBitrateFor(W, H, 30) / (W * H * 30);
    expect(bpp).toBeGreaterThanOrEqual(0.1);
    expect(bpp).toBeLessThanOrEqual(0.18);
  });

  it("scales with resolution, so changing the pixel ratio cannot starve it", () => {
    expect(videoBitrateFor(W, H, 30)).toBeGreaterThan(
      videoBitrateFor(W / 2, H / 2, 30),
    );
  });

  it("scales with frame rate", () => {
    expect(videoBitrateFor(W, H, 60)).toBeGreaterThan(videoBitrateFor(W, H, 30));
  });

  it("caps out, so a long clip cannot balloon the file on a phone", () => {
    expect(videoBitrateFor(4000, 6000, 60)).toBe(VIDEO_BITRATE_CEILING);
  });

  it("stays sane for degenerate input", () => {
    expect(videoBitrateFor(0, 0, 0)).toBeGreaterThan(0);
    expect(Number.isFinite(videoBitrateFor(NaN, NaN, NaN))).toBe(true);
  });

  it("returns whole bits per second (MediaRecorder wants an integer)", () => {
    expect(Number.isInteger(videoBitrateFor(W, H, 30))).toBe(true);
  });

  it("documents the density it targets", () => {
    expect(VIDEO_BITS_PER_PIXEL).toBeGreaterThan(0.1);
    expect(VIDEO_BITS_PER_PIXEL).toBeLessThan(0.2);
  });
});
