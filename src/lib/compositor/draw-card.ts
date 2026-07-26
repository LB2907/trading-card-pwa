import type { CardInstance } from "@/lib/db/schema";
import type { CardLayoutJson } from "@/lib/card-layout";
import { rarityVisual } from "@/lib/card-visual";
import { rarityGemShort } from "@/lib/rarity";
import { rarityTier } from "@/lib/rarity";
import { foilFinishForTier, paintFoilFinish } from "@/lib/compositor/foil";
import {
  abilityPanelStyle,
  abilityTextColor,
  applyTypeLineFont,
  drawNameplateBar,
  drawTrainerHpBadge,
  nameplateBarRadius,
  formatCostStat,
  formatDefenseStat,
  formatHealthStat,
  formatPowerStat,
  nameplateStyle,
  paintThemedArtBezel,
  paintThemedBackdrop,
  paintThemedOuterBorder,
  showHpInNameRow,
  trainerHpBadgeWidth,
} from "@/lib/compositor/card-theme";
import {
  canvasFontDisplay,
  canvasFontSans,
  ensureCardFontsLoaded,
} from "@/lib/compositor/canvas-font";
import {
  artInnerRadiusForTheme,
  normalizeTcgTheme,
  outerRadiusForTheme,
  type TcgTheme,
} from "@/lib/tcg-theme-base";
import {
  RARITY_GEM_STROKE,
  gemGradientStops,
  rarityGemPlacement,
} from "@/lib/compositor/rarity-gem";
import {
  bottomMarginForCredit,
  creditRailMetrics,
  drawTrackedText,
  fitCreditText,
  hasCreditRail,
  CREDIT_RAIL_TRACKING,
} from "@/lib/compositor/credit-rail";
import {
  abilityTextMaxWidth,
  artPanelMetrics,
  cardHeightForWidth,
  statPillHeight,
} from "@/lib/compositor/layout-metrics";
import { THEME_DESCRIPTORS } from "@/lib/compositor/theme-descriptors";
import {
  buildLuminanceProbe,
  probeLuminanceAt,
  tileCenterInCardSpace,
  watermarkInkForLuminance,
  WATERMARK_ALPHA,
  type LuminanceProbe,
} from "@/lib/compositor/watermark-ink";

/**
 * Art with no measurable size is skipped entirely, so anything missing from
 * this list draws a card with an empty art window rather than failing loudly.
 * `VideoFrame` and `OffscreenCanvas` are here because the WebCodecs export path
 * hands decoded frames straight through; both are guarded with `typeof` because
 * neither is defined in the node test environment.
 */
function intrinsicArtSize(src: CanvasImageSource): { w: number; h: number } {
  if (src instanceof HTMLVideoElement) {
    return { w: src.videoWidth, h: src.videoHeight };
  }
  if (src instanceof HTMLImageElement) {
    return {
      w: src.naturalWidth || src.width,
      h: src.naturalHeight || src.height,
    };
  }
  if (src instanceof ImageBitmap) {
    return { w: src.width, h: src.height };
  }
  if (typeof VideoFrame !== "undefined" && src instanceof VideoFrame) {
    return { w: src.displayWidth, h: src.displayHeight };
  }
  if (typeof OffscreenCanvas !== "undefined" && src instanceof OffscreenCanvas) {
    return { w: src.width, h: src.height };
  }
  if (typeof HTMLCanvasElement !== "undefined" && src instanceof HTMLCanvasElement) {
    return { w: src.width, h: src.height };
  }
  return { w: 0, h: 0 };
}

export type DrawCardOptions = {
  instance: CardInstance;
  layout: CardLayoutJson;
  artImage: CanvasImageSource;
  width: number;
  pixelRatio: number;
  watermarkText?: string;
  /**
   * Precomputed luminance probe for the adaptive watermark. Animated exports
   * pass frame 0's probe for every subsequent frame: re-measuring per frame
   * costs a `getImageData` readback each time, and makes tiles near the
   * light/dark threshold flip tone as the art moves.
   */
  watermarkProbe?: LuminanceProbe;
};

