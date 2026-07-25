/**
 * The card's bottom rail: one small line of user-supplied credit text
 * ("Requested by: …"), sitting under the flavor line.
 *
 * Letter tracking is applied by advancing per character rather than via
 * `ctx.letterSpacing`, which is too new to rely on across the Safari versions
 * this PWA targets — and doing it manually keeps canvas and DOM in step.
 */

/** Extra px between characters at the 420 px design width. */
export const CREDIT_RAIL_TRACKING = 0.6;

/** Quick-fill offered in the studio; the user completes the name. */
export const CREDIT_RAIL_PRESET = "Requested by: ";

export type CreditRailMetrics = {
  /** Vertical space the rail occupies, including its divider and padding. */
  height: number;
  fontSize: number;
  /** Gap between the divider and the baseline block. */
  gap: number;
};

/** Breathing room under the last body line when there is no rail. */
export const CARD_BOTTOM_MARGIN = 10;

export function hasCreditRail(creditText: string | null | undefined): boolean {
  return !!creditText && creditText.trim().length > 0;
}

/** Bottom margin body text must respect, widened to clear the rail when present. */
export function bottomMarginForCredit(
  width: number,
  creditText: string | null | undefined,
): number {
  return hasCreditRail(creditText)
    ? CARD_BOTTOM_MARGIN + creditRailMetrics(width).height
    : CARD_BOTTOM_MARGIN;
}

export function creditRailMetrics(width: number): CreditRailMetrics {
  const w = Number.isFinite(width) && width > 0 ? width : 420;
  return {
    height: Math.round(w * 0.033),
    fontSize: Math.max(7, Math.round(w * 0.0215)),
    gap: Math.max(2, Math.round(w * 0.007)),
  };
}

/** Width of `text` once per-character tracking is applied. */
export function trackedTextWidth(
  ctx: CanvasRenderingContext2D,
  text: string,
  tracking: number,
): number {
  if (!text) return 0;
  const chars = [...text];
  let w = 0;
  for (const ch of chars) w += ctx.measureText(ch).width;
  return w + tracking * Math.max(0, chars.length - 1);
}

/** Draw `text` from `x` at baseline `y`, advancing by tracking between glyphs. */
export function drawTrackedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  tracking: number,
): void {
  let cx = x;
  for (const ch of [...text]) {
    ctx.fillText(ch, cx, y);
    cx += ctx.measureText(ch).width + tracking;
  }
}

/** Trim and ellipsize `text` so it fits `maxW` at the current font. */
export function fitCreditText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxW: number,
  tracking: number,
): string {
  const t = text.trim();
  if (!t) return "";
  if (trackedTextWidth(ctx, t, tracking) <= maxW) return t;
  const ell = "…";
  const chars = [...t];
  while (chars.length > 0) {
    chars.pop();
    const candidate = chars.join("") + ell;
    if (trackedTextWidth(ctx, candidate, tracking) <= maxW) return candidate;
  }
  return "";
}
