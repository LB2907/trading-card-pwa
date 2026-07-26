"use client";

import {
  cardCanvasSize,
  drawTradingCard,
  type DrawCardOptions,
} from "@/lib/compositor/draw-card";
import type { LuminanceProbe } from "@/lib/compositor/watermark-ink";
import { ensureCardFontsLoaded } from "@/lib/compositor/canvas-font";
import { parseLayout } from "@/lib/card-layout";
import { cardMediaMode, withPlaybackMime } from "@/lib/media/card-media-mode";
import {
  seekVideo,
  waitForPaintedFrame,
  waitLoadedMetadata,
} from "@/lib/media/import";
import { loadUserBlob } from "@/lib/media/storage";
import type { CardExportRow, CardVideoProgress } from "@/lib/export/types";
import {
  CARD_LAYOUT_WIDTH,
  CARD_VIDEO_EXPORT_PIXEL_RATIO,
  videoBitrateFor,
  videoCodecFromMime,
} from "@/lib/compositor/card-resolution";
import {
  DEFAULT_CAPTURE_FPS,
  fpsFromFrameSamples,
  normalizeSourceFps,
  type VideoFrameSample,
} from "@/lib/compositor/video-frame-rate";
import { buildCardGif } from "@/lib/export/card-gif-encoder";

/**
 * How long to watch the clip before recording, to learn its real frame rate.
 * Paid once per export; the alternative is encoding 60 fps sources at 30 and
 * paying for the judder on every frame instead.
 */
const FPS_PROBE_MS = 300;

/** Chunk size handed to `MediaRecorder.start`. Nothing streams these, so the only job is to keep fragment overhead low. */
const RECORDER_TIMESLICE_MS = 1000;

/** How often the stop/progress watchdog runs. Deliberately not tied to rAF. */
const WATCHDOG_INTERVAL_MS = 250;

/**
 * Media time may stop advancing for legitimate reasons (a hidden page, a
 * pause), all of which we handle explicitly. If it stalls while visible and
 * playing for this long, the decoder is wedged and nothing will restart it.
 * This is the only remaining bound on export length — there is no duration cap.
 */
const STALL_TIMEOUT_MS = 30_000;

type VideoFrameMetadata = {
  mediaTime: number;
  presentedFrames: number;
};

type FrameCallbackVideo = HTMLVideoElement & {
  requestVideoFrameCallback?: (
    cb: (now: number, metadata: VideoFrameMetadata) => void,
  ) => number;
  cancelVideoFrameCallback?: (handle: number) => void;
};

type CaptureTrack = MediaStreamTrack & { requestFrame?: () => void };

export type CardVideoExportOptions = {
  watermarkText?: string;
  onProgress?: (progress: CardVideoProgress) => void;
  signal?: AbortSignal;
};

export class CardVideoExportAborted extends Error {
  constructor() {
    super("Video export cancelled.");
    this.name = "CardVideoExportAborted";
  }
}

/** AVC + AAC (typical for MP4 + sound). */
const MP4_WITH_AUDIO_CANDIDATES = [
  "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
  "video/mp4;codecs=avc1.4d001e,mp4a.40.2",
  "video/mp4;codecs=avc1,mp4a.40.2",
  "video/mp4",
] as const;

const MP4_RECORDER_TYPES = [
  "video/mp4;codecs=avc1.42E01E",
  "video/mp4;codecs=avc1.4d001e",
  "video/mp4;codecs=avc1",
  "video/mp4",
] as const;

const WEBM_WITH_AUDIO_CANDIDATES = [
  "video/webm;codecs=vp9,opus",
  "video/webm;codecs=vp8,opus",
  "video/webm;codecs=vp9",
  "video/webm;codecs=vp8",
  "video/webm",
] as const;

const WEBM_RECORDER_TYPES = [
  "video/webm;codecs=vp9",
  "video/webm;codecs=vp8",
  "video/webm",
] as const;

