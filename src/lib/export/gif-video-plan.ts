/**
 * How long a GIF→video recording should run, and how many times the animation
 * repeats to get there.
 *
 * Recording is bound to the wall clock, so this is the difference between a
 * predictable wait and an open-ended one. Pure, so the arithmetic is testable
 * without a recorder.
 */

/**
 * A 200 ms clip is a valid GIF but a useless video — players show a frame and
 * stop, and X rejects video under half a second. Repeat the animation until it
 * is at least this long.
 */
export const GIF_VIDEO_MIN_DURATION_MS = 1_000;

/**
 * Recording happens in real time, so this is a cap on how long the user waits.
 * A single pass is never truncated: cutting an animation mid-loop looks broken,
 * and the source frame cap already bounds the worst case.
 */
export const GIF_VIDEO_MAX_DURATION_MS = 60_000;

/** Bounds the memory held in recorder chunks before the blob is assembled. */
export const GIF_VIDEO_MAX_FRAMES = 2_000;

export type GifVideoPlan = {
  /** How many times the animation is played. Always at least 1. */
  loops: number;
  /** Total frames that will be painted. */
  frameCount: number;
  /** Intended duration; actual recording may drift on a slow device. */
  totalMs: number;
  /** Duration of one pass through the animation. */
  singlePassMs: number;
  /** True when a single pass already exceeds the comfort cap. */
  overLongSinglePass: boolean;
};

export function planGifVideo(
  delaysMs: readonly number[],
  opts?: {
    minDurationMs?: number;
    maxDurationMs?: number;
    maxFrames?: number;
  },
): GifVideoPlan {
  if (delaysMs.length === 0) {
    throw new Error("Cannot plan a video from a GIF with no frames.");
  }
  const minDurationMs = opts?.minDurationMs ?? GIF_VIDEO_MIN_DURATION_MS;
  const maxDurationMs = opts?.maxDurationMs ?? GIF_VIDEO_MAX_DURATION_MS;
  const maxFrames = opts?.maxFrames ?? GIF_VIDEO_MAX_FRAMES;

  const singlePassMs = delaysMs.reduce((a, b) => a + b, 0);

  let loops = 1;
  if (singlePassMs < minDurationMs) {
    loops = Math.ceil(minDurationMs / singlePassMs);
    // Neither cap may push the plan below a single complete pass.
    loops = Math.min(loops, Math.max(1, Math.floor(maxDurationMs / singlePassMs)));
    loops = Math.min(loops, Math.max(1, Math.floor(maxFrames / delaysMs.length)));
  }

  return {
    loops,
    frameCount: delaysMs.length * loops,
    totalMs: singlePassMs * loops,
    singlePassMs,
    overLongSinglePass: singlePassMs > maxDurationMs,
  };
}

/**
 * Frame rate to advertise to `captureStream` when manual frame delivery is not
 * available. Derived from the fastest frame so nothing is dropped, then clamped
 * to something a recorder will accept.
 */
export function captureFpsForDelays(delaysMs: readonly number[]): number {
  if (delaysMs.length === 0) return 30;
  const shortest = Math.max(10, Math.min(...delaysMs));
  return Math.max(5, Math.min(60, Math.round(1000 / shortest)));
}
