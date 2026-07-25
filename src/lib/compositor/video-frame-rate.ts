/**
 * Working out what cadence a source clip actually runs at.
 *
 * `captureStream(30)` used to be hardcoded, which did two bad things at once:
 * a 24 or 60 fps clip got resampled into judder, and the pump repainted at
 * display refresh (60–120 Hz) while only 30 of those frames were ever
 * captured — half to three quarters of the compositing work thrown away.
 *
 * `requestVideoFrameCallback` reports the media timestamp and a running count
 * of presented frames, so a short pre-roll gives us the real rate before the
 * recorder starts and the derived bitrate can be computed against it.
 */

export const MIN_CAPTURE_FPS = 10;
export const MAX_CAPTURE_FPS = 60;
export const DEFAULT_CAPTURE_FPS = 30;

/** Cadences worth snapping to, so a measurement of 29.4 does not become 29. */
const COMMON_FPS = [12, 15, 24, 25, 30, 48, 50, 60];

/** How far off a common cadence a measurement can land and still snap to it. */
const SNAP_TOLERANCE = 0.08;

export type VideoFrameSample = {
  /** Presentation timestamp of the frame, in media seconds. */
  mediaTime: number;
  /** Running count of frames presented since playback began. */
  presentedFrames: number;
};

/**
 * Frames per second between two `requestVideoFrameCallback` samples, or null
 * when the window is too short to mean anything.
 */
export function fpsFromFrameSamples(
  first: VideoFrameSample,
  last: VideoFrameSample,
): number | null {
  const dt = last.mediaTime - first.mediaTime;
  const df = last.presentedFrames - first.presentedFrames;
  if (!Number.isFinite(dt) || !Number.isFinite(df)) return null;
  if (dt < 0.05 || df < 1) return null;
  return df / dt;
}

/**
 * Clamp a measured rate into something we are willing to encode at, snapping
 * to a standard cadence when it is close enough.
 */
export function normalizeSourceFps(measured: number | null | undefined): number {
  if (measured == null || !Number.isFinite(measured) || measured <= 0) {
    return DEFAULT_CAPTURE_FPS;
  }
  const clamped = Math.min(MAX_CAPTURE_FPS, Math.max(MIN_CAPTURE_FPS, measured));
  let best: number | null = null;
  let bestError = Number.POSITIVE_INFINITY;
  for (const candidate of COMMON_FPS) {
    const error = Math.abs(clamped - candidate) / candidate;
    // Nearest wins, not first: 25.3 sits inside the tolerance of both 24 and
    // 25, and snapping it to 24 would reintroduce the judder we are avoiding.
    if (error <= SNAP_TOLERANCE && error < bestError) {
      best = candidate;
      bestError = error;
    }
  }
  return best ?? Math.round(clamped);
}
