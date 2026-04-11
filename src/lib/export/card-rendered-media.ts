"use client";

import { GIFEncoder, applyPalette, quantize } from "gifenc";
import { parseGIF, decompressFrames } from "gifuct-js";
import type { ParsedGif, ParsedFrame } from "gifuct-js";
import {
  cardCanvasSize,
  drawTradingCard,
  type DrawCardOptions,
} from "@/lib/compositor/draw-card";
import { parseLayout } from "@/lib/card-layout";
import { cardMediaMode, withPlaybackMime } from "@/lib/media/card-media-mode";
import { loadArtForCompositor } from "@/lib/media/compositor-source";
import { waitLoadedMetadata } from "@/lib/media/import";
import { loadUserBlob } from "@/lib/media/storage";
import type { CardExportRow } from "@/lib/export/types";
import {
  CARD_GIF_EXPORT_PIXEL_RATIO,
  CARD_LAYOUT_WIDTH,
  CARD_VIDEO_EXPORT_PIXEL_RATIO,
} from "@/lib/compositor/card-resolution";

const MAX_GIF_FRAMES = 280;
const WEBM_MAX_SECONDS = 120;

function rgbFillFromGifBackground(gif: ParsedGif): string {
  const idx = gif.lsd.backgroundColorIndex ?? 0;
  const c = gif.gct[idx] ?? [0, 0, 0];
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

/**
 * Walk decoded GIF frames into full logical-screen bitmaps (disposal 1 = cumulative, 2 = clear before draw).
 */
async function* fullFramesFromGif(
  gif: ParsedGif,
  frames: ParsedFrame[],
): AsyncGenerator<{ delayMs: number; bitmap: ImageBitmap }> {
  const w = gif.lsd.width;
  const h = gif.lsd.height;
  const bg = rgbFillFromGifBackground(gif);

  const acc = document.createElement("canvas");
  acc.width = w;
  acc.height = h;
  const accCtx = acc.getContext("2d", { willReadFrequently: true });
  if (!accCtx) throw new Error("Canvas unsupported");

  const patchCanvas = document.createElement("canvas");
  const patchCtx = patchCanvas.getContext("2d");
  if (!patchCtx) throw new Error("Canvas unsupported");

  accCtx.fillStyle = bg;
  accCtx.fillRect(0, 0, w, h);

  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i];
    if (i > 0) {
      const prev = frames[i - 1];
      if (prev.disposalType === 2) {
        accCtx.fillStyle = bg;
        accCtx.fillRect(0, 0, w, h);
      }
    }

    const d = frame.dims;
    patchCanvas.width = d.width;
    patchCanvas.height = d.height;
    const id = patchCtx.createImageData(d.width, d.height);
    id.data.set(frame.patch);
    patchCtx.putImageData(id, 0, 0);
    accCtx.drawImage(patchCanvas, d.left, d.top);

    const delayMs = Math.max(20, Math.min(frame.delay || 100, 60_000));
    const bitmap = await createImageBitmap(acc);
    yield { delayMs, bitmap };
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
): DrawCardOptions {
  return {
    instance: row.instance,
    layout,
    artImage: art,
    width: CARD_LAYOUT_WIDTH,
    pixelRatio,
    watermarkText,
  };
}

/** Full card as animated GIF (multi-frame if source is GIF; otherwise one frame). */
export async function buildCompositedCardGifBlob(
  row: CardExportRow,
  opts?: { watermarkText?: string },
): Promise<Blob> {
  const rawBlob = await loadUserBlob(row.instance.mediaPath);
  if (!rawBlob) {
    throw new Error("Art file missing from local storage — cannot render card.");
  }
  const layout = parseLayout(row.layoutJson);
  const typed = withPlaybackMime(rawBlob, row.instance.mediaPath);
  const mode = cardMediaMode(row.instance);
  const { bufW, bufH } = cardCanvasSize(
    CARD_LAYOUT_WIDTH,
    CARD_GIF_EXPORT_PIXEL_RATIO,
  );

  if (!Number.isFinite(bufW) || bufW < 1 || !Number.isFinite(bufH) || bufH < 1) {
    throw new Error("Invalid export dimensions.");
  }

  const canvas = document.createElement("canvas");
  canvas.width = bufW;
  canvas.height = bufH;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas unsupported");

  const gif = GIFEncoder();
  let frameIndex = 0;

  const encodeOne = (art: CanvasImageSource, delayMs: number, isFirst: boolean) => {
    drawTradingCard(
      ctx,
      drawOptsBase(
        row,
        layout,
        art,
        CARD_GIF_EXPORT_PIXEL_RATIO,
        opts?.watermarkText,
      ),
    );
    const { data } = ctx.getImageData(0, 0, bufW, bufH);
    const palette = quantize(data, 256);
    const index = applyPalette(data, palette);
    gif.writeFrame(index, bufW, bufH, {
      palette,
      delay: delayMs,
      ...(isFirst ? { repeat: 0 } : {}),
    });
  };

  if (mode === "gif") {
    const ab = await typed.arrayBuffer();
    const parsed = parseGIF(ab);
    const frames = decompressFrames(parsed, true);
    if (frames.length > MAX_GIF_FRAMES) {
      throw new Error(
        `This GIF has ${frames.length} frames (max ${MAX_GIF_FRAMES}). Use video export for long clips, or trim the GIF.`,
      );
    }
    for await (const { delayMs, bitmap } of fullFramesFromGif(parsed, frames)) {
      try {
        encodeOne(bitmap, delayMs, frameIndex === 0);
        frameIndex++;
      } finally {
        bitmap.close();
      }
    }
  } else {
    const { source, dispose } = await loadArtForCompositor(typed, row.instance);
    try {
      encodeOne(source, 100, true);
    } finally {
      dispose();
    }
  }

  gif.finish();
  const raw = gif.bytes();
  return new Blob([raw.slice()], { type: "image/gif" });
}

