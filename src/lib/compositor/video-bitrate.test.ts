import { describe, expect, it } from "vitest";
import {
  VIDEO_BITS_PER_PIXEL,
  VIDEO_BITRATE_CEILING,
  videoBitrateFor,
  videoCodecFromMime,
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

  it("spends fewer bits on VP9 and more on VP8 than on H.264", () => {
    // The bpp target was measured against H.264. Handing the same number to
    // every codec over-spends on VP9 and starves VP8, which is the one most
    // likely to be software-encoded under a real-time constraint.
    const h264 = videoBitrateFor(W, H, 30, "h264");
    expect(videoBitrateFor(W, H, 30, "vp9")).toBeLessThan(h264);
    expect(videoBitrateFor(W, H, 30, "vp8")).toBeGreaterThan(h264);
  });

  it("defaults to the H.264 target when no codec is given", () => {
    expect(videoBitrateFor(W, H, 30)).toBe(videoBitrateFor(W, H, 30, "h264"));
  });

  it("still honours the ceiling and floor per codec", () => {
    expect(videoBitrateFor(4000, 6000, 60, "vp8")).toBe(VIDEO_BITRATE_CEILING);
    expect(videoBitrateFor(1, 1, 1, "vp9")).toBeGreaterThan(0);
  });
});

describe("videoCodecFromMime", () => {
  it("reads the codec out of the mime types the recorder actually picks", () => {
    expect(videoCodecFromMime("video/mp4;codecs=avc1.42E01E,mp4a.40.2")).toBe(
      "h264",
    );
    expect(videoCodecFromMime("video/mp4")).toBe("h264");
    expect(videoCodecFromMime("video/webm;codecs=vp9,opus")).toBe("vp9");
    expect(videoCodecFromMime("video/webm;codecs=vp8,opus")).toBe("vp8");
  });

  it("treats a bare webm as VP8, which is what engines reporting it use", () => {
    expect(videoCodecFromMime("video/webm")).toBe("vp8");
  });

  it("is case-insensitive", () => {
    expect(videoCodecFromMime("VIDEO/WEBM;CODECS=VP9")).toBe("vp9");
  });
});
