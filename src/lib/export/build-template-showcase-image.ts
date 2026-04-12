"use client";

import { parseLayout } from "@/lib/card-layout";
import {
  cardCanvasSize,
  drawExportWatermarkOnRect,
  drawTradingCard,
  type DrawCardOptions,
} from "@/lib/compositor/draw-card";
import { cardHeightForWidth } from "@/lib/compositor/layout-metrics";
import { CARD_LAYOUT_WIDTH } from "@/lib/compositor/card-resolution";
import type { CardInstance } from "@/lib/db/schema";
import { getExportWatermarkText } from "@/lib/export-preferences";
import {
  BUILTIN_TEMPLATE_IDS_ORDERED,
  layoutJsonForBuiltinTemplateId,
} from "@/lib/templates/registry";

/** Balance clarity vs file size for a single shareable sheet. */
const SHOWCASE_PIXEL_RATIO = 2;
const GRID_GAP_CSS = 20;
const PAGE_PAD_CSS = 24;
const CAPTION_BELOW_CSS = 26;
const TITLE_STRIP_CSS = 44;

function neutralArtPlaceholder(): HTMLCanvasElement {
  const w = 720;
  const h = 1000;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d");
  if (!g) return c;
  const grd = g.createLinearGradient(0, 0, w, h);
  grd.addColorStop(0, "#2c2c34");
  grd.addColorStop(0.45, "#18181f");
  grd.addColorStop(1, "#101016");
  g.fillStyle = grd;
  g.fillRect(0, 0, w, h);
  g.strokeStyle = "rgba(255,255,255,0.07)";
  g.lineWidth = 1.5;
  for (let i = 0; i < 6; i++) {
    g.beginPath();
    g.arc(w * 0.5, h * 0.4, 36 + i * 34, 0, Math.PI * 2);
    g.stroke();
  }
  g.fillStyle = "rgba(255,255,255,0.2)";
  g.font = "500 26px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText("Art", w / 2, h * 0.4);
  g.textAlign = "left";
  g.textBaseline = "top";
  return c;
}

function showcasePlaceholderInstance(): CardInstance {
  const t = new Date();
  return {
    id: "template-showcase",
    setId: "template-showcase",
    templateId: "tpl_default",
    mediaPath: "showcase/placeholder",
    mediaKind: "image",
    name: "Name",
    typeLine: "Type · Subtype",
    rarity: "rare",
    statCost: 2,
    statPower: 3,
    statDefense: 3,
    statSpeed: 2,
    statHealth: 4,
    statMind: 2,
    abilityText:
      "Rules text appears in this panel so you can see how each frame treats the text area.",
    flavorText:
      "Flavor text — italic and softer — sits below the rules when space allows.",
    createdAt: t,
    updatedAt: t,
  };
}

function renderOneCardCanvas(opt: DrawCardOptions): HTMLCanvasElement {
  const pr = SHOWCASE_PIXEL_RATIO;
  const { bufW, bufH, cssW } = cardCanvasSize(opt.width, pr);
  const canvas = document.createElement("canvas");
  canvas.width = bufW;
  canvas.height = bufH;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unsupported");
  drawTradingCard(ctx, { ...opt, width: cssW, pixelRatio: pr });
  return canvas;
}

function sheetToPngBlob(sheet: HTMLCanvasElement): Promise<Blob> {
  const mime = "image/png" as const;
  return new Promise((resolve, reject) => {
    sheet.toBlob(
      (b) => {
        if (b) {
          resolve(b);
          return;
        }
        void (async () => {
          try {
            const dataUrl = sheet.toDataURL(mime);
            const out = await fetch(dataUrl).then((r) => r.blob());
            if (!out.size) reject(new Error("Showcase PNG encoding failed"));
            else resolve(out);
          } catch {
            reject(new Error("Showcase PNG encoding failed"));
          }
        })();
      },
      mime,
    );
  });
}

/**
 * One PNG grid of every built-in Studio template with shared placeholder copy
 * (name, type line, rules, flavor) and neutral art — for sharing layout options.
 */
export async function buildTemplateShowcasePngBlob(): Promise<Blob> {
  const art = neutralArtPlaceholder();
  const instance = showcasePlaceholderInstance();
  const cardW = CARD_LAYOUT_WIDTH;
  const cardH = cardHeightForWidth(cardW);

  const cols = 3;
  const ids = [...BUILTIN_TEMPLATE_IDS_ORDERED];
  const rows = Math.ceil(ids.length / cols);

  const title = "Built-in card templates (placeholders)";
  const logicalW =
    PAGE_PAD_CSS * 2 +
    cols * cardW +
    (cols - 1) * GRID_GAP_CSS;
  const rowStride = cardH + CAPTION_BELOW_CSS + GRID_GAP_CSS;
  const logicalH =
    PAGE_PAD_CSS * 2 + TITLE_STRIP_CSS + rows * rowStride - GRID_GAP_CSS;

  const pr = SHOWCASE_PIXEL_RATIO;
  const sheet = document.createElement("canvas");
  sheet.width = Math.round(logicalW * pr);
  sheet.height = Math.round(logicalH * pr);
  const sctx = sheet.getContext("2d");
  if (!sctx) throw new Error("Canvas unsupported");

  sctx.scale(pr, pr);
  sctx.fillStyle = "#09090b";
  sctx.fillRect(0, 0, logicalW, logicalH);

  sctx.fillStyle = "rgba(248,250,252,0.92)";
  sctx.font =
    "600 15px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  sctx.textAlign = "left";
  sctx.textBaseline = "top";
  sctx.fillText(title, PAGE_PAD_CSS, PAGE_PAD_CSS + 6);

  sctx.fillStyle = "rgba(226,232,240,0.55)";
  sctx.font =
    "400 12px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  sctx.fillText(
    "Name · Type · Subtype · rules · flavor use placeholder text on every preview.",
    PAGE_PAD_CSS,
    PAGE_PAD_CSS + 26,
  );

  const gridTop = PAGE_PAD_CSS + TITLE_STRIP_CSS;

  for (let i = 0; i < ids.length; i++) {
    const id = ids[i]!;
    const json = layoutJsonForBuiltinTemplateId(id);
    if (!json) continue;
    const layout = parseLayout(json);
    const col = i % cols;
    const row = Math.floor(i / cols);
    const cellX = PAGE_PAD_CSS + col * (cardW + GRID_GAP_CSS);
    const cellY = gridTop + row * rowStride;

    const cardCanvas = renderOneCardCanvas({
      instance: { ...instance, templateId: id },
      layout,
      artImage: art,
      width: cardW,
      pixelRatio: SHOWCASE_PIXEL_RATIO,
      watermarkText: "",
    });

    sctx.imageSmoothingEnabled = true;
    sctx.imageSmoothingQuality = "high";
    sctx.drawImage(cardCanvas, cellX, cellY, cardW, cardH);

    sctx.fillStyle = "rgba(226,232,240,0.78)";
    sctx.font =
      "600 12px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    sctx.textAlign = "center";
    sctx.textBaseline = "top";
    sctx.fillText(layout.name, cellX + cardW / 2, cellY + cardH + 6);
    sctx.textAlign = "left";
  }

  sctx.setTransform(1, 0, 0, 1, 0, 0);
  const wm = getExportWatermarkText().trim();
  if (wm) {
    drawExportWatermarkOnRect(sctx, sheet.width, sheet.height, wm, "sheet");
  }
  return sheetToPngBlob(sheet);
}