function parseHex(hex: string, fallback: string): string {
  if (!hex?.startsWith("#") || hex.length < 7) return fallback;
  return hex;
}

function pathRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  rad: number,
) {
  const anyCtx = ctx as CanvasRenderingContext2D & {
    roundRect?: (x: number, y: number, w: number, h: number, r: number) => void;
  };
  if (typeof anyCtx.roundRect === "function") {
    anyCtx.roundRect(x, y, w, h, rad);
  } else {
    ctx.rect(x, y, w, h);
  }
}

function drawStatPill(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  label: string,
  borderColor: string,
  fontSize: number,
): number {
  ctx.save();
  ctx.font = `600 ${fontSize}px ui-monospace, SFMono-Regular, Menlo, Monaco, monospace`;
  const tw = ctx.measureText(label).width;
  const padX = 11;
  const pw = Math.ceil(tw + padX * 2);
  const ph = statPillHeight(fontSize);
  const r = ph / 2;
  ctx.beginPath();
  pathRoundRect(ctx, x, y, pw, ph, r);
  const g = ctx.createLinearGradient(x, y, x, y + ph);
  g.addColorStop(0, "rgba(255,255,255,0.14)");
  g.addColorStop(0.35, "rgba(255,255,255,0.05)");
  g.addColorStop(1, "rgba(0,0,0,0.22)");
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = borderColor;
  ctx.globalAlpha = 0.5;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.beginPath();
  pathRoundRect(ctx, x + 0.5, y + 0.5, pw - 1, ph - 1, r - 0.5);
  ctx.strokeStyle = "rgba(255,255,255,0.12)";
  ctx.lineWidth = 0.75;
  ctx.stroke();
  ctx.fillStyle = "#f1f5f9";
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";
  ctx.fillText(label, x + pw / 2, y + ph / 2 + 0.25);
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.restore();
  return pw + 5;
}

/** Word-wrap per paragraph; blank entries mark paragraph breaks (from `\n\n`). */
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxW: number,
): string[] {
  const paragraphs = text.split(/\r?\n/);
  const lines: string[] = [];
  for (let pi = 0; pi < paragraphs.length; pi++) {
    if (pi > 0) lines.push("");
    const para = paragraphs[pi];
    const words = para.trim() ? para.trim().split(/\s+/).filter(Boolean) : [];
    if (!words.length) continue;
    let cur = "";
    for (const w of words) {
      const next = cur ? `${cur} ${w}` : w;
      if (ctx.measureText(next).width <= maxW) cur = next;
      else {
        if (cur) lines.push(cur);
        if (ctx.measureText(w).width > maxW) {
          lines.push(w);
          cur = "";
        } else {
          cur = w;
        }
      }
    }
    if (cur) lines.push(cur);
  }
  return lines;
}

function fitNameLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxW: number,
  maxLines: number,
): string[] {
  const all = wrapText(ctx, text, maxW);
  if (all.length <= maxLines) return all;
  const head = all.slice(0, Math.max(0, maxLines - 1));
  let last = all[maxLines - 1] ?? "";
  const ell = "\u2026";
  while (last.length > 0 && ctx.measureText(`${last}${ell}`).width > maxW) {
    last = last.slice(0, -1);
  }
  head.push(`${last}${ell}`);
  return head;
}

function wrappedLinesHeight(lines: string[], lineH: number): number {
  let h = 0;
  for (const line of lines) {
    h += line === "" ? lineH * 0.55 : lineH;
  }
  return h;
}

/** System stack only — iOS Safari canvas can skip or glitch text drawn with custom/webfont families. */
function watermarkFont(sizePx: number): string {
  return `600 ${sizePx}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`;
}

export type ExportWatermarkStrength = "card" | "sheet";

const WATERMARK_ANGLE_RAD = (-26 * Math.PI) / 180;

