"use client";

/**
 * Encodes a GIF-art card to MP4/WebM via WebCodecs.
 *
 * Worth having because X transcodes every uploaded GIF to silent MP4 anyway,
 * and its video limits are far looser than its GIF ones (512 MB / 140 s for a
 * free account, against 15 MB / 30 s for a GIF). Discord is the opposite — it
 * autoplays and loops GIFs inline but shows a play button for video — so this
 * complements the GIF export rather than replacing it.
 *
 * ## Why not MediaRecorder
 *
 * The first implementation drove `MediaRecorder` from `canvas.captureStream(0)`
 * plus `requestFrame()`, playing the animation against the wall clock. It lost
 * almost every frame. A real 5.285 s export contained **ten** frames, with
 * durations of 32, 40, 42, 132, 122, 125, 123, 1112, 2 and 3557 ms — smooth for
 * half a second, then two long freezes. `MediaRecorder` samples a live canvas in
 * real time and silently drops whatever the pipeline cannot keep up with, and at
 * 1260×1764 with GIF decoding and card compositing on the same thread it kept up
 * with about 2 fps. No amount of timing care fixes that; the frames never reach
 * the encoder.
 *
 * `VideoEncoder` takes frames with explicit timestamps and durations, so the
 * output has exactly the frames handed to it, for exactly the intended time,
 * with no realtime constraint — and it runs faster than realtime rather than
 * making the user wait out the clip.
 */

import { Muxer as Mp4Muxer, ArrayBufferTarget as Mp4Target } from "mp4-muxer";
import {
  Muxer as WebmMuxer,
  ArrayBufferTarget as WebmTarget,
} from "webm-muxer";
import { cardCanvasSize, drawTradingCard } from "@/lib/compositor/draw-card";
import type { LuminanceProbe } from "@/lib/compositor/watermark-ink";
import { ensureCardFontsLoaded } from "@/lib/compositor/canvas-font";
import { parseLayout } from "@/lib/card-layout";
import {
  CARD_LAYOUT_WIDTH,
  CARD_VIDEO_EXPORT_PIXEL_RATIO,
  videoBitrateFor,
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
  evenDimension,
  hasVideoEncoder,
  pickGifVideoCodec,
  type GifVideoCodec,
} from "@/lib/export/gif-video-codec";
import { CardVideoExportAborted } from "@/lib/export/card-rendered-media";

/** Keyframe cadence. Frequent enough that scrubbing and looping stay snappy. */
const KEYFRAME_INTERVAL = 30;

/** Cap on frames queued in the encoder before we let it drain. */
const MAX_ENCODE_QUEUE = 8;

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
  /** Frames actually handed to the encoder. */
  frames: number;
  codec: string;
};

