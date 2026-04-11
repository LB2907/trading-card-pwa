/**
 * Single source of truth for card raster dimensions.
 * Layout is drawn in CSS pixels (`CARD_LAYOUT_WIDTH`); buffers multiply by pixel ratio.
 */

/** Design width in px (2.5×3.5 aspect). All layout fonts/padding are tuned for this. */
export const CARD_LAYOUT_WIDTH = 420;

/** File export (PNG/JPEG/WebP): 420×4 = 1680 px wide — print-friendly on phone screens. */
export const CARD_EXPORT_PIXEL_RATIO = 4;

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
