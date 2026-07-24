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
};