/**
 * Tiled diagonal watermark over a rectangle (full canvas or a single card).
 * `sheet` is denser and more opaque — used for multi-template showcase PNGs.
 *
 * Pass `probe` (a luminance sample of what is already painted) to let each tile
 * flip between light and dark ink, so the mark reads over bright art as well as
 * over the near-black frame. Without it the mark falls back to light-on-dark.
 */
export function drawExportWatermarkOnRect(
  ctx: CanvasRenderingContext2D,
  width: number,
  h: number,
  text: string,
  strength: ExportWatermarkStrength = "card",
  probe?: LuminanceProbe,
): void {
  const t = text.trim();
  if (!t) return;
  const sheet = strength === "sheet";
  const size = Math.max(
    sheet ? 20 : 12,
    Math.round(width * (sheet ? 0.034 : 0.055)),
  );
  const fontPx = sheet ? Math.min(size, 56) : size;
  const step = Math.max(
    fontPx * (sheet ? 2.25 : 3.2),
    width * (sheet ? 0.36 : 0.55),
  );
  const alpha = WATERMARK_ALPHA[sheet ? "sheet" : "card"];
  const spanW = width * (sheet ? 1.35 : 1.2);
  const spanH = h * (sheet ? 1.35 : 1.0);
  ctx.save();
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
  ctx.shadowColor = "transparent";
  ctx.translate(width / 2, h / 2);
  ctx.rotate(WATERMARK_ANGLE_RAD);
  ctx.font = watermarkFont(fontPx);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (let y = -spanH; y <= spanH; y += step) {
    for (let x = -spanW; x <= spanW; x += step) {
      let bg = 0;
      if (probe) {
        const at = tileCenterInCardSpace(x, y, width, h, WATERMARK_ANGLE_RAD);
        bg = probeLuminanceAt(probe, at.x / width, at.y / h);
      }
      const { ink, halo } = watermarkInkForLuminance(bg, alpha);
      ctx.fillStyle = halo;
      ctx.fillText(t, x + 0.5, y + 0.5);
      ctx.fillStyle = ink;
      ctx.fillText(t, x, y);
    }
  }
  ctx.restore();
}

/** Downsample what is currently on the canvas into a luminance grid. */
export function captureLuminanceProbe(
  ctx: CanvasRenderingContext2D,
  width: number,
  h: number,
): LuminanceProbe | undefined {
  const source = ctx.canvas;
  if (!source) return undefined;
  const cols = 16;
  const rows = Math.max(1, Math.round((cols * h) / width));
  try {
    const small = document.createElement("canvas");
    small.width = cols;
    small.height = rows;
    const sctx = small.getContext("2d");
    if (!sctx) return undefined;
    sctx.imageSmoothingEnabled = true;
    sctx.imageSmoothingQuality = "high";
    sctx.drawImage(source, 0, 0, cols, rows);
    const { data } = sctx.getImageData(0, 0, cols, rows);
    return buildLuminanceProbe(data, cols, rows);
  } catch {
    // Tainted canvas or a context that cannot read back — fall back to the
    // non-adaptive mark rather than losing the watermark entirely.
    return undefined;
  }
}

type WatermarkLayer = {
  key: string;
  probe: LuminanceProbe | undefined;
  canvas: HTMLCanvasElement;
};

/**
 * Single-slot cache for the rasterised watermark.
 *
 * Rebuilding it per call meant allocating a full-size RGBA canvas (≈8.9 MB at
 * the video export size) and re-running the tile loop on every frame of an
 * animated export. Once the probe is held constant the layer is identical for
 * the whole export, so one slot keyed on what can change is enough — animated
 * loops hit it every frame, one-shot still exports miss it exactly once.
 */
let watermarkLayer: WatermarkLayer | null = null;

/** Drop the cached layer (tests, and anything that swaps canvas backends). */
export function resetWatermarkLayerCache(): void {
  watermarkLayer = null;
}

