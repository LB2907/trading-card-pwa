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

/** Art panel geometry in the same coordinate space as `drawTradingCard` (CSS pixels before ctx.scale). */
export function artPanelMetrics(width: number, layout: CardLayoutJson) {
  const h = cardHeightForWidth(width);
  const pad = Number(layout.innerPadding);
  const safePad = Number.isFinite(pad) ? pad : 12;
  const artTop = safePad;
  const flex = Number(layout.artFlex);
  const artFlex = Number.isFinite(flex) && flex > 0 ? flex : 3.35;
  const innerH = h - safePad * 2;
  const artH = innerH * (artFlex / (artFlex + TEXT_BAND_FLEX)) * ART_HEIGHT_FACTOR;
  const artW = width - safePad * 2;
  return { cardH: h, pad: safePad, artTop, artW, artH };
}
