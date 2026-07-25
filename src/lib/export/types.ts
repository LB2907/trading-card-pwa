import type { CardInstance } from "@/lib/db/schema";

export type CardExportRow = {
  instance: CardInstance;
  layoutJson: string;
  setName: string | null;
};

/** Per-run options for composited card exports (e.g. single-card modal). */
export type CardExportOptions = {
  /** When true, skip painting the user-configured export watermark. */
  omitWatermark?: boolean;
  /** Override the still-image export pixel ratio (resolution preset). */
  pixelRatio?: number;
  /**
   * Video only. Recording runs in real time with no duration cap, so a long
   * clip needs both of these to stay tolerable.
   */
  onVideoProgress?: (progress: CardVideoProgress) => void;
  signal?: AbortSignal;
};

/** Progress of a composited video export; see `buildCompositedCardVideoBlob`. */
export type CardVideoProgress = {
  /** 0..1 through the clip, or null when the source has no known duration. */
  fraction: number | null;
  elapsedMs: number;
  /** Clip length in ms, or null when unknown. Export time tracks this 1:1. */
  totalMs: number | null;
};
