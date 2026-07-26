"use client";

/**
 * Picking a `VideoEncoder` configuration.
 *
 * H.264 in MP4 is preferred — it is what X and iOS want — but hardware support
 * is not guaranteed even where WebCodecs exists (this project's own test browser
 * reports `VideoEncoder` present with AVC unsupported and VP8/VP9 fine), so the
 * VP9/VP8-in-WebM fallbacks are load-bearing rather than theoretical.
 */

export type GifVideoCodec = {
  /** Container to mux into. */
  container: "mp4" | "webm";
  /** WebCodecs codec string. */
  codec: string;
  /** Codec identifier the muxer expects. */
  muxerCodec: "avc" | "vp9" | "vp8";
  ext: "mp4" | "webm";
};

/**
 * Ordered by preference. Levels are high enough for a full-size card
 * (1260×1764 is 2.2 MP, above what level 4.0 allows).
 */
const CANDIDATES: readonly GifVideoCodec[] = [
  { container: "mp4", codec: "avc1.640034", muxerCodec: "avc", ext: "mp4" },
  { container: "mp4", codec: "avc1.4d0034", muxerCodec: "avc", ext: "mp4" },
  { container: "mp4", codec: "avc1.420034", muxerCodec: "avc", ext: "mp4" },
  { container: "mp4", codec: "avc1.640033", muxerCodec: "avc", ext: "mp4" },
  { container: "mp4", codec: "avc1.4d0033", muxerCodec: "avc", ext: "mp4" },
  { container: "mp4", codec: "avc1.42001f", muxerCodec: "avc", ext: "mp4" },
  { container: "webm", codec: "vp09.00.10.08", muxerCodec: "vp9", ext: "webm" },
  { container: "webm", codec: "vp8", muxerCodec: "vp8", ext: "webm" },
] as const;

export function hasVideoEncoder(): boolean {
  return typeof VideoEncoder !== "undefined";
}

/**
 * H.264 requires even dimensions; round rather than fail at configure time.
 *
 * Guards non-finite input explicitly — `Math.max(2, NaN)` is `NaN`, which would
 * sail through to `encoder.configure` and fail there instead of here.
 */
export function evenDimension(n: number): number {
  if (!Number.isFinite(n)) return 2;
  const v = Math.max(2, Math.round(n));
  return v % 2 === 0 ? v : v - 1;
}

export async function pickGifVideoCodec(opts: {
  width: number;
  height: number;
  framerate: number;
  bitrate: number;
}): Promise<GifVideoCodec | null> {
  if (!hasVideoEncoder()) return null;
  for (const candidate of CANDIDATES) {
    try {
      const support = await VideoEncoder.isConfigSupported({
        codec: candidate.codec,
        width: opts.width,
        height: opts.height,
        bitrate: opts.bitrate,
        framerate: opts.framerate,
      });
      if (support.supported) return candidate;
    } catch {
      /* try the next candidate */
    }
  }
  return null;
}
