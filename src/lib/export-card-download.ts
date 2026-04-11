"use client";

import {
  CARD_EXPORT_PIXEL_RATIO,
  CARD_LAYOUT_WIDTH,
} from "@/lib/compositor/card-resolution";
import { exportCardAsBlob, exportCardPng } from "@/lib/compositor/draw-card";
import { parseLayout } from "@/lib/card-layout";
import {
  buildCompositedCardGifBlob,
  buildCompositedCardVideoBlob,
  getCompositedCardVideoExportFormat,
  canvasSupportsWebpExport,
} from "@/lib/export/card-rendered-media";
import { loadArtForCompositor } from "@/lib/media/compositor-source";
import {
  extensionFromMediaPath,
  mimeFromMediaPath,
  safeFileStem,
} from "@/lib/media/media-path";
import { loadUserBlob } from "@/lib/media/storage";
import {
  getExportWatermarkText,
  writeToExportDirectory,
} from "@/lib/export-preferences";

export type { CardExportRow, CardExportOptions } from "@/lib/export/types";
import type { CardExportRow, CardExportOptions } from "@/lib/export/types";

function compositedWatermarkText(opts?: CardExportOptions): string {
  if (opts?.omitWatermark) return "";
  return getExportWatermarkText();
}

export async function downloadBlobLocally(
  blob: Blob,
  filename: string,
): Promise<void> {
  if (await writeToExportDirectory(blob, filename)) {
    return;
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  window.setTimeout(() => {
    a.remove();
    URL.revokeObjectURL(url);
  }, 500);
}

async function triggerDownload(blob: Blob, filename: string): Promise<void> {
  await downloadBlobLocally(blob, filename);
}

/** Flattened card image (PNG), with video frame / GIF first frame in the art area. */
export async function getCompositedCardPngBlob(
  row: CardExportRow,
  opts?: CardExportOptions,
): Promise<Blob> {
  const blob = await loadUserBlob(row.instance.mediaPath);
  if (!blob) {
    throw new Error("Art file missing from local storage — cannot render card.");
  }
  const { source, dispose } = await loadArtForCompositor(blob, row.instance);
  try {
    const layout = parseLayout(row.layoutJson);
    const watermarkText = compositedWatermarkText(opts);
    return await exportCardPng({
      instance: row.instance,
      layout,
      artImage: source,
      width: CARD_LAYOUT_WIDTH,
      pixelRatio: CARD_EXPORT_PIXEL_RATIO,
      watermarkText,
    });
  } finally {
    dispose();
  }
}

export async function downloadCompositedCardPng(
  row: CardExportRow,
  opts?: CardExportOptions,
): Promise<void> {
  const png = await getCompositedCardPngBlob(row, opts);
  const stem = safeFileStem(row.instance.name || "card");
  triggerDownload(png, `${stem}_card.png`);
}

/** Full card as JPEG (single frame for video/GIF art). */
export async function getCompositedCardJpegBlob(
  row: CardExportRow,
  opts?: CardExportOptions,
): Promise<Blob> {
  const blob = await loadUserBlob(row.instance.mediaPath);
  if (!blob) {
    throw new Error("Art file missing from local storage — cannot render card.");
  }
  const { source, dispose } = await loadArtForCompositor(blob, row.instance);
  try {
    const layout = parseLayout(row.layoutJson);
    const watermarkText = compositedWatermarkText(opts);
    return await exportCardAsBlob(
      {
        instance: row.instance,
        layout,
        artImage: source,
        width: CARD_LAYOUT_WIDTH,
        pixelRatio: CARD_EXPORT_PIXEL_RATIO,
        watermarkText,
      },
      "image/jpeg",
      0.92,
    );
  } finally {
    dispose();
  }
}

export async function downloadCompositedCardJpeg(
  row: CardExportRow,
  opts?: CardExportOptions,
): Promise<void> {
  const jpeg = await getCompositedCardJpegBlob(row, opts);
  const stem = safeFileStem(row.instance.name || "card");
  triggerDownload(jpeg, `${stem}_card.jpg`);
}

/** Full card as WebP when the browser supports `canvas` → WebP. */
export async function getCompositedCardWebpBlob(
  row: CardExportRow,
  opts?: CardExportOptions,
): Promise<Blob> {
  if (!canvasSupportsWebpExport()) {
    throw new Error("WebP export is not supported in this browser.");
  }
  const blob = await loadUserBlob(row.instance.mediaPath);
  if (!blob) {
    throw new Error("Art file missing from local storage — cannot render card.");
  }
  const { source, dispose } = await loadArtForCompositor(blob, row.instance);
  try {
    const layout = parseLayout(row.layoutJson);
    const watermarkText = compositedWatermarkText(opts);
    return await exportCardAsBlob(
      {
        instance: row.instance,
        layout,
        artImage: source,
        width: CARD_LAYOUT_WIDTH,
        pixelRatio: CARD_EXPORT_PIXEL_RATIO,
        watermarkText,
      },
      "image/webp",
      0.92,
    );
  } finally {
    dispose();
  }
}

export async function downloadCompositedCardWebp(
  row: CardExportRow,
  opts?: CardExportOptions,
): Promise<void> {
  const webp = await getCompositedCardWebpBlob(row, opts);
  const stem = safeFileStem(row.instance.name || "card");
  triggerDownload(webp, `${stem}_card.webp`);
}

export async function getCompositedCardGifBlob(
  row: CardExportRow,
  opts?: CardExportOptions,
): Promise<Blob> {
  return buildCompositedCardGifBlob(row, {
    watermarkText: compositedWatermarkText(opts),
  });
}

/** Full card as GIF (animated when art is GIF; one frame otherwise). */
export async function downloadCompositedCardGif(
  row: CardExportRow,
  opts?: CardExportOptions,
): Promise<void> {
  const gifBlob = await getCompositedCardGifBlob(row, opts);
  const stem = safeFileStem(row.instance.name || "card");
  triggerDownload(gifBlob, `${stem}_card.gif`);
}

/**
 * Full card as video: MP4 when the browser supports it (typical on Safari / iPhone),
 * otherwise WebM. Filename matches the container.
 */
export async function getCompositedCardVideoBlob(
  row: CardExportRow,
  opts?: CardExportOptions,
): Promise<Blob> {
  const fmt = getCompositedCardVideoExportFormat();
  if (!fmt) {
    throw new Error(
      "Video export is not supported in this browser (no MP4/WebM recorder).",
    );
  }
  return buildCompositedCardVideoBlob(row, {
    watermarkText: compositedWatermarkText(opts),
  });
}

export async function downloadCompositedCardVideo(
  row: CardExportRow,
  opts?: CardExportOptions,
): Promise<void> {
  const fmt = getCompositedCardVideoExportFormat();
  if (!fmt) {
    throw new Error(
      "Video export is not supported in this browser (no MP4/WebM recorder).",
    );
  }
  const blob = await getCompositedCardVideoBlob(row, opts);
  const stem = safeFileStem(row.instance.name || "card");
  const ext = blob.type.toLowerCase().includes("mp4") ? "mp4" : fmt.ext;
  triggerDownload(blob, `${stem}_card.${ext}`);
}

export async function getOriginalMediaBlob(row: CardExportRow): Promise<Blob> {
  const blob = await loadUserBlob(row.instance.mediaPath);
  if (!blob) {
    throw new Error("Art file missing from local storage.");
  }
  return blob.type && blob.type !== "application/octet-stream"
    ? blob
    : new Blob([blob], { type: mimeFromMediaPath(row.instance.mediaPath) });
}

/** Raw stored file (GIF, WebM, JPEG, …). */
export async function downloadOriginalMedia(row: CardExportRow): Promise<void> {
  const typed = await getOriginalMediaBlob(row);
  const ext = extensionFromMediaPath(row.instance.mediaPath) || ".bin";
  const stem = safeFileStem(row.instance.name || "card");
  triggerDownload(typed, `${stem}_original${ext}`);
}

async function shareFile(blob: Blob, filename: string): Promise<boolean> {
  const type =
    blob.type && blob.type !== "application/octet-stream"
      ? blob.type
      : mimeFromMediaPath(filename);
  const file = new File([blob], filename, { type });
  const nav = navigator as Navigator & {
    share?: (data: ShareData & { files?: File[] }) => Promise<void>;
    canShare?: (data: { files: File[] }) => boolean;
  };
  if (!nav.share || !nav.canShare?.({ files: [file] })) return false;
  await nav.share({ files: [file], title: filename });
  return true;
}

export async function shareCompositedPng(
  row: CardExportRow,
  opts?: CardExportOptions,
): Promise<boolean> {
  try {
    const png = await getCompositedCardPngBlob(row, opts);
    const name = `${safeFileStem(row.instance.name || "card")}_card.png`;
    return await shareFile(png, name);
  } catch {
    return false;
  }
}

export async function shareOriginalMedia(row: CardExportRow): Promise<boolean> {
  try {
    const typed = await getOriginalMediaBlob(row);
    const ext = extensionFromMediaPath(row.instance.mediaPath) || ".bin";
    const name = `${safeFileStem(row.instance.name || "card")}_original${ext}`;
    return await shareFile(typed, name);
  } catch {
    return false;
  }
}