function watermarkLayerFor(
  text: string,
  width: number,
  h: number,
  pixelRatio: number,
  probe: LuminanceProbe | undefined,
): HTMLCanvasElement | null {
  const bufW = Math.max(1, Math.round(width * pixelRatio));
  const bufH = Math.max(1, Math.round(h * pixelRatio));
  const key = `${text}|${bufW}x${bufH}`;
  // Probe compared by identity: animated exports thread one object through
  // every frame, while a still export computes a fresh one and so misses.
  if (watermarkLayer?.key === key && watermarkLayer.probe === probe) {
    return watermarkLayer.canvas;
  }
  const canvas = document.createElement("canvas");
  canvas.width = bufW;
  canvas.height = bufH;
  const wmCtx = canvas.getContext("2d");
  if (!wmCtx) return null;
  wmCtx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  drawExportWatermarkOnRect(wmCtx, width, h, text, "card", probe);
  watermarkLayer = { key, probe, canvas };
  return canvas;
}

/**
 * The bottom rail: a hairline plus one small tracked line of credit text,
 * pinned to the base of the card. Colour comes from the theme's type-line ink
 * so it belongs to every family without extra per-theme configuration.
 */
function drawCreditRail(
  ctx: CanvasRenderingContext2D,
  width: number,
  h: number,
  pad: number,
  textInsetX: number,
  creditText: string,
  theme: TcgTheme,
): void {
  const rail = creditRailMetrics(width);
  const railTop = h - pad - rail.height;
  const rightEdge = width - pad;

  ctx.save();

  const divY = railTop + 0.5;
  const grd = ctx.createLinearGradient(textInsetX, divY, rightEdge, divY);
  grd.addColorStop(0, "rgba(255,255,255,0)");
  grd.addColorStop(0.18, "rgba(255,255,255,0.1)");
  grd.addColorStop(0.5, "rgba(255,255,255,0.14)");
  grd.addColorStop(0.85, "rgba(255,255,255,0.08)");
  grd.addColorStop(1, "rgba(255,255,255,0)");
  ctx.strokeStyle = grd;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(textInsetX, divY);
  ctx.lineTo(rightEdge, divY);
  ctx.stroke();

  ctx.font = canvasFontSans(600, rail.fontSize);
  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  ctx.globalAlpha = 0.62;
  ctx.fillStyle = THEME_DESCRIPTORS[theme].typeColor;
  const maxW = rightEdge - textInsetX;
  const label = fitCreditText(ctx, creditText, maxW, CREDIT_RAIL_TRACKING);
  drawTrackedText(
    ctx,
    label,
    textInsetX,
    railTop + rail.gap,
    CREDIT_RAIL_TRACKING,
  );

  ctx.restore();
}

/**
 * Draws one card to a 2D context (top-left origin).
 *
 * Returns the luminance probe the watermark was inked against — measured
 * *before* the mark is composited. Animated exports must keep this value and
 * feed it back through `watermarkProbe` on every later frame: re-measuring per
 * frame is both a GPU→CPU readback and a source of tone flicker, and measuring
 * after the composite reads the mark's own ink back into the measurement.
 */
