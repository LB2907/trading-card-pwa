"use client";

/**
 * Composites a video-art card to MP4 using mediabunny (demux → decode → encode
 * → mux), replacing a `MediaRecorder` path that was bound to real time.
 *
 * The old path played the clip at 1× and recorded the canvas as it went, so a
 * 60 s clip cost the user 60 s — measured, a little worse than that: a 2 s clip
 * took 3.8 s and a 3 s clip took 4.8 s. It also inherited the architecture that
 * dropped ~80 % of frames in the GIF export. Hand-checking on a real device
 * showed video cards did *not* stutter — playback-driven pumping keeps the main
 * thread free in a way the GIF path's tight decode/composite loop did not — so
 * this is a speed and consistency change, not a correctness fix.
 *
 * Decoding through WebCodecs removes the realtime constraint entirely: frames
 * arrive as fast as they can be decoded and composited.
 *
 * Audio is passed through **without re-encoding** when the source codec fits the
 * output container, which is both faster and lossless. Only when it does not
 * (e.g. Opus into MP4 on an engine that refuses it) is it decoded and
 * re-encoded.
 */

import {
  ALL_FORMATS,
  AudioBufferSink,
  AudioBufferSource,
  BlobSource,
  BufferTarget,
  CanvasSource,
  EncodedAudioPacketSource,
  EncodedPacketSink,
  Input,
  Mp4OutputFormat,
  Output,
  VideoSampleSink,
  type AudioCodec,
} from "mediabunny";
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
import { evenDimension } from "@/lib/export/gif-video-codec";
import { CardVideoExportAborted } from "@/lib/export/card-rendered-media";

/** Key frames every couple of seconds keeps seeking responsive. */
const KEY_FRAME_INTERVAL_S = 2;

/** Fallback when a source track reports no usable frame rate. */
const FALLBACK_FPS = 30;

export type CardVideoEncodeOptions = {
  watermarkText?: string;
  onProgress?: (p: CardVideoProgress) => void;
  signal?: AbortSignal;
};

export type CardVideoEncodeResult = {
  blob: Blob;
  ext: "mp4";
  width: number;
  height: number;
  frames: number;
  /** How the audio track was handled, for reporting and tests. */
  audio: "passthrough" | "reencoded" | "none";
};

/** Whether this card can take the WebCodecs video path here. */
export async function canEncodeVideoCard(
  row: CardExportRow,
): Promise<boolean> {
  if (cardMediaMode(row.instance) !== "video") return false;
  return typeof VideoEncoder !== "undefined";
}

export async function buildCompositedVideoCardBlob(
  row: CardExportRow,
  opts?: CardVideoEncodeOptions,
): Promise<CardVideoEncodeResult> {
  const signal = opts?.signal;
  const throwIfAborted = () => {
    if (signal?.aborted) throw new CardVideoExportAborted();
  };
  throwIfAborted();

  if (cardMediaMode(row.instance) !== "video") {
    throw new Error("This export only works when the card art is a video.");
  }
  if (typeof VideoEncoder === "undefined") {
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

  const input = new Input({
    source: new BlobSource(typed),
    formats: ALL_FORMATS,
  });
  const videoTrack = await input.getPrimaryVideoTrack();
  if (!videoTrack) {
    throw new Error("This file has no video track.");
  }
  if (!(await videoTrack.canDecode())) {
    throw new Error("This browser cannot decode this video's codec.");
  }
  const audioTrack = await input.getPrimaryAudioTrack();
  const totalSeconds = await input.computeDuration();
  throwIfAborted();

  const { bufW, bufH } = cardCanvasSize(
    CARD_LAYOUT_WIDTH,
    CARD_VIDEO_EXPORT_PIXEL_RATIO,
  );
  const width = evenDimension(bufW);
  const height = evenDimension(bufH);

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

  const output = new Output({
    format: new Mp4OutputFormat({ fastStart: "in-memory" }),
    target: new BufferTarget(),
  });

  const fps = (await videoTrack.computePacketStats?.(60))?.averagePacketRate;
  const bitrate = videoBitrateFor(
    width,
    height,
    Number.isFinite(fps) && (fps ?? 0) > 0 ? (fps as number) : FALLBACK_FPS,
  );
  const videoSource = new CanvasSource(canvas, {
    codec: "avc",
    bitrate,
    keyFrameInterval: KEY_FRAME_INTERVAL_S,
  });
  output.addVideoTrack(videoSource);

  // --- audio ---
  let audioMode: CardVideoEncodeResult["audio"] = "none";
  let packetAudio: EncodedAudioPacketSource | null = null;
  let bufferAudio: AudioBufferSource | null = null;
  let sourceAudioCodec: AudioCodec | null = null;

  if (audioTrack) {
    sourceAudioCodec = await audioTrack.getCodec();
    const supported = output.format.getSupportedCodecs();
    if (sourceAudioCodec && supported.includes(sourceAudioCodec)) {
      // Copy the encoded packets straight across: no quality loss, no cost.
      packetAudio = new EncodedAudioPacketSource(sourceAudioCodec);
      output.addAudioTrack(packetAudio);
      audioMode = "passthrough";
    } else if (await audioTrack.canDecode()) {
      bufferAudio = new AudioBufferSource({
        codec: "aac",
        bitrate: 128_000,
      });
      output.addAudioTrack(bufferAudio);
      audioMode = "reencoded";
    }
  }

  await output.start();

  let frames = 0;
  const startedAt = performance.now();
  try {
    const sink = new VideoSampleSink(videoTrack);
    for await (const sample of sink.samples()) {
      try {
        throwIfAborted();
        // `toCanvasImageSource` hands back a VideoFrame or OffscreenCanvas;
        // `intrinsicArtSize` measures both, so the art is drawn without an
        // intermediate copy.
        paintCard(sample.toCanvasImageSource());
        await videoSource.add(sample.timestamp, sample.duration);
      } finally {
        sample.close();
      }
      frames++;
      opts?.onProgress?.({
        fraction:
          totalSeconds > 0
            ? Math.min(1, (sample.timestamp + sample.duration) / totalSeconds)
            : null,
        elapsedMs: performance.now() - startedAt,
        totalMs: null,
      });
    }
    videoSource.close();

    if (packetAudio && audioTrack) {
      const meta = {
        decoderConfig: (await audioTrack.getDecoderConfig()) ?? undefined,
      };
      const packetSink = new EncodedPacketSink(audioTrack);
      for await (const packet of packetSink.packets()) {
        throwIfAborted();
        await packetAudio.add(packet, meta);
      }
      packetAudio.close();
    } else if (bufferAudio && audioTrack) {
      const bufferSink = new AudioBufferSink(audioTrack);
      for await (const { buffer } of bufferSink.buffers()) {
        throwIfAborted();
        await bufferAudio.add(buffer);
      }
      bufferAudio.close();
    }

    await output.finalize();
    const buffer = output.target.buffer;
    if (!buffer || buffer.byteLength === 0) {
      throw new Error("Video export produced no data.");
    }
    return {
      blob: new Blob([buffer], { type: "video/mp4" }),
      ext: "mp4",
      width,
      height,
      frames,
      audio: audioMode,
    };
  } catch (e) {
    try {
      await output.cancel();
    } catch {
      /* the original failure is what matters */
    }
    throw e;
  } finally {
    await input.dispose?.();
  }
}
