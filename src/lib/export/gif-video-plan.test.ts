import { describe, expect, it } from "vitest";
import {
  GIF_VIDEO_MAX_DURATION_MS,
  GIF_VIDEO_MIN_DURATION_MS,
  captureFpsForDelays,
  planGifVideo,
} from "@/lib/export/gif-video-plan";

const frames = (n: number, delay = 100) => Array.from({ length: n }, () => delay);

describe("planGifVideo", () => {
  it("plays a long-enough animation exactly once", () => {
    const plan = planGifVideo(frames(30)); // 3s
    expect(plan.loops).toBe(1);
    expect(plan.frameCount).toBe(30);
    expect(plan.totalMs).toBe(3_000);
  });

  it("repeats a short animation up to the minimum duration", () => {
    // 300ms of GIF is a valid animation but a useless video.
    const plan = planGifVideo(frames(3));
    expect(plan.singlePassMs).toBe(300);
    expect(plan.totalMs).toBeGreaterThanOrEqual(GIF_VIDEO_MIN_DURATION_MS);
    expect(plan.loops).toBe(Math.ceil(GIF_VIDEO_MIN_DURATION_MS / 300));
    // Loops are whole animations, never a partial pass.
    expect(plan.frameCount).toBe(3 * plan.loops);
  });

  it("never truncates a single pass, even past the comfort cap", () => {
    const long = frames(1000); // 100s, over the 60s cap
    const plan = planGifVideo(long);
    expect(plan.loops).toBe(1);
    expect(plan.frameCount).toBe(1000);
    expect(plan.overLongSinglePass).toBe(true);
  });

  it("does not flag a normal animation as over-long", () => {
    expect(planGifVideo(frames(30)).overLongSinglePass).toBe(false);
  });

  it("keeps looping inside the duration cap", () => {
    const plan = planGifVideo(frames(1), { minDurationMs: 600_000 });
    expect(plan.totalMs).toBeLessThanOrEqual(GIF_VIDEO_MAX_DURATION_MS);
  });

  it("keeps looping inside the frame cap", () => {
    const plan = planGifVideo(frames(2, 20), {
      minDurationMs: 600_000,
      maxDurationMs: 600_000,
      maxFrames: 50,
    });
    expect(plan.frameCount).toBeLessThanOrEqual(50);
  });

  it("always plays at least once however tight the caps", () => {
    const plan = planGifVideo(frames(40), {
      minDurationMs: 10_000,
      maxDurationMs: 1,
      maxFrames: 1,
    });
    expect(plan.loops).toBe(1);
    expect(plan.frameCount).toBe(40);
  });

  it("handles a single-frame GIF", () => {
    const plan = planGifVideo([100]);
    expect(plan.loops).toBeGreaterThan(1);
    expect(plan.totalMs).toBeGreaterThanOrEqual(GIF_VIDEO_MIN_DURATION_MS);
  });

  it("uses the real per-frame delays, not an average", () => {
    const plan = planGifVideo([500, 1_000, 2_000]);
    expect(plan.singlePassMs).toBe(3_500);
    expect(plan.loops).toBe(1);
  });

  it("refuses an empty animation rather than planning a zero-length video", () => {
    expect(() => planGifVideo([])).toThrow(/no frames/);
  });
});

describe("captureFpsForDelays", () => {
  it("derives the rate from the fastest frame so nothing is dropped", () => {
    expect(captureFpsForDelays([100, 100, 50])).toBe(20);
    expect(captureFpsForDelays([100])).toBe(10);
  });

  it("clamps to a range a recorder will accept", () => {
    expect(captureFpsForDelays([1])).toBeLessThanOrEqual(60);
    expect(captureFpsForDelays([60_000])).toBeGreaterThanOrEqual(5);
  });

  it("falls back rather than dividing by zero", () => {
    expect(captureFpsForDelays([])).toBe(30);
    expect(Number.isFinite(captureFpsForDelays([0]))).toBe(true);
  });
});