function getAudioContextCtor(): (typeof AudioContext) | null {
  if (typeof window === "undefined") return null;
  const w = window as typeof window & {
    webkitAudioContext?: typeof AudioContext;
  };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

/**
 * MP4 first for iPhone/Safari; WebM for many desktops.
 * With `includeAudio`, prefers muxed A+V types (e.g. VP9+Opus) when supported.
 */
export function pickCardVideoRecorderMime(options?: {
  includeAudio?: boolean;
}): {
  mime: string;
  ext: "mp4" | "webm";
} {
  const includeAudio = options?.includeAudio ?? false;
  if (typeof MediaRecorder === "undefined" || !MediaRecorder.isTypeSupported) {
    throw new Error("Video recording is not supported in this browser.");
  }
  if (includeAudio) {
    for (const c of MP4_WITH_AUDIO_CANDIDATES) {
      if (MediaRecorder.isTypeSupported(c)) {
        return { mime: c, ext: "mp4" };
      }
    }
    for (const c of WEBM_WITH_AUDIO_CANDIDATES) {
      if (MediaRecorder.isTypeSupported(c)) {
        return { mime: c, ext: "webm" };
      }
    }
  }
  for (const c of MP4_RECORDER_TYPES) {
    if (MediaRecorder.isTypeSupported(c)) {
      return { mime: c, ext: "mp4" };
    }
  }
  for (const c of WEBM_RECORDER_TYPES) {
    if (MediaRecorder.isTypeSupported(c)) {
      return { mime: c, ext: "webm" };
    }
  }
  throw new Error(
    "This browser cannot encode MP4 or WebM video (try Safari on iPhone, or an up-to-date Chrome / Edge).",
  );
}

export function getCompositedCardVideoExportFormat(): {
  mime: string;
  ext: "mp4" | "webm";
} | null {
  try {
    return pickCardVideoRecorderMime({ includeAudio: true });
  } catch {
    try {
      return pickCardVideoRecorderMime({ includeAudio: false });
    } catch {
      return null;
    }
  }
}

function drawOptsBase(
  row: CardExportRow,
  layout: ReturnType<typeof parseLayout>,
  art: CanvasImageSource,
  pixelRatio: number,
  watermarkText?: string,
  watermarkProbe?: LuminanceProbe,
): DrawCardOptions {
  return {
    instance: row.instance,
    layout,
    artImage: art,
    width: CARD_LAYOUT_WIDTH,
    pixelRatio,
    watermarkText,
    watermarkProbe,
  };
}

/**
 * Full card as animated GIF (multi-frame if source is GIF; otherwise one frame).
 *
 * Kept as the stable entry point for callers that just want a file at default
 * quality — bulk export, the zip path. Anything that needs quality control or
 * progress should call `buildCardGif` directly.
 */
export async function buildCompositedCardGifBlob(
  row: CardExportRow,
  opts?: { watermarkText?: string },
): Promise<Blob> {
  const result = await buildCardGif(row, {
    ...(opts?.watermarkText !== undefined
      ? { watermarkText: opts.watermarkText }
      : {}),
  });
  return result.blob;
}

/**
 * Play the clip briefly and count presented frames, so one source frame can be
 * composited into exactly one encoded frame and the bitrate can be derived
 * against the rate actually being encoded.
 *
 * Returns `"blocked"` when playback was refused — the caller can drop the
 * audio tap and try again muted, since motion matters more than sound.
 */
async function probeSourceFps(
  video: HTMLVideoElement,
): Promise<number | "blocked"> {
  try {
    await video.play();
  } catch {
    return "blocked";
  }
  const v = video as FrameCallbackVideo;
  if (typeof v.requestVideoFrameCallback !== "function") {
    video.pause();
    return DEFAULT_CAPTURE_FPS;
  }
  const measured = await new Promise<number | null>((resolve) => {
    let first: VideoFrameSample | null = null;
    let last: VideoFrameSample | null = null;
    let handle = 0;
    let guard = 0;
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(guard);
      try {
        v.cancelVideoFrameCallback?.(handle);
      } catch {
        /* noop */
      }
      resolve(first && last ? fpsFromFrameSamples(first, last) : null);
    };
    const deadline = performance.now() + FPS_PROBE_MS;
    const step = (_now: number, metadata: VideoFrameMetadata) => {
      const sample: VideoFrameSample = {
        mediaTime: metadata.mediaTime,
        presentedFrames: metadata.presentedFrames,
      };
      first ??= sample;
      last = sample;
      if (performance.now() >= deadline || video.ended) {
        finish();
        return;
      }
      handle = v.requestVideoFrameCallback!(step);
    };
    // A clip that never presents a frame must not hang the export.
    guard = window.setTimeout(finish, FPS_PROBE_MS + 600);
    handle = v.requestVideoFrameCallback!(step);
  });
  video.pause();
  return normalizeSourceFps(measured);
}

