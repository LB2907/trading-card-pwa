/**
 * Message shapes shared between the GIF encode worker and its caller.
 *
 * Kept in its own module so the worker and the main thread agree on the
 * protocol without either importing the other.
 */

import type { GifPalette } from "@/lib/export/gif-encode-core";

export type GifWorkerRequest =
  | {
      type: "train";
      id: number;
      /** Subsampled RGBA, transferred. */
      samples: ArrayBuffer;
      maxColors: number;
    }
  | {
      type: "init";
      id: number;
      width: number;
      height: number;
      palette: GifPalette;
      difference: boolean;
    }
  | {
      type: "frame";
      id: number;
      /** One frame of RGBA, transferred. */
      rgba: ArrayBuffer;
      delayMs: number;
    }
  | { type: "finish"; id: number }
  | { type: "dispose"; id: number };

export type GifWorkerResponse =
  | { type: "palette"; id: number; palette: GifPalette }
  | { type: "ready"; id: number }
  | { type: "frameDone"; id: number; frameCount: number }
  | { type: "done"; id: number; bytes: ArrayBuffer }
  | { type: "error"; id: number; message: string };