function nextTick(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/** Dimensions the encoder will accept for a card at the given pixel ratio. */
export function gifVideoDimensions(pixelRatio = CARD_VIDEO_EXPORT_PIXEL_RATIO): {
  width: number;
  height: number;
} {
  const { bufW, bufH } = cardCanvasSize(CARD_LAYOUT_WIDTH, pixelRatio);
  return { width: evenDimension(bufW), height: evenDimension(bufH) };
}

/**
 * Whether this card can be exported as video here. Async because codec support
 * has to be asked for rather than assumed.
 */
export async function canExportGifCardVideo(
  row: CardExportRow,
): Promise<boolean> {
  if (cardMediaMode(row.instance) !== "gif") return false;
  if (!hasVideoEncoder()) return false;
  const { width, height } = gifVideoDimensions();
  const codec = await pickGifVideoCodec({
    width,
    height,
    framerate: 30,
    bitrate: videoBitrateFor(width, height, 30),
  });
  return codec !== null;
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
  if (!hasVideoEncoder()) {
    throw new Error(
      "This browser cannot encode video (WebCodecs VideoEncoder is unavailable). Try an up-to-date Chrome, Edge or Safari.",
    );
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
  const { width, height } = gifVideoDimensions();
  const framerate = captureFpsForDelays(delaysMs);
  const bitrate = videoBitrateFor(width, height, framerate);

  const codec: GifVideoCodec | null = await pickGifVideoCodec({
    width,
    height,
    framerate,
    bitrate,
  });
  if (!codec) {
    throw new Error(
      "This browser has no video encoder that can handle a full-size card. Export the GIF instead.",
    );
  }
  throwIfAborted();

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
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

  const mp4Target = codec.container === "mp4" ? new Mp4Target() : null;
  const webmTarget = codec.container === "webm" ? new WebmTarget() : null;
  const muxer =
    codec.container === "mp4"
      ? new Mp4Muxer({
          target: mp4Target!,
          video: { codec: "avc", width, height },
          // Everything is in memory anyway, and it puts the index up front so
          // the file streams and previews properly.
          fastStart: "in-memory",
        })
      : new WebmMuxer({
          target: webmTarget!,
          video: {
            codec: codec.muxerCodec === "vp9" ? "V_VP9" : "V_VP8",
            width,
            height,
          },
        });

  let encoderError: Error | null = null;
  const encoder = new VideoEncoder({
    output: (chunk, meta) => {
      try {
        // The two muxers have structurally identical addVideoChunk signatures
        // but no shared type, so this narrows rather than casts to any.
        if (codec.container === "mp4") {
          (muxer as Mp4Muxer<Mp4Target>).addVideoChunk(chunk, meta);
        } else {
          (muxer as WebmMuxer<WebmTarget>).addVideoChunk(chunk, meta);
        }
      } catch (e) {
        encoderError ??= e instanceof Error ? e : new Error(String(e));
      }
    },
    error: (e) => {
      encoderError ??= e instanceof Error ? e : new Error(String(e));
    },
  });
  encoder.configure({ codec: codec.codec, width, height, bitrate, framerate });

  const startedAt = performance.now();
  let encoded = 0;
  let timestampUs = 0;

  try {
    for (let loop = 0; loop < plan.loops; loop++) {
      for await (const { index, bitmap } of fullFramesFromGif(parsed, frames)) {
        try {
          throwIfAborted();
          if (encoderError) throw encoderError;
          paintCard(bitmap);
        } finally {
          bitmap.close();
        }

        const durationUs = Math.max(1, Math.round((delaysMs[index] ?? 100) * 1000));
        const frame = new VideoFrame(canvas, {
          timestamp: timestampUs,
          duration: durationUs,
        });
        try {
          encoder.encode(frame, { keyFrame: encoded % KEYFRAME_INTERVAL === 0 });
        } finally {
          frame.close();
        }
        timestampUs += durationUs;
        encoded++;

        opts?.onProgress?.({
          fraction: encoded / plan.frameCount,
          elapsedMs: performance.now() - startedAt,
          totalMs: null,
        });

        // Let the encoder drain rather than queuing the whole animation, which
        // would hold every pending frame's memory at once.
        while (encoder.encodeQueueSize > MAX_ENCODE_QUEUE) {
          await nextTick();
          throwIfAborted();
          if (encoderError) throw encoderError;
        }
      }
    }

    await encoder.flush();
    if (encoderError) throw encoderError;
    muxer.finalize();

    const buffer =
      codec.container === "mp4" ? mp4Target!.buffer : webmTarget!.buffer;
    if (!buffer || buffer.byteLength === 0) {
      throw new Error("Video export produced no data.");
    }
    const blob = new Blob([buffer], {
      type: codec.container === "mp4" ? "video/mp4" : "video/webm",
    });
    return {
      blob,
      ext: codec.ext,
      plan,
      width,
      height,
      frames: encoded,
      codec: codec.codec,
    };
  } finally {
    if (encoder.state !== "closed") {
      try {
        encoder.close();
      } catch {
        /* noop */
      }
    }
  }
}
