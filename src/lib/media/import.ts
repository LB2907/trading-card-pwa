/** Local-only import: GIF first frame → PNG; WebP → JPEG; video → frame via canvas. */

export async function gifFirstFrameAsPng(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  try {
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas unsupported");
    ctx.drawImage(bitmap, 0, 0);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b: Blob | null) => resolve(b), "image/png"),
    );
    if (!blob) throw new Error("PNG encode failed");
    return blob;
  } finally {
    bitmap.close();
  }
}

/** Rasterize to JPEG (used for WebP and anything we want in a universally decodable format). */
export async function rasterImageToJpeg(
  file: Blob,
  quality = 0.92,
): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  try {
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas unsupported");
    ctx.drawImage(bitmap, 0, 0);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(
        (b: Blob | null) => resolve(b),
        "image/jpeg",
        quality,
      ),
    );
    if (!blob) throw new Error("JPEG encode failed");
    return blob;
  } finally {
    bitmap.close();
  }
}

export function seekVideo(
  video: HTMLVideoElement,
  time: number,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const finishOk = () => {
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("error", onErr);
      resolve();
    };
    const onSeeked = () => finishOk();
    const onErr = () => {
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("error", onErr);
      reject(new Error("Seek failed"));
    };
    video.addEventListener("seeked", onSeeked);
    video.addEventListener("error", onErr);
    if (Number.isFinite(video.duration) && video.duration > 0) {
      if (Math.abs(video.currentTime - time) < 0.001) {
        finishOk();
        return;
      }
    } else if (time <= 0 && video.currentTime <= 0.001) {
      finishOk();
      return;
    }
    try {
      video.currentTime = time;
    } catch {
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("error", onErr);
      reject(new Error("Seek failed"));
    }
  });
}

export function waitLoadedMetadata(video: HTMLVideoElement): Promise<void> {
  if (video.readyState >= HTMLMediaElement.HAVE_METADATA) {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const to = window.setTimeout(
      () => reject(new Error("Video load timed out")),
      60_000,
    );
    const clear = () => window.clearTimeout(to);
    video.addEventListener(
      "loadedmetadata",
      () => {
        clear();
        resolve();
      },
      { once: true },
    );
    video.addEventListener(
      "error",
      () => {
        clear();
        reject(
          new Error(
            "Video load failed (unsupported codec, corrupt file, or browser cannot decode this format).",
          ),
        );
      },
      { once: true },
    );
  });
}

export async function waitForPaintedFrame(
  video: HTMLVideoElement,
): Promise<void> {
  const v = video as HTMLVideoElement & {
    requestVideoFrameCallback?: (
      cb: (now: number, metadata: unknown) => void,
    ) => number;
    cancelVideoFrameCallback?: (handle: number) => void;
  };
  if (typeof v.requestVideoFrameCallback === "function") {
    await new Promise<void>((resolve) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        resolve();
      };
      let handle: number;
      try {
        handle = v.requestVideoFrameCallback!(() => finish());
      } catch {
        finish();
        return;
      }
      window.setTimeout(() => {
        try {
          v.cancelVideoFrameCallback?.(handle);
        } catch {
          /* noop */
        }
        finish();
      }, 750);
    });
    return;
  }
  try {
    await video.play();
    video.pause();
  } catch {
    /* muted + inline should allow play; ignore if blocked */
  }
  await new Promise<void>((r) => requestAnimationFrame(() => r()));
}

export async function videoFrameAtTime(
  file: File,
  timeSeconds: number,
): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.setAttribute("playsinline", "");
    video.setAttribute("webkit-playsinline", "");
    video.preload = "auto";
    video.src = url;

    await waitLoadedMetadata(video);

    const dur = video.duration;
    const hasDur = Number.isFinite(dur) && dur > 0;
    const t = hasDur
      ? Math.min(Math.max(0, timeSeconds), Math.max(0, dur - 0.05))
      : Math.max(0, timeSeconds);

    await seekVideo(video, t);
    await waitForPaintedFrame(video);

    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) {
      throw new Error(
        "Could not read video dimensions (file may be audio-only or use an unsupported codec).",
      );
    }
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas unsupported");
    ctx.drawImage(video, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b: Blob | null) => resolve(b), "image/png"),
    );
    if (!blob) throw new Error("PNG encode failed");
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function extensionOf(file: File): string {
  const n = file.name.toLowerCase();
  const i = n.lastIndexOf(".");
  return i >= 0 ? n.slice(i) : "";
}

const VIDEO_EXT = new Set([
  ".mp4",
  ".webm",
  ".mov",
  ".mkv",
  ".ogv",
  ".m4v",
]);

export function isVideoFile(file: File): boolean {
  if (file.type.startsWith("video/")) return true;
  return VIDEO_EXT.has(extensionOf(file));
}

export function isWebpFile(file: File): boolean {
  return extensionOf(file) === ".webp" || file.type === "image/webp";
}

/**
 * Decode a local video blob to a frame suitable for `drawImage`. Call `dispose()` after compositing.
 */
export async function openVideoForCompositor(blob: Blob): Promise<{
  video: HTMLVideoElement;
  dispose: () => void;
}> {
  const url = URL.createObjectURL(blob);
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.setAttribute("playsinline", "");
  video.setAttribute("webkit-playsinline", "");
  video.preload = "auto";
  video.src = url;
  await waitLoadedMetadata(video);
  const dur = video.duration;
  const hasDur = Number.isFinite(dur) && dur > 0;
  const t = hasDur ? Math.min(0.08, Math.max(0, dur * 0.02)) : 0;
  await seekVideo(video, t);
  await waitForPaintedFrame(video);
  return {
    video,
    dispose: () => {
      URL.revokeObjectURL(url);
      video.removeAttribute("src");
      video.load();
      video.remove();
    },
  };
}
