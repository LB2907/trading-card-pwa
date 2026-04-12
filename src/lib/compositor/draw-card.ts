import type { CardInstance } from "@/lib/db/schema";
import type { CardLayoutJson } from "@/lib/card-layout";
import { rarityVisual } from "@/lib/card-visual";
import { rarityGemShort } from "@/lib/rarity";
import {
  abilityPanelStyle,
  abilityTextColor,
  applyTypeLineFont,
  drawNameplateBar,
  drawTrainerHpBadge,
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
import { canvasFontSans } from "@/lib/compositor/canvas-font";
import {
  artInnerRadiusForTheme,
  normalizeTcgTheme,
  outerRadiusForTheme,
} from "@/lib/tcg-theme-base";
import { artPanelMetrics, cardHeightForWidth } from "@/lib/compositor/layout-metrics";

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
  return { w: 0, h: 0 };
}

export type DrawCardOptions = {
  instance: CardInstance;
  layout: CardLayoutJson;
  artImage: CanvasImageSource;
  width: number;
  pixelRatio: number;
  watermarkText?: string;
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
  const ph = fontSize + 11;
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

/**
 * Tiled diagonal watermark over a rectangle (full canvas or a single card).
 * `sheet` is denser and more opaque — used for multi-template showcase PNGs.
 */
export function drawExportWatermarkOnRect(
  ctx: CanvasRenderingContext2D,
  width: number,
  h: number,
  text: string,
  strength: ExportWatermarkStrength = "card",
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
  const shadowA = sheet ? 0.11 : 0.045;
  const fillA = sheet ? 0.14 : 0.055;
  const spanW = width * (sheet ? 1.35 : 1.2);
  const spanH = h * (sheet ? 1.35 : 1.0);
  ctx.save();
  ctx.translate(width / 2, h / 2);
  ctx.rotate((-26 * Math.PI) / 180);
  ctx.font = watermarkFont(fontPx);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (let y = -spanH; y <= spanH; y += step) {
    for (let x = -spanW; x <= spanW; x += step) {
      ctx.fillStyle = `rgba(0,0,0,${shadowA})`;
      ctx.fillText(t, x + 0.5, y + 0.5);
      ctx.fillStyle = `rgba(255,255,255,${fillA})`;
      ctx.fillText(t, x, y);
    }
  }
  ctx.restore();
}

/** Draws one card to a 2D context (top-left origin). */
export function drawTradingCard(
  ctx: CanvasRenderingContext2D,
  opt: DrawCardOptions,
): void {
  const { instance, layout, artImage, width, pixelRatio, watermarkText } = opt;
  const h = cardHeightForWidth(width);
  ctx.save();
  ctx.scale(pixelRatio, pixelRatio);

  const { pad, artTop, artW, artH } = artPanelMetrics(width, layout);
  const mat = parseHex(layout.artMatColor ?? "#08080a", "#08080a");
  const rv = rarityVisual(instance.rarity);
  const theme = normalizeTcgTheme(layout.tcgTheme);
  const outerR = outerRadiusForTheme(theme);
  const innerArtR = artInnerRadiusForTheme(theme);

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

  ctx.font = canvasFontSans(800, layout.nameFontSize);
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

  ctx.fillStyle =
    theme === "trainer"
      ? "#f8fafc"
      : theme === "duelist"
        ? "#ede9fe"
        : theme === "floral"
          ? "#fce7f0"
          : theme === "celestial"
            ? "#e8f0ff"
            : theme === "autumn"
              ? "#ffe8d4"
              : theme === "tide"
                ? "#dff8fc"
                : theme === "celestial_clock"
                  ? "#f5ecd8"
                  : theme === "neon_city"
                    ? "#ecf8f8"
                    : theme === "monoline_ink"
                      ? "#f2ebe3"
                      : "#f8fafc";
  ctx.shadowColor = "rgba(0,0,0,0.55)";
  ctx.shadowBlur =
    theme === "duelist"
      ? 5
      : theme === "floral" || theme === "autumn"
        ? 6
        : theme === "celestial" || theme === "tide"
          ? 7
          : theme === "neon_city"
            ? 6
            : theme === "celestial_clock" || theme === "monoline_ink"
              ? 6
              : 8;
  ctx.shadowOffsetY = 1.5;
  let ny = y + 3;
  for (const line of nameLines) {
    ctx.fillText(line, textInsetX, ny);
    ny += nameLineLead;
  }
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  const nameMidY = y + 3 + nameTextH / 2;
  if (showHpInNameRow(theme)) {
    drawTrainerHpBadge(
      ctx,
      gx - hpW - 4,
      nameMidY - hpBadgeH / 2,
      instance.statHealth,
      layout.statFontSize,
    );
  }
  const gcy = nameMidY;
  ctx.beginPath();
  ctx.arc(
    gx + layout.rarityGemSize / 2,
    gcy,
    layout.rarityGemSize / 2,
    0,
    Math.PI * 2,
  );
  const rg = ctx.createRadialGradient(
    gx + layout.rarityGemSize / 2,
    gcy - 2,
    1,
    gx + layout.rarityGemSize / 2,
    gcy,
    layout.rarityGemSize / 2,
  );
  rg.addColorStop(0, "#fff8");
  rg.addColorStop(0.35, rv.primary);
  rg.addColorStop(1, "#0a0a12");
  ctx.fillStyle = rg;
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.45)";
  ctx.lineWidth = 1.25;
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
  ctx.fillText(gemText, gx + layout.rarityGemSize / 2, gcy + 0.5);
  ctx.textAlign = "left";
  ctx.textBaseline = "top";

  y += Math.max(plateH + 4, 3 + nameTextH + 10);

  ctx.fillStyle =
    theme === "trainer"
      ? "rgba(241,245,249,0.88)"
      : theme === "duelist"
        ? "rgba(221,214,255,0.78)"
        : theme === "floral"
          ? "rgba(252,231,243,0.86)"
          : theme === "celestial"
            ? "rgba(216,228,255,0.84)"
            : theme === "autumn"
              ? "rgba(255,224,190,0.86)"
              : theme === "tide"
                ? "rgba(200,240,248,0.82)"
                : theme === "celestial_clock"
                  ? "rgba(235,220,195,0.84)"
                  : theme === "neon_city"
                    ? "rgba(210,240,238,0.82)"
                    : theme === "monoline_ink"
                      ? "rgba(228,218,208,0.82)"
                      : "rgba(248,250,252,0.72)";
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
  const pillH = layout.statFontSize + 10;
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

  const bottomMargin = 10;
  const roomToBottom = () => h - pad - y - bottomMargin;
  const flavorLineH = layout.flavorFontSize * 1.35;
  const flavorHeadroom = instance.flavorText
    ? Math.min(8 * flavorLineH, Math.max(0, roomToBottom() * 0.55))
    : 0;

  if (instance.abilityText?.trim()) {
    ctx.font = canvasFontSans(500, layout.bodyFontSize);
    const ab = wrapText(
      ctx,
      instance.abilityText,
      width - textInsetX - pad,
    );
    const lineH = layout.bodyFontSize * 1.3;
    const panelPad = 9;
    const rawRoom = roomToBottom();
    const abilityBudget = Math.min(
      rawRoom,
      Math.max(36, rawRoom - flavorHeadroom),
    );
    const maxInner = Math.max(10, abilityBudget - panelPad * 2);
    const abLines: string[] = [];
    let innerH = 0;
    for (const line of ab) {
      const step = line === "" ? lineH * 0.55 : lineH;
      if (innerH + step > maxInner) break;
      abLines.push(line);
      innerH += step;
    }
    const innerTextH = wrappedLinesHeight(abLines, lineH);
    const panelH = Math.min(
      abilityBudget,
      Math.max(36, innerTextH + panelPad * 2),
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

  drawExportWatermarkOnRect(ctx, width, h, watermarkText ?? "", "card");

  ctx.restore();
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
export function exportCardAsBlob(
  opt: DrawCardOptions,
  mime: "image/png" | "image/jpeg" | "image/webp",
  quality = 0.92,
): Promise<Blob> {
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
