/**
 * Celestial clock: night sky (stars, moon, constellation) + astrolabe ring + refined gears.
 */

import {
  connectConstellation,
  drawCrescentMoon,
  drawSpark,
  drawStar,
} from "@/lib/compositor/celestial-motifs";

function drawGearStroke(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  teeth: number,
  rIn: number,
  rOut: number,
  rotation: number,
  stroke: string,
  lineWidth: number,
): void {
  const d = (Math.PI * 2) / teeth;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rotation);
  ctx.beginPath();
  for (let i = 0; i < teeth; i++) {
    const a0 = i * d - Math.PI / 2;
    const a1 = (i + 0.5) * d - Math.PI / 2;
    const x0 = Math.cos(a0) * rOut;
    const y0 = Math.sin(a0) * rOut;
    const x1 = Math.cos(a1) * rIn;
    const y1 = Math.sin(a1) * rIn;
    if (i === 0) ctx.moveTo(x0, y0);
    else ctx.lineTo(x0, y0);
    ctx.lineTo(x1, y1);
  }
  ctx.closePath();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = lineWidth;
  ctx.stroke();
  ctx.restore();
}

function drawZodiacTicks(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  startAngle: number,
  sweep: number,
  ticks: number,
  color: string,
): void {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 0.7;
  for (let i = 0; i <= ticks; i++) {
    const t = startAngle + (sweep * i) / ticks;
    const x0 = cx + Math.cos(t) * (radius - 3);
    const y0 = cy + Math.sin(t) * (radius - 3);
    const x1 = cx + Math.cos(t) * radius;
    const y1 = cy + Math.sin(t) * radius;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  }
  ctx.restore();
}

function paintStarField(
  ctx: CanvasRenderingContext2D,
  width: number,
  h: number,
  artBottom: number,
  s: number,
): void {
  ctx.save();
  for (let i = 0; i < 56; i++) {
    const x = ((i * 37.3) % 1000) / 1000 * width * 0.92 + width * 0.04;
    const y = ((i * 53.7) % 1000) / 1000 * Math.min(artBottom * 0.95, h * 0.72);
    const sz = 0.45 + (i % 5) * 0.15;
    ctx.globalAlpha = 0.08 + (i % 4) * 0.07;
    drawSpark(ctx, x, y, sz * s);
  }
  ctx.globalAlpha = 1;
  for (let i = 0; i < 8; i++) {
    const x = width * (0.12 + (i % 4) * 0.22);
    const y = h * (0.06 + (i * 0.07) % 0.12);
    drawStar(ctx, x, y, 2.2 * s, 0.9 * s, 4, i * 0.4, "rgba(220,235,255,0.35)");
  }
  ctx.restore();
}

export function paintCelestialClockBackdropMotifs(
  ctx: CanvasRenderingContext2D,
  width: number,
  h: number,
  artTop: number,
  artH: number,
): void {
  const artBottom = artTop + artH;
  const s = Math.max(0.7, Math.min(1.15, width / 220));
  ctx.save();

  paintStarField(ctx, width, h, artBottom, s);

  drawCrescentMoon(ctx, width * 0.84, h * 0.11, 12 * s);

  const bandH = h - artBottom;
  const textUpperY = artBottom + bandH * 0.08;
  connectConstellation(
    ctx,
    [
      [width * 0.2, textUpperY + 8 * s],
      [width * 0.32, textUpperY],
      [width * 0.44, textUpperY + 10 * s],
    ],
    "rgba(180,200,255,0.4)",
  );

  const brass = "rgba(200,175,115,0.38)";
  const dim = "rgba(160,140,95,0.2)";
  drawGearStroke(ctx, width * 0.11, h * 0.9, 18, 12 * s, 17 * s, 0.12, brass, 1 * s);
  drawGearStroke(ctx, width * 0.11, h * 0.9, 18, 7 * s, 9 * s, 0.12, dim, 0.5 * s);

  drawGearStroke(ctx, width * 0.89, h * 0.88, 14, 8 * s, 13 * s, -0.4, brass, 0.85 * s);

  const arcCx = width * 0.5;
  const arcCy = artBottom + bandH * 0.78;
  const arcR = width * 0.32;
  ctx.save();
  ctx.strokeStyle = "rgba(180,165,120,0.28)";
  ctx.lineWidth = 1 * s;
  ctx.beginPath();
  ctx.arc(arcCx, arcCy, arcR, Math.PI * 1.08, Math.PI * 1.92, false);
  ctx.stroke();
  ctx.restore();
  drawZodiacTicks(ctx, arcCx, arcCy, arcR, Math.PI * 1.08, Math.PI * 0.84, 12, "rgba(210,195,150,0.4)");

  ctx.restore();
}
