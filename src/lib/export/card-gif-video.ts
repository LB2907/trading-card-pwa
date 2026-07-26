"use client";

/**
 * Records a GIF-art card as MP4/WebM.
 *
 * Worth having because X transcodes every uploaded GIF to silent MP4 anyway,
 * and its video limits are far looser than its GIF ones (512 MB / 140 s for a
 * free account, against 15 MB / 30 s for a GIF). Sending a GIF to X therefore
 * means squeezing a worse-looking file through a much tighter limit to reach
 * the same destination.
 *
 * Discord is the opposite — it autoplays and loops GIFs inline but shows a play
 * button for video — so this complements the GIF export rather than replacing
 * it. See `gif-platform-limits`.
 *
 * `MediaRecorder` timestamps by wall clock, so this plays the animation in real
 * time and paints as it goes. Frames are composited just-in-time and released,
 * keeping memory flat: pre-rendering a 280-frame card at video resolution would
 * be about 2.5 GB of RGBA.
 */

import { cardCanvasSize, drawTradingCard } from "@/lib/compositor/draw-card";
import type { LuminanceProbe } from "@/lib/compositor/watermark-ink";
import { ensureCardFontsLoaded } from "@/lib/compositor/canvas-font";
import { parseLayout } from "@/lib/card-layout";
import {
  CARD_LAYOUT_WIDTH,
  CARD_VIDEO_EXPORT_PIXEL_RATIO,
  videoBitrateFor,
  videoCodecFromMime,
} from "@/lib/compositor/card-resolution";
import { cardMediaMode, withPlaybackMime } from "@/lib/media/card-media-mode";
import { loadUserBlob } from "@/lib/media/storage";
import type { CardExportRow, CardVideoProgress } from "@/lib/export/types";
import { decodeGif, fullFramesFromGif } from "@/lib/export/gif-frame-source";
import {
  captureFpsForDelays,
  planGifVideo,
  type GifVideoPlan,
} from "@/lib/export/gif-video-plan";
import {
  openCanvasCapture,
  pickCardVideoRecorderMime,
  CardVideoExportAborted,
} from "@/lib/export/card-rendered-media";

/** Chunk size handed to `MediaRecorder.start`. */
const RECORDER_TIMESLICE_MS = 1000;

export type CardGifVideoOptions = {
  watermarkText?: string;
  onProgress?: (p: CardVideoProgress) => void;
  signal?: AbortSignal;
};

export type CardGifVideoResult = {
  blob: Blob;
  ext: "mp4" | "webm";
  plan: GifVideoPlan;
  width: number;
  height: number;
};

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => {
    const t = window.setTimeout(done, ms);
    function done() {
      window.clearTimeout(t);
      signal?.removeEventListener("abort", done);
      resolve();
    }
    signal?.addEventListener("abort", done);
  });
}

/** Is video export available for this card at all? */
export function canExportGifCardVideo(row: CardExportRow): boolean {
  if (cardMediaMode(row.instance) !== "gif") return false;
  try {
    pickCardVideoRecorderMime({ includeAudio: false });
    return true;
  } catch {
    return false;
  }
}