export function drawTradingCard(
  ctx: CanvasRenderingContext2D,
  opt: DrawCardOptions,
): LuminanceProbe | undefined {
  const { instance, layout, artImage, width, pixelRatio, watermarkText } = opt;
  const h = cardHeightForWidth(width);
  ctx.save();
  ctx.scale(pixelRatio, pixelRatio);

  const railReserve = hasCreditRail(instance.creditText)
    ? creditRailMetrics(width).height
    : 0;
  const { pad, artTop, artW, artH } = artPanelMetrics(width, layout, railReserve);
  const mat = parseHex(layout.artMatColor ?? "#08080a", "#08080a");
  const rv = rarityVisual(instance.rarity);
  const theme = normalizeTcgTheme(layout.tcgTheme);
  const outerR = outerRadiusForTheme(theme);
  const innerArtR = artInnerRadiusForTheme(theme);

  /** Card body only — watermark is composited afterward via offscreen + round-rect clip (Safari iOS). */
  ctx.save();
  ctx.beginPath();
  pathRoundRect(ctx, 0, 0, width, h, outerR);
  ctx.clip();

  paintThemedBackdrop(ctx, width, h, layout, rv, theme, artTop, artH, artW);
  paintThemedOuterBorder(ctx, width, h, outerR, layout, rv, theme, instance.rarity);

  ctx.save();
  ctx.beginPath();
  pathRoundRect(ctx, pad, artTop, artW, artH, innerArtR);
  ctx.clip();
  ctx.fillStyle = mat;
  ctx.fillRect(pad, artTop, artW, artH);
  const { w: iw, h: ih } = intrinsicArtSize(artImage);
  if (iw > 0 && ih > 0) {
    // Source art is routinely 2–4k wide and lands in an ~400 px window; the
    // browser default resamples cheaply and aliases fine detail badly.
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    const scale = Math.min(artW / iw, artH / ih);
    const dw = iw * scale;
    const dh = ih * scale;
    const dx = pad + (artW - dw) / 2;
    const dy = artTop + (artH - dh) / 2;
    ctx.drawImage(artImage, dx, dy, dw, dh);
  }
  ctx.restore();

  paintThemedArtBezel(ctx, pad, artTop, artW, artH, layout, theme, innerArtR);

  const nameRaw = instance.name.trim() || "Untitled";
  let y = artTop + artH + pad * 0.48;
  const nameplate = nameplateStyle(theme);
  /** Left edge for title, type line, stats, and rules — matches name `fillText` origin. */
  const textInsetX = pad + (nameplate.showBar ? 12 : 10);
  const gx = width - pad - layout.rarityGemSize;

  ctx.font = canvasFontDisplay(700, layout.nameFontSize);
  ctx.textBaseline = "top";

  let nameRight = gx - 8;
  let hpW = 0;
  let hpBadgeH = 0;
  if (showHpInNameRow(theme)) {
    hpW = trainerHpBadgeWidth(
      ctx,
      instance.statHealth,
      layout.statFontSize,
    );
    hpBadgeH = layout.statFontSize + 14;
    nameRight = gx - hpW - 4 - 8;
  }
  const nameMaxW = Math.max(48, nameRight - textInsetX);
  const nameLines = fitNameLines(ctx, nameRaw, nameMaxW, 3);
  const nameLineLead = layout.nameFontSize + 3;
  const nameTextH =
    nameLines.length > 0
      ? nameLines.length * nameLineLead - 3
      : layout.nameFontSize;
  const plateH = Math.max(layout.nameFontSize + 8, nameTextH + 8);

  if (nameplate.showBar) {
    drawNameplateBar(ctx, pad, y - 1, width - pad * 2, plateH + 4, theme);
  } else {
    ctx.fillStyle = rv.primary;
    ctx.globalAlpha = 0.95;
    ctx.beginPath();
    pathRoundRect(ctx, pad, y + 1, 3, Math.max(plateH - 2, layout.nameFontSize), 1);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  ctx.fillStyle = THEME_DESCRIPTORS[theme].nameColor;
  ctx.shadowColor = "rgba(0,0,0,0.55)";
  ctx.shadowBlur = THEME_DESCRIPTORS[theme].nameShadowBlur;
  ctx.shadowOffsetY = 1.5;
  let ny = y + 3;
  for (const line of nameLines) {
    ctx.fillText(line, textInsetX, ny);
    ny += nameLineLead;
  }
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  const nameMidY = y + 3 + nameTextH / 2;
  // Fit the gem to the nameplate bar rather than to the name text: the bar is
  // positioned independently, so centring on the text left the gem riding high
  // and pushed its stroke outside the bar's rounded edge.
  const gem = rarityGemPlacement({
    cardWidth: width,
    pad,
    gemSize: layout.rarityGemSize,
    strokeWidth: RARITY_GEM_STROKE,
    textCenterY: nameMidY,
    bar: nameplate.showBar
      ? { top: y - 1, height: plateH + 4, radius: nameplateBarRadius(theme) }
      : undefined,
  });
  const gemR = layout.rarityGemSize / 2;
  if (showHpInNameRow(theme)) {
    drawTrainerHpBadge(
      ctx,
      gem.left - hpW - 4,
      gem.centerY - hpBadgeH / 2,
      instance.statHealth,
      layout.statFontSize,
    );
  }
  const gcy = gem.centerY;
  ctx.beginPath();
  ctx.arc(gem.centerX, gcy, gemR, 0, Math.PI * 2);
  const rg = ctx.createRadialGradient(
    gem.centerX,
    gcy - 2,
    1,
    gem.centerX,
    gcy,
    gemR,
  );
  const gemStops = gemGradientStops(rv.primary);
  rg.addColorStop(0, gemStops.inner);
  rg.addColorStop(0.5, gemStops.mid);
  rg.addColorStop(1, gemStops.outer);
  ctx.fillStyle = rg;
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.45)";
  ctx.lineWidth = RARITY_GEM_STROKE;
  ctx.stroke();
  const gemText = rarityGemShort(instance.rarity);
  const gemBase = layout.statFontSize * 0.8;
  const gemFontPx =
    gemText.length >= 3
      ? gemBase * 0.58
      : gemText.length >= 2
        ? gemBase * 0.72
        : gemBase;
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.font = canvasFontSans(800, gemFontPx);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(gemText, gem.centerX, gcy + 0.5);
  ctx.textAlign = "left";
  ctx.textBaseline = "top";

  y += Math.max(plateH + 4, 3 + nameTextH + 10);

  ctx.fillStyle = THEME_DESCRIPTORS[theme].typeColor;
  applyTypeLineFont(ctx, theme, layout.typeFontSize);
  const typeMaxW = Math.max(40, gx - textInsetX - 8);
  const typeLines = wrapText(ctx, instance.typeLine || "", typeMaxW);
  for (const line of typeLines.slice(0, 2)) {
    ctx.fillText(line, textInsetX, y);
    y += layout.typeFontSize + 3;
  }

  const divY = y + 4;
  const divGrd = ctx.createLinearGradient(textInsetX, divY, width - pad, divY);
  divGrd.addColorStop(0, "rgba(255,255,255,0)");
  divGrd.addColorStop(0.15, "rgba(255,255,255,0.12)");
  divGrd.addColorStop(0.5, "rgba(255,255,255,0.18)");
  divGrd.addColorStop(0.85, "rgba(255,255,255,0.1)");
  divGrd.addColorStop(1, "rgba(255,255,255,0)");
  ctx.strokeStyle = divGrd;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(textInsetX, divY);
  ctx.lineTo(width - pad, divY);
  ctx.stroke();
  y += 12;

  const pillY1 = y;
  const pillH = statPillHeight(layout.statFontSize);
  let px = textInsetX;
  px += drawStatPill(
    ctx,
    px,
    pillY1,
    formatCostStat(theme, instance.statCost),
    rv.primary,
    layout.statFontSize,
  );
  px += drawStatPill(
    ctx,
    px,
    pillY1,
    formatPowerStat(theme, instance.statPower),
    rv.primary,
    layout.statFontSize,
  );
  px += drawStatPill(
    ctx,
    px,
    pillY1,
    formatDefenseStat(theme, instance.statDefense),
    rv.primary,
    layout.statFontSize,
  );
  px += drawStatPill(
    ctx,
    px,
    pillY1,
    `S${instance.statSpeed}`,
    rv.primary,
    layout.statFontSize,
  );
  if (!showHpInNameRow(theme)) {
    px += drawStatPill(
      ctx,
      px,
      pillY1,
      formatHealthStat(theme, instance.statHealth),
      rv.primary,
      layout.statFontSize,
    );
  }
  drawStatPill(
    ctx,
    px,
    pillY1,
    `M${instance.statMind}`,
    rv.primary,
    layout.statFontSize,
  );

  y = pillY1 + pillH + 14;

  const bottomMargin = bottomMarginForCredit(width, instance.creditText);
  const roomToBottom = () => h - pad - y - bottomMargin;
  const flavorLineH = layout.flavorFontSize * 1.35;
  // Ability (rules) is functional and wins the space fight; flavor is
  // decorative and gets a modest reservation (≤ 3 lines / 35% of room) so it
  // can never starve the ability into an empty panel.
  const flavorReserve = instance.flavorText
    ? Math.min(3 * flavorLineH, Math.max(0, roomToBottom() * 0.35))
    : 0;

  if (instance.abilityText?.trim()) {
    ctx.font = canvasFontSans(500, layout.bodyFontSize);
    const abilityMaxW = abilityTextMaxWidth(width, pad, textInsetX);
    const ab = wrapText(ctx, instance.abilityText, abilityMaxW);
    const lineH = layout.bodyFontSize * 1.3;
    const panelPad = 9;
    const rawRoom = roomToBottom();
    const abilityBudget = Math.max(0, rawRoom - flavorReserve);
    const maxInner = abilityBudget - panelPad * 2;
    const abLines: string[] = [];
    let innerH = 0;
    if (maxInner >= lineH) {
      for (const line of ab) {
        const step = line === "" ? lineH * 0.55 : lineH;
        if (innerH + step > maxInner) break;
        abLines.push(line);
        innerH += step;
      }
    }
    // Only draw the panel when at least one line fits — never an empty box.
    if (abLines.length > 0) {
      const innerTextH = wrappedLinesHeight(abLines, lineH);
      const panelH = Math.min(
        abilityBudget,
        innerTextH + panelPad * 2,
      );
      const ap = abilityPanelStyle(theme);
      const panelR = 12;
      ctx.beginPath();
      pathRoundRect(ctx, pad, y, width - pad * 2, panelH, panelR);
      const panelGrad = ctx.createLinearGradient(pad, y, pad, y + panelH);
      panelGrad.addColorStop(0, ap.fillTop);
      panelGrad.addColorStop(0.55, ap.fill);
      panelGrad.addColorStop(1, ap.fillBottom);
      ctx.fillStyle = panelGrad;
      ctx.fill();
      ctx.strokeStyle = ap.stroke;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.beginPath();
      pathRoundRect(ctx, pad + 0.5, y + 0.5, width - pad * 2 - 1, panelH - 1, panelR - 0.5);
      ctx.strokeStyle = ap.innerHighlight;
      ctx.lineWidth = 0.75;
      ctx.stroke();
      ctx.save();
      ctx.beginPath();
      pathRoundRect(ctx, pad, y, width - pad * 2, panelH, 10);
      ctx.clip();
      ctx.fillStyle = abilityTextColor(theme);
      ctx.font = canvasFontSans(500, layout.bodyFontSize);
      let ty = y + panelPad;
      for (const line of abLines) {
        if (line === "") {
          ty += lineH * 0.55;
          continue;
        }
        ctx.fillText(line, textInsetX, ty);
        ty += lineH;
      }
      ctx.restore();
      y += panelH + 10;
    } else {
      y += 2;
    }
  } else {
    y += 2;
  }

  if (instance.flavorText) {
    ctx.fillStyle = "rgba(221,227,238,0.52)";
    ctx.font = `italic 500 ${layout.flavorFontSize}px ui-serif, Georgia, serif`;
    const room = Math.max(0, h - pad - y - bottomMargin);
    const allFlavor = wrapText(
      ctx,
      instance.flavorText,
      width - textInsetX - pad,
    );
    const flavorLines: string[] = [];
    let used = 0;
    for (const line of allFlavor) {
      const step = line === "" ? flavorLineH * 0.55 : flavorLineH;
      if (used + step > room) break;
      flavorLines.push(line);
      used += step;
    }
    for (const line of flavorLines) {
      if (line === "") {
        y += flavorLineH * 0.55;
        continue;
      }
      ctx.fillText(line, textInsetX, y);
      y += flavorLineH;
    }
  }

  if (hasCreditRail(instance.creditText)) {
    drawCreditRail(ctx, width, h, pad, textInsetX, instance.creditText, theme);
  }

  // Rarity foil / finish over the whole face, still inside the outer clip so
  // it follows the rounded corners; the watermark composites on top of it.
  // Opt-in per card: rarity sets which finish you get, not whether you get one.
  if (instance.foil) {
    paintFoilFinish(
      ctx,
      width,
      h,
      outerR,
      foilFinishForTier(rarityTier(instance.rarity)),
      rv,
    );
  }

  ctx.restore();

  const wm = (watermarkText ?? "").trim();
  let usedProbe = opt.watermarkProbe;
  if (wm) {
    const pr =
      Number.isFinite(pixelRatio) && pixelRatio > 0 ? pixelRatio : 1;
    // Sample the finished card face — but before the mark goes on, so each
    // tile picks its tone from the art rather than from earlier watermark ink.
    usedProbe = opt.watermarkProbe ?? captureLuminanceProbe(ctx, width, h);
    const layer = watermarkLayerFor(wm, width, h, pr, usedProbe);
    if (layer) {
      ctx.save();
      ctx.beginPath();
      pathRoundRect(ctx, 0, 0, width, h, outerR);
      ctx.clip();
      ctx.drawImage(layer, 0, 0, layer.width, layer.height, 0, 0, width, h);
      ctx.restore();
    }
  }

  ctx.restore();
  return usedProbe;
}

