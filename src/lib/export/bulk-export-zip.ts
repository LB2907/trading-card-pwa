import { zip } from "fflate";
import type { CardExportRow } from "@/lib/export/types";
import {
  getCompositedCardGifBlob,
  getCompositedCardJpegBlob,
  getCompositedCardPngBlob,
  getCompositedCardVideoBlob,
  getCompositedCardWebpBlob,
  getOriginalMediaBlob,
} from "@/lib/export-card-download";
import {
  extensionFromMediaPath,
  safeFileStem,
} from "@/lib/media/media-path";

export type BulkExportKind =
  | "png"
  | "jpeg"
  | "webp"
  | "gif"
  | "video"
  | "original";

async function blobToU8(blob: Blob): Promise<Uint8Array> {
  return new Uint8Array(await blob.arrayBuffer());
}

/** Compress off the main thread (fflate spins its own workers) so a large
 * bulk export never freezes the UI during zipping. */
function zipAsync(files: Record<string, Uint8Array>): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    zip(files, { level: 6 }, (err, data) => {
      if (err) reject(err);
      else resolve(data);
    });
  });
}

/** Let the browser paint / handle input between heavy card renders. */
function yieldToEventLoop(): Promise<void> {
  return new Promise((r) => setTimeout(r, 0));
}

export async function buildBulkExportZip(
  rows: CardExportRow[],
  kinds: BulkExportKind[],
  opts?: {
    onProgress?: (done: number, total: number) => void;
    signal?: AbortSignal;
  },
): Promise<{ blob: Blob; entryCount: number }> {
  const files: Record<string, Uint8Array> = {};
  const totalJobs = rows.length * kinds.length;
  let doneJobs = 0;

  for (const row of rows) {
    if (opts?.signal?.aborted) break;
    const stem = safeFileStem(row.instance.name || "card").slice(0, 80);
    const shortId = row.instance.id.replace(/-/g, "").slice(0, 10);

    for (const k of kinds) {
      if (opts?.signal?.aborted) break;
      try {
        let u8: Uint8Array;
        let name: string;
        switch (k) {
          case "png": {
            const b = await getCompositedCardPngBlob(row);
            u8 = await blobToU8(b);
            name = `${stem}_${shortId}_card.png`;
            break;
          }
          case "jpeg": {
            const b = await getCompositedCardJpegBlob(row);
            u8 = await blobToU8(b);
            name = `${stem}_${shortId}_card.jpg`;
            break;
          }
          case "webp": {
            const b = await getCompositedCardWebpBlob(row);
            u8 = await blobToU8(b);
            name = `${stem}_${shortId}_card.webp`;
            break;
          }
          case "gif": {
            const b = await getCompositedCardGifBlob(row);
            u8 = await blobToU8(b);
            name = `${stem}_${shortId}_card.gif`;
            break;
          }
          case "video": {
            const b = await getCompositedCardVideoBlob(row);
            u8 = await blobToU8(b);
            const ext = b.type.toLowerCase().includes("mp4") ? "mp4" : "webm";
            name = `${stem}_${shortId}_card.${ext}`;
            break;
          }
          case "original": {
            const b = await getOriginalMediaBlob(row);
            u8 = await blobToU8(b);
            const ext = extensionFromMediaPath(row.instance.mediaPath) || ".bin";
            name = `${stem}_${shortId}_original${ext}`;
            break;
          }
          default:
            continue;
        }
        const path = `cards/${name}`;
        let key = path;
        let n = 1;
        while (files[key]) {
          const dot = path.lastIndexOf(".");
          key =
            dot > 0
              ? `${path.slice(0, dot)}_${n}${path.slice(dot)}`
              : `${path}_${n}`;
          n++;
        }
        files[key] = u8;
      } catch {
        // Skip failed asset for this card/kind; caller can inspect empty zip edge case.
      }
      doneJobs++;
      opts?.onProgress?.(doneJobs, totalJobs);
    }
    // Yield after each card so the progress UI updates and input stays
    // responsive instead of the whole batch janking the main thread.
    await yieldToEventLoop();
  }

  const entryCount = Object.keys(files).length;
  if (entryCount === 0) {
    return { blob: new Blob(), entryCount: 0 };
  }
  const zipBytes = await zipAsync(files);
  return {
    blob: new Blob([new Uint8Array(zipBytes)], { type: "application/zip" }),
    entryCount,
  };
}