/**
 * Prefer manual frame delivery: `captureStream(0)` publishes a frame only when
 * we ask, so painting is driven by the source's cadence instead of the
 * display's, and nothing composited is thrown away. Falls back to fixed-rate
 * capture where `requestFrame` is missing.
 */
export function openCanvasCapture(
  canvas: HTMLCanvasElement,
  fps: number,
): { stream: MediaStream; track: CaptureTrack; manual: boolean } {
  try {
    const stream = canvas.captureStream(0);
    const track = stream.getVideoTracks()[0] as CaptureTrack | undefined;
    if (track && typeof track.requestFrame === "function") {
      return { stream, track, manual: true };
    }
    stream.getTracks().forEach((t) => t.stop());
  } catch {
    /* fall through to fixed-rate capture */
  }
  const stream = canvas.captureStream(fps);
  const track = stream.getVideoTracks()[0] as CaptureTrack | undefined;
  if (!track) {
    throw new Error("Could not capture video from export canvas.");
  }
  return { stream, track, manual: false };
}

/**
 * Full card as video (MP4 on Safari/iOS when supported, else WebM).
 * Video track from the composited canvas; audio from the source file (when present),
 * tapped via Web Audio so it is not played through the device speakers.
 *
 * There is no duration cap: the export runs to the end of the clip. Recording
 * is bound to real time, so pass `onProgress` to show it and `signal` to let
 * the user give up — and note that chunks accumulate in memory until the blob
 * is written, which is the practical limit on very long clips.
 */