export async function buildCompositedGifCardVideoBlob(
  row: CardExportRow,
  opts?: CardGifVideoOptions,
): Promise<CardGifVideoResult> {
  const signal = opts?.signal;
  const throwIfAborted = () => {
    if (signal?.aborted) throw new CardVideoExportAborted();
  };
  throwIfAborted();

  if (cardMediaMode(row.instance) !== "gif") {
    throw new Error("This export only works when the card art is a GIF.");
  }
  await ensureCardFontsLoaded();

  const rawBlob = await loadUserBlob(row.instance.mediaPath);
  if (!rawBlob) {
    throw new Error("Art file missing from local storage — cannot render card.");
  }
  const typed = withPlaybackMime(rawBlob, row.instance.mediaPath);
  const layout = parseLayout(row.layoutJson);
  const { parsed, frames, delaysMs } = await decodeGif(typed);
  throwIfAborted();

  const plan = planGifVideo(delaysMs);
  const { bufW, bufH } = cardCanvasSize(
    CARD_LAYOUT_WIDTH,
    CARD_VIDEO_EXPORT_PIXEL_RATIO,
  );
  if (!Number.isFinite(bufW) || bufW < 1 || !Number.isFinite(bufH) || bufH < 1) {
    throw new Error("Invalid export dimensions.");
  }

  const canvas = document.createElement("canvas");
  canvas.width = bufW;
  canvas.height = bufH;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unsupported");

  // Measured once and held, matching the GIF and still exports: re-probing per
  // frame costs a readback each time and makes watermark tiles near the
  // light/dark threshold flip tone as the art moves.
  let sharedProbe: LuminanceProbe | undefined;
  const paintCard = (art: CanvasImageSource) => {
    const probe = drawTradingCard(ctx, {
      instance: row.instance,
      layout,
      artImage: art,
      width: CARD_LAYOUT_WIDTH,
      pixelRatio: CARD_VIDEO_EXPORT_PIXEL_RATIO,
      ...(opts?.watermarkText !== undefined
        ? { watermarkText: opts.watermarkText }
        : {}),
      watermarkProbe: sharedProbe,
    });
    sharedProbe ??= probe;
  };

  const fps = captureFpsForDelays(delaysMs);
  const recMime = pickCardVideoRecorderMime({ includeAudio: false });
  const capture = openCanvasCapture(canvas, fps);
  let recorder: MediaRecorder | null = null;

  const teardown = () => {
    if (recorder && recorder.state !== "inactive") {
      try {
        recorder.stop();
      } catch {
        /* noop */
      }
    }
    capture.stream.getTracks().forEach((t) => {
      try {
        t.stop();
      } catch {
        /* noop */
      }
    });
  };

  try {
    // Composite frame 0 before the recorder exists, so the clip does not open
    // on a blank flash of untouched canvas.
    const firstPass = fullFramesFromGif(parsed, frames);
    const first = await firstPass.next();
    if (first.done) throw new Error("This GIF contains no frames.");
    paintCard(first.value.bitmap);
    first.value.bitmap.close();
    await firstPass.return(undefined);

    const chunks: Blob[] = [];
    recorder = new MediaRecorder(capture.stream, {
      mimeType: recMime.mime,
      videoBitsPerSecond: videoBitrateFor(
        bufW,
        bufH,
        fps,
        videoCodecFromMime(recMime.mime),
      ),
    });
    recorder.ondataavailable = (e) => {
      if (e.data.size) chunks.push(e.data);
    };
    const stopped = new Promise<void>((resolve, reject) => {
      recorder!.onstop = () => resolve();
      recorder!.onerror = () => reject(new Error("Recording failed."));
    });

    /**
     * A hidden page throttles timers to about once a second, which would stretch
     * the clip. Park the recorder with it and shift the time base on return, so
     * the animation resumes at the point it was paused rather than jumping.
     */
    let baseline = 0;
    let targetMs = 0;
    const onVisibility = () => {
      if (!recorder) return;
      if (document.hidden) {
        try {
          if (recorder.state === "recording") recorder.pause();
        } catch {
          /* noop */
        }
        return;
      }
      baseline = performance.now() - targetMs;
      try {
        if (recorder.state === "paused") recorder.resume();
      } catch {
        /* noop */
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    try {
      recorder.start(RECORDER_TIMESLICE_MS);
      baseline = performance.now();
      capture.track.requestFrame?.();

      let painted = 0;
      for (let loop = 0; loop < plan.loops; loop++) {
        for await (const { index, bitmap } of fullFramesFromGif(
          parsed,
          frames,
        )) {
          try {
            throwIfAborted();
            paintCard(bitmap);
          } finally {
            bitmap.close();
          }
          if (capture.manual) {
            try {
              capture.track.requestFrame?.();
            } catch {
              /* noop */
            }
          }

          painted++;
          // Track a cumulative target rather than sleeping the raw delay, so
          // slow frames borrow from later ones instead of accumulating drift.
          targetMs += delaysMs[index] ?? 100;
          opts?.onProgress?.({
            fraction: painted / plan.frameCount,
            elapsedMs: performance.now() - baseline,
            totalMs: plan.totalMs,
          });
          await sleep(targetMs - (performance.now() - baseline), signal);
          throwIfAborted();
        }
      }
    } finally {
      document.removeEventListener("visibilitychange", onVisibility);
    }

    if (recorder.state !== "inactive") recorder.stop();
    await stopped;

    const bytes = chunks.reduce((n, c) => n + c.size, 0);
    if (!chunks.length || bytes === 0) {
      throw new Error(
        "Video export produced no data — the recorder stopped before any frames were encoded.",
      );
    }
    const baseMime =
      recMime.ext === "mp4"
        ? "video/mp4"
        : recMime.mime.split(";")[0] || "video/webm";
    const blob = new Blob(chunks, { type: baseMime });
    return {
      blob,
      ext: blob.type.toLowerCase().includes("mp4") ? "mp4" : recMime.ext,
      plan,
      width: bufW,
      height: bufH,
    };
  } finally {
    teardown();
  }
}
