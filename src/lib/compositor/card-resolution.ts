/**
 * Single source of truth for card raster dimensions.
 * Layout is drawn in CSS pixels (`CARD_LAYOUT_WIDTH`); buffers multiply by pixel ratio.
 */

/** Design width in px (2.5×3.5 aspect). All layout fonts/padding are tuned for this. */
export const CARD_LAYOUT_WIDTH = 420;

/** File export (PNG/JPEG/WebP): 420×4 = 1680 px wide — print-friendly on phone screens. */
export const CARD_EXPORT_PIXEL_RATIO = 4;

/** Still-image export resolution presets (user-selectable in the export modal). */
export type ExportResolution = "web" | "high" | "ultra";

export const EXPORT_RESOLUTIONS: Record<
  ExportResolution,
  { label: string; ratio: number; width: number; height: number }
> = {
  web: {
    label: "Web",
    ratio: 2,
    width: CARD_LAYOUT_WIDTH * 2,
    height: Math.round(CARD_LAYOUT_WIDTH * 2 * (3.5 / 2.5)),
  },
  high: {
    label: "High",
    ratio: CARD_EXPORT_PIXEL_RATIO,
    width: CARD_LAYOUT_WIDTH * CARD_EXPORT_PIXEL_RATIO,
    height: Math.round(
      CARD_LAYOUT_WIDTH * CARD_EXPORT_PIXEL_RATIO * (3.5 / 2.5),
    ),
  },
  ultra: {
    label: "Ultra",
    ratio: 6,
    width: CARD_LAYOUT_WIDTH * 6,
    height: Math.round(CARD_LAYOUT_WIDTH * 6 * (3.5 / 2.5)),
  },
};

export const DEFAULT_EXPORT_RESOLUTION: ExportResolution = "high";

/** Animated GIF export: balance size vs clarity. */
export const CARD_GIF_EXPORT_PIXEL_RATIO = 2;

/** Composited video export (MP4 on Safari/iOS, WebM on many desktops). */
export const CARD_VIDEO_EXPORT_PIXEL_RATIO = 3;

/** Canvas preview in UI: integer scale for crisp text, capped for perf. */
export function previewPixelRatio(): number {
  if (typeof window === "undefined") return 2;
  const d = window.devicePixelRatio || 1;
  const rounded = Math.round(d);
  return Math.min(4, Math.max(2, rounded));
}