/**
 * Full card as video (MP4 on Safari/iOS when supported, else WebM).
 * Video track from the composited canvas; audio from the source file (when present),
 * tapped via Web Audio so it is not played through the device speakers.
 */
export async function buildCompositedCardVideoBlob(
  row: CardExportRow,
  opts?: { watermarkText?: string },
): Promise<Blob> {
  if (cardMediaMode(row.instance) !== "video") {
    throw new Error("Card video export only works when the art file is a video.");
  }
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
  video.src = url;

  let audioCtx: AudioContext | null = null;
  let elementSource: MediaElementAudioSourceNode | null = null;

  const disposeAudioTap = async () => {
    try {
      elementSource?.disconnect();
    } catch {
      /* noop */
    }
    elementSource = null;
    if (audioCtx) {
      await audioCtx.close().catch(() => {
        /* noop */
      });
      audioCtx = null;
    }
  };

  try {
    await waitLoadedMetadata(video);
  } catch (e) {
    URL.revokeObjectURL(url);
    video.remove();
    throw e;
  }

  const canvas = document.createElement("canvas");
  canvas.width = bufW;
  canvas.height = bufH;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    URL.revokeObjectURL(url);
    video.remove();
    throw new Error("Canvas unsupported");
  }

  const canvasStream = canvas.captureStream(30);
  const canvasVideoTrack = canvasStream.getVideoTracks()[0];
  if (!canvasVideoTrack) {
    URL.revokeObjectURL(url);
    video.remove();
    throw new Error("Could not capture video from export canvas.");
  }

  video.muted = true;

  let exportStream = new MediaStream([canvasVideoTrack]);
  const AC = getAudioContextCtor();
  if (AC) {
    try {
      /** Unmute so decoded audio reaches MediaElementAudioSourceNode (speakers: disconnected). */
      video.muted = false;
      audioCtx = new AC();
      elementSource = audioCtx.createMediaElementSource(video);
      const dest = audioCtx.createMediaStreamDestination();
      elementSource.connect(dest);
      const [aud] = dest.stream.getAudioTracks();
      if (aud) {
        exportStream = new MediaStream([canvasVideoTrack, aud]);
      }
      await audioCtx.resume();
    } catch {
      await disposeAudioTap();
      video.muted = true;
      exportStream = new MediaStream([canvasVideoTrack]);
    }
  }

  let hasAudio = exportStream.getAudioTracks().length > 0;
  let recMime = pickCardVideoRecorderMime({ includeAudio: hasAudio });
  let rec: MediaRecorder;

  const recOptions = (mime: string, withAudio: boolean): MediaRecorderOptions => ({
    mimeType: mime,
    videoBitsPerSecond: 4_000_000,
    ...(withAudio ? { audioBitsPerSecond: 128_000 } : {}),
  });

  try {
    rec = new MediaRecorder(exportStream, recOptions(recMime.mime, hasAudio));
  } catch {
    if (hasAudio) {
      await disposeAudioTap();
      video.muted = true;
      exportStream = new MediaStream([canvasVideoTrack]);
      hasAudio = false;
      recMime = pickCardVideoRecorderMime({ includeAudio: false });
      rec = new MediaRecorder(exportStream, recOptions(recMime.mime, false));
    } else {
      URL.revokeObjectURL(url);
      video.remove();
      throw new Error("Could not start video recorder for this browser.");
    }
  }

  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => {
    if (e.data.size) chunks.push(e.data);
  };

  const durationMs =
    Number.isFinite(video.duration) && video.duration > 0
      ? Math.min(video.duration * 1000, WEBM_MAX_SECONDS * 1000)
      : Math.min(10_000, WEBM_MAX_SECONDS * 1000);

  const containerExt = recMime.ext;

  try {
    await new Promise<void>((resolve, reject) => {
      let settled = false;
      const done = (err?: Error) => {
        if (settled) return;
        settled = true;
        if (err) reject(err);
        else resolve();
      };

      rec.onerror = () => done(new Error("Recording failed."));

      const stopSafe = () => {
        if (rec.state !== "inactive") {
          try {
            rec.stop();
          } catch {
            /* noop */
          }
        }
      };

      rec.onstop = () => done();

      const t0 = performance.now();
      const pump = () => {
        drawTradingCard(
          ctx,
          drawOptsBase(
            row,
            layout,
            video,
            CARD_VIDEO_EXPORT_PIXEL_RATIO,
            opts?.watermarkText,
          ),
        );
        if (video.ended) {
          video.pause();
          stopSafe();
          return;
        }
        if (performance.now() - t0 > durationMs + 500) {
          video.pause();
          stopSafe();
          return;
        }
        requestAnimationFrame(pump);
      };

      try {
        rec.start(200);
      } catch (e) {
        done(e instanceof Error ? e : new Error(String(e)));
        return;
      }

      video.currentTime = 0;
      void video
        .play()
        .then(() => {
          requestAnimationFrame(pump);
        })
        .catch(() =>
          done(new Error("Could not play video for export (autoplay blocked?).")),
        );
    });
  } finally {
    await disposeAudioTap();
    URL.revokeObjectURL(url);
    video.pause();
    video.removeAttribute("src");
    video.load();
    video.remove();
  }

  const baseMime =
    containerExt === "mp4"
      ? "video/mp4"
      : recMime.mime.split(";")[0] || "video/webm";
  return new Blob(chunks, { type: baseMime });
}

export function canvasSupportsWebpExport(): boolean {
  if (typeof document === "undefined") return false;
  const c = document.createElement("canvas");
  return c.toDataURL("image/webp").startsWith("data:image/webp");
}