export async function buildCompositedCardVideoBlob(
  row: CardExportRow,
  opts?: CardVideoExportOptions,
): Promise<Blob> {
  await ensureCardFontsLoaded();
  if (cardMediaMode(row.instance) !== "video") {
    throw new Error("Card video export only works when the art file is a video.");
  }
  if (opts?.signal?.aborted) throw new CardVideoExportAborted();

  const rawBlob = await loadUserBlob(row.instance.mediaPath);
  if (!rawBlob) {
    throw new Error("Art file missing from local storage — cannot render card.");
  }
  const typed = withPlaybackMime(rawBlob, row.instance.mediaPath);
  const layout = parseLayout(row.layoutJson);
  const { bufW, bufH } = cardCanvasSize(
    CARD_LAYOUT_WIDTH,
    CARD_VIDEO_EXPORT_PIXEL_RATIO,
  );
  if (!Number.isFinite(bufW) || bufW < 1 || !Number.isFinite(bufH) || bufH < 1) {
    throw new Error("Invalid export dimensions.");
  }

  const url = URL.createObjectURL(typed);
  const video = document.createElement("video");
  video.playsInline = true;
  video.setAttribute("playsinline", "");
  video.setAttribute("webkit-playsinline", "");
  video.preload = "auto";
  video.muted = true;
  video.src = url;

  let audioCtx: AudioContext | null = null;
  let elementSource: MediaElementAudioSourceNode | null = null;
  let audioTrack: MediaStreamTrack | null = null;
  let capture: {
    stream: MediaStream;
    track: CaptureTrack;
    manual: boolean;
  } | null = null;
  let rec: MediaRecorder | null = null;

  const disposeAudioTap = async () => {
    try {
      elementSource?.disconnect();
    } catch {
      /* noop */
    }
    elementSource = null;
    if (audioTrack) {
      try {
        audioTrack.stop();
      } catch {
        /* noop */
      }
      audioTrack = null;
    }
    if (audioCtx) {
      await audioCtx.close().catch(() => {
        /* noop */
      });
      audioCtx = null;
    }
  };

  /** One teardown for every exit — success, failure and cancel alike. */
  const teardown = async () => {
    if (rec && rec.state !== "inactive") {
      try {
        rec.stop();
      } catch {
        /* noop */
      }
    }
    // The capture track keeps the canvas alive for as long as it runs; leaving
    // it open leaked one canvas-backed track per export.
    capture?.stream.getTracks().forEach((t) => {
      try {
        t.stop();
      } catch {
        /* noop */
      }
    });
    await disposeAudioTap();
    URL.revokeObjectURL(url);
    try {
      video.pause();
    } catch {
      /* noop */
    }
    video.removeAttribute("src");
    video.load();
    video.remove();
  };

  try {
    await waitLoadedMetadata(video);

    const canvas = document.createElement("canvas");
    canvas.width = bufW;
    canvas.height = bufH;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas unsupported");

    const AC = getAudioContextCtor();
    if (AC) {
      try {
        /** Unmute so decoded audio reaches MediaElementAudioSourceNode (speakers: disconnected). */
        video.muted = false;
        audioCtx = new AC();
        elementSource = audioCtx.createMediaElementSource(video);
        const dest = audioCtx.createMediaStreamDestination();
        elementSource.connect(dest);
        audioTrack = dest.stream.getAudioTracks()[0] ?? null;
        await audioCtx.resume();
      } catch {
        await disposeAudioTap();
        video.muted = true;
      }
    }

    // Learn the source cadence before anything is recorded. Unmuted playback
    // can be refused outside a user gesture — give up the audio rather than
    // the export.
    let probed = await probeSourceFps(video);
    if (probed === "blocked" && !video.muted) {
      await disposeAudioTap();
      video.muted = true;
      probed = await probeSourceFps(video);
    }
    if (probed === "blocked") {
      throw new Error("Could not play video for export (autoplay blocked?).");
    }
    const fps = probed;
    if (opts?.signal?.aborted) throw new CardVideoExportAborted();

    // Composite frame 0 before the recorder exists. Starting the recorder
    // first published the untouched canvas, so every export opened on a blank
    // flash.
    await seekVideo(video, 0);
    await waitForPaintedFrame(video);
    const watermarkText = opts?.watermarkText;
    let sharedProbe: LuminanceProbe | undefined = drawTradingCard(
      ctx,
      drawOptsBase(
        row,
        layout,
        video,
        CARD_VIDEO_EXPORT_PIXEL_RATIO,
        watermarkText,
        undefined,
      ),
    );

    const cap = openCanvasCapture(canvas, fps);
    capture = cap;

    let hasAudio = audioTrack !== null;
    let exportStream = new MediaStream(
      hasAudio && audioTrack ? [cap.track, audioTrack] : [cap.track],
    );
    let recMime = pickCardVideoRecorderMime({ includeAudio: hasAudio });

    const recOptions = (
      mime: string,
      withAudio: boolean,
    ): MediaRecorderOptions => ({
      mimeType: mime,
      videoBitsPerSecond: videoBitrateFor(
        bufW,
        bufH,
        fps,
        videoCodecFromMime(mime),
      ),
      ...(withAudio ? { audioBitsPerSecond: 128_000 } : {}),
    });

    try {
      rec = new MediaRecorder(exportStream, recOptions(recMime.mime, hasAudio));
    } catch {
      if (!hasAudio) {
        throw new Error("Could not start video recorder for this browser.");
      }
      await disposeAudioTap();
      video.muted = true;
      hasAudio = false;
      exportStream = new MediaStream([cap.track]);
      recMime = pickCardVideoRecorderMime({ includeAudio: false });
      rec = new MediaRecorder(exportStream, recOptions(recMime.mime, false));
    }

    const recorder = rec;
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size) chunks.push(e.data);
    };

    const totalMs =
      Number.isFinite(video.duration) && video.duration > 0
        ? video.duration * 1000
        : null;
    let aborted = false;

    await new Promise<void>((resolve, reject) => {
      let settled = false;
      let stopping = false;
      let frameHandle = 0;
      let rafHandle = 0;
      let watchdog = 0;
      const startedAt = performance.now();
      let lastMediaTime = -1;
      let lastAdvanceAt = startedAt;
      let lastPaintAt = 0;

      const v = video as FrameCallbackVideo;
      const useFrameCallback =
        typeof v.requestVideoFrameCallback === "function";
      /** Fixed-rate fallback only: keep the pump off the display's refresh. */
      const minPaintGap = 1000 / fps - 2;

      const detach = () => {
        window.clearInterval(watchdog);
        document.removeEventListener("visibilitychange", onVisibility);
        video.removeEventListener("ended", onEnded);
        opts?.signal?.removeEventListener("abort", onAbort);
        if (rafHandle) cancelAnimationFrame(rafHandle);
        if (frameHandle) {
          try {
            v.cancelVideoFrameCallback?.(frameHandle);
          } catch {
            /* noop */
          }
        }
      };

      const done = (err?: Error) => {
        if (settled) return;
        settled = true;
        detach();
        if (err) reject(err);
        else resolve();
      };

      /** Stop and let `onstop` settle, so the trailing chunk still lands. */
      const finishRecording = () => {
        if (stopping || settled) return;
        stopping = true;
        try {
          video.pause();
        } catch {
          /* noop */
        }
        if (recorder.state === "inactive") {
          done();
          return;
        }
        try {
          recorder.stop();
        } catch {
          done(new Error("Recording failed."));
        }
      };

      function onEnded() {
        finishRecording();
      }

      function onAbort() {
        aborted = true;
        finishRecording();
      }

      /**
       * A hidden page stops firing rAF and video-frame callbacks, but the
       * recorder carries on — which used to bake a frozen stretch into the
       * clip and leave the stop check unreachable. Park both together.
       */
      function onVisibility() {
        if (settled || stopping) return;
        if (document.hidden) {
          try {
            if (recorder.state === "recording") recorder.pause();
          } catch {
            /* noop */
          }
          try {
            video.pause();
          } catch {
            /* noop */
          }
          return;
        }
        void video.play().catch(() => {
          /* resumed by the next visibility change or ended by the watchdog */
        });
        try {
          if (recorder.state === "paused") recorder.resume();
        } catch {
          /* noop */
        }
      }

      const paintFrame = () => {
        const probe = drawTradingCard(
          ctx,
          drawOptsBase(
            row,
            layout,
            video,
            CARD_VIDEO_EXPORT_PIXEL_RATIO,
            watermarkText,
            sharedProbe,
          ),
        );
        sharedProbe ??= probe;
        if (cap.manual) {
          try {
            cap.track.requestFrame?.();
          } catch {
            /* noop */
          }
        }
      };

      const pumpViaFrameCallback = () => {
        frameHandle = v.requestVideoFrameCallback!(() => {
          if (settled || stopping) return;
          paintFrame();
          pumpViaFrameCallback();
        });
      };

      const pumpViaRaf = () => {
        rafHandle = requestAnimationFrame(() => {
          if (settled || stopping) return;
          const now = performance.now();
          if (now - lastPaintAt >= minPaintGap) {
            lastPaintAt = now;
            paintFrame();
          }
          pumpViaRaf();
        });
      };

      /**
       * Stop and progress live here rather than in the pump: the pump stops
       * running exactly when the page is hidden, which is when this most
       * needs to keep working. Keyed on media time, so a paused export is not
       * mistaken for a finished one.
       */
      const tick = () => {
        if (settled) return;
        const now = performance.now();
        const t = video.currentTime;
        if (t > lastMediaTime + 0.005) {
          lastMediaTime = t;
          lastAdvanceAt = now;
        }
        opts?.onProgress?.({
          fraction: totalMs ? Math.min(1, (t * 1000) / totalMs) : null,
          elapsedMs: now - startedAt,
          totalMs,
        });
        if (stopping) return;
        if (video.ended) {
          finishRecording();
          return;
        }
        if (totalMs != null && t * 1000 >= totalMs - 5) {
          finishRecording();
          return;
        }
        // A hidden page is parked on purpose and resumes when it comes back.
        // Anything else that stops advancing — including a `play()` that never
        // recovered after a visibility change — is a wedge, and must not leave
        // the promise unsettled forever.
        if (!document.hidden && now - lastAdvanceAt > STALL_TIMEOUT_MS) {
          finishRecording();
        }
      };

      recorder.onstop = () => done();
      recorder.onerror = () => done(new Error("Recording failed."));

      opts?.signal?.addEventListener("abort", onAbort);
      document.addEventListener("visibilitychange", onVisibility);
      video.addEventListener("ended", onEnded);

      try {
        recorder.start(RECORDER_TIMESLICE_MS);
      } catch (e) {
        done(e instanceof Error ? e : new Error(String(e)));
        return;
      }

      // Push the already-composited frame 0 before playback begins.
      paintFrame();
      watchdog = window.setInterval(tick, WATCHDOG_INTERVAL_MS);

      void video
        .play()
        .then(() => {
          if (settled || stopping) return;
          if (useFrameCallback) pumpViaFrameCallback();
          else pumpViaRaf();
        })
        .catch(() =>
          done(new Error("Could not play video for export (autoplay blocked?).")),
        );
    });

    if (aborted || opts?.signal?.aborted) throw new CardVideoExportAborted();

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
    return new Blob(chunks, { type: baseMime });
  } finally {
    await teardown();
  }
}

export function canvasSupportsWebpExport(): boolean {
  if (typeof document === "undefined") return false;
  const c = document.createElement("canvas");
  return c.toDataURL("image/webp").startsWith("data:image/webp");
}