export function cardCanvasSize(width: number, pixelRatio: number) {
  const w = Number.isFinite(width) && width > 0 ? width : 420;
  const pr =
    Number.isFinite(pixelRatio) && pixelRatio > 0 ? pixelRatio : 1;
  const h = cardHeightForWidth(w);
  return {
    cssW: w,
    cssH: h,
    bufW: Math.round(w * pr),
    bufH: Math.round(h * pr),
  };
}

/** Raster export (PNG / JPEG / WebP). */
export async function exportCardAsBlob(
  opt: DrawCardOptions,
  mime: "image/png" | "image/jpeg" | "image/webp",
  quality = 0.92,
): Promise<Blob> {
  await ensureCardFontsLoaded();
  const pr =
    Number.isFinite(opt.pixelRatio) && opt.pixelRatio > 0 ? opt.pixelRatio : 1;
  const { bufW, bufH, cssW } = cardCanvasSize(opt.width, pr);
  if (!Number.isFinite(bufW) || bufW < 1 || !Number.isFinite(bufH) || bufH < 1) {
    throw new Error("Invalid card export dimensions (check template layout numbers).");
  }
  const canvas = document.createElement("canvas");
  canvas.width = bufW;
  canvas.height = bufH;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unsupported");
  drawTradingCard(ctx, { ...opt, width: cssW, pixelRatio: pr });
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (b) {
          resolve(b);
          return;
        }
        void (async () => {
          try {
            const dataUrl =
              mime === "image/png"
                ? canvas.toDataURL(mime)
                : canvas.toDataURL(mime, quality);
            const out = await fetch(dataUrl).then((r) => r.blob());
            if (!out.size) {
              reject(new Error("Export image encoding failed"));
              return;
            }
            resolve(out);
          } catch {
            reject(new Error("Export image encoding failed"));
          }
        })();
      },
      mime,
      mime === "image/png" ? undefined : quality,
    );
  });
}

export function exportCardPng(opt: DrawCardOptions): Promise<Blob> {
  return exportCardAsBlob(opt, "image/png");
}
