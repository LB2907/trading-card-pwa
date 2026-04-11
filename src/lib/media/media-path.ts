/** Media storage keys look like `uuid.ext` (see `randomMediaId`). */

export function extensionFromMediaPath(mediaPath: string): string {
  const i = mediaPath.lastIndexOf(".");
  if (i < 0) return "";
  return mediaPath.slice(i).toLowerCase();
}

export function mimeFromMediaPath(mediaPath: string): string {
  const ext = extensionFromMediaPath(mediaPath);
  const map: Record<string, string> = {
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webm": "video/webm",
    ".mp4": "video/mp4",
    ".mov": "video/quicktime",
    ".mkv": "video/x-matroska",
    ".ogv": "video/ogg",
    ".m4v": "video/x-m4v",
  };
  return map[ext] ?? "application/octet-stream";
}

export function safeFileStem(name: string, max = 40): string {
  const t = name.trim() || "card";
  return t.slice(0, max).replace(/\W+/g, "_").replace(/_+/g, "_");
}
