import type { CardLayoutJson } from "@/lib/card-layout";

const ASPECT = 2.5 / 3.5;

export function cardHeightForWidth(width: number): number {
  return width / ASPECT;
}

/**
 * Relative flex reserved for name / type / stats / rules (smaller ⇒ taller art window).
 * Exported for DOM preview flex ratio (`artFlex` : this). Keep in sync with canvas math below.
 */
export const CARD_TEXT_BAND_FLEX_WEIGHT = 1.2;

const TEXT_BAND_FLEX = CARD_TEXT_BAND_FLEX_WEIGHT;

/** Vertical fraction of the flex-split region used for art (rest is breathing room). */
const ART_HEIGHT_FACTOR = 0.91;

/**
 * Art panel geometry in the same coordinate space as `drawTradingCard` (CSS pixels before ctx.scale).
 *
 * `reserveBottom` is height claimed by something pinned to the base of the card
 * (currently the credit rail). It comes out of the art window rather than the
 * text band, so adding a rail never squeezes the rules or flavor text off the
 * card. The DOM preview gets the same behaviour for free from flex sizing.
 */
export function artPanelMetrics(
  width: number,
  layout: CardLayoutJson,
  reserveBottom = 0,
) {
  const h = cardHeightForWidth(width);
  const pad = Number(layout.innerPadding);
  const safePad = Number.isFinite(pad) ? pad : 12;
  const artTop = safePad;
  const flex = Number(layout.artFlex);
  const artFlex = Number.isFinite(flex) && flex > 0 ? flex : 3.35;
  const innerH = h - safePad * 2;
  const reserve = Number.isFinite(reserveBottom) ? Math.max(0, reserveBottom) : 0;
  const fullArtH =
    innerH * (artFlex / (artFlex + TEXT_BAND_FLEX)) * ART_HEIGHT_FACTOR;
  // Never let the reserve collapse the art window entirely.
  const artH = Math.max(fullArtH * 0.5, fullArtH - reserve);
  const artW = width - safePad * 2;
  return { cardH: h, pad: safePad, artTop, artW, artH };
}

/**
 * Usable text width inside the ability panel.
 *
 * The panel spans `pad … cardWidth - pad`, but the rules text starts at
 * `textInsetX`, which is already inset from the panel's left edge. Wrapping to
 * `cardWidth - textInsetX - pad` therefore let text run flush to the panel's
 * right border with no padding at all. Mirroring the left inset on the right
 * keeps the block centred inside the panel.
 */
export function abilityTextMaxWidth(
  cardWidth: number,
  pad: number,
  textInsetX: number,
): number {
  const panelRight = cardWidth - pad;
  const leftInset = Math.max(0, textInsetX - pad);
  return Math.max(0, panelRight - leftInset - textInsetX);
}
