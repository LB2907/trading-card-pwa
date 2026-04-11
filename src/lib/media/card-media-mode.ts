import { extensionFromMediaPath } from "@/lib/media/media-path";

const VIDEO_EXT = new Set([
  ".webm",
  ".mp4",
  ".mov",
  ".mkv",
  ".ogv",
  ".m4v",
]);

export type CardMediaMode = "canvas" | "gif" | "video";

/**
 * How to render card art in the UI. Uses `media_kind` plus file extension / MIME
 * so legacy rows (wrong kind) still play GIF/video when the stored file supports it.
 */
export function cardMediaMode(instance: {
  mediaPath: string;
  mediaKind: string;
}): CardMediaMode {
  const ext = extensionFromMediaPath(instance.mediaPath);
  const k = instance.mediaKind;

  if (k === "gif" || ext === ".gif") return "gif";
  if (k === "video" || VIDEO_EXT.has(ext)) return "video";

  return "canvas";
}

/** Force MIME from extension so GIF animates and `<video>` decodes (OPFS often yields empty type). */
export function withPlaybackMime(blob: Blob, mediaPath: string): Blob {
  const ext = extensionFromMediaPath(mediaPath);
  const map: Record<string, string> = {
    ".gif": "image/gif",
    ".webm": "video/webm",
    ".mp4": "video/mp4",
    ".mov": "video/quicktime",
    ".mkv": "video/x-matroska",
    ".ogv": "video/ogg",
    ".m4v": "video/x-m4v",
  };
  const want = map[ext];
  if (!want) return blob;
  if (blob.type === want) return blob;
  return new Blob([blob], { type: want });
}
