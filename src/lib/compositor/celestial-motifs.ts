/**
 * Night-sky motifs: crescent moon, multi-point stars, constellation lines (Celestial theme).
 */

export function drawStar(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  outerR: number,
  innerR: number,
  points: number,
  rotation: number,
  fill: string,
  stroke?: string,
): void {
  const step = Math.PI / points;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rotation);
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const a = i * step - Math.PI / 2;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 0.35;
    ctx.stroke();
  }
  ctx.restore();
}

export function drawSpark(ctx: CanvasRenderingContext2D, x: number, y: number, s: number): void {
  ctx.save();
  ctx.strokeStyle = "rgba(230,240,255,0.55)";
  ctx.lineWidth = Math.max(0.4, 0.5 * s);
  ctx.beginPath();
  ctx.moveTo(x - 3 * s, y);
  ctx.lineTo(x + 3 * s, y);
  ctx.moveTo(x, y - 3 * s);
  ctx.lineTo(x, y + 3 * s);
  ctx.stroke();
  ctx.restore();
}

/** Waxing crescent from two circles (classic iconography). */
export function drawCrescentMoon(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
): void {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, -Math.PI * 0.35, Math.PI * 0.35, false);
  ctx.arc(cx + r * 0.48, cy, r * 0.92, Math.PI * 0.42, -Math.PI * 0.42, true);
  ctx.closePath();
  const g = ctx.createRadialGradient(cx - r * 0.2, cy - r * 0.3, 0, cx, cy, r * 1.1);
  g.addColorStop(0, "rgba(255,252,235,0.95)");
  g.addColorStop(0.45, "rgba(220,225,245,0.75)");
  g.addColorStop(1, "rgba(160,175,210,0.35)");
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = "rgba(200,215,255,0.35)";
  ctx.lineWidth = 0.6;
  ctx.stroke();
  ctx.restore();
}

export function connectConstellation(
  ctx: CanvasRenderingContext2D,
  pts: [number, number][],
  color: string,
): void {
  if (pts.length < 2) return;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 0.85;
  ctx.setLineDash([2, 3]);
  ctx.globalAlpha = 0.55;
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) {
    ctx.lineTo(pts[i][0], pts[i][1]);
  }
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;
  for (const [x, y] of pts) {
    ctx.beginPath();
    ctx.arc(x, y, 1.6, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(230,238,255,0.85)";
    ctx.fill();
  }
  ctx.restore();
}

export function paintCelestialBackdropMotifs(
  ctx: CanvasRenderingContext2D,
  width: number,
  h: number,
  artTop: number,
  artH: number,
): void {
  const artBottom = artTop + artH;
  const s = Math.max(0.7, Math.min(1.2, width / 220));
  ctx.save();

  for (let i = 0; i < 42; i++) {
    const x = (Math.sin(i * 12.7) * 0.5 + 0.5) * width;
    const y = (Math.cos(i * 9.3) * 0.5 + 0.5) * artBottom * 0.92;
    const sz = (i % 5) * 0.4 + 0.6;
    ctx.globalAlpha = 0.15 + (i % 4) * 0.12;
    drawSpark(ctx, x, y, sz * s);
  }
  ctx.globalAlpha = 1;

  drawCrescentMoon(ctx, width * 0.88, h * 0.1, 14 * s);

  drawStar(ctx, width * 0.12, h * 0.14, 5.5 * s, 2.2 * s, 4, 0.2, "rgba(255,248,220,0.55)", "rgba(255,255,255,0.2)");
  drawStar(ctx, width * 0.22, h * 0.08, 3 * s, 1.1 * s, 5, 0.9, "rgba(220,235,255,0.45)");
  drawStar(ctx, width * 0.72, h * 0.2, 4 * s, 1.5 * s, 5, -0.3, "rgba(255,255,255,0.4)");

  const midY = artBottom + (h - artBottom) * 0.35;
  connectConstellation(
    ctx,
    [
      [width * 0.18, midY],
      [width * 0.28, midY - 12 * s],
      [width * 0.38, midY - 4 * s],
      [width * 0.48, midY + 8 * s],
    ],
    "rgba(180,200,255,0.5)",
  );
  connectConstellation(
    ctx,
    [
      [width * 0.58, midY + 6 * s],
      [width * 0.68, midY - 10 * s],
      [width * 0.78, midY],
    ],
    "rgba(160,190,255,0.45)",
  );

  drawStar(ctx, width * 0.08, h * 0.9, 6 * s, 2.5 * s, 4, 0.5, "rgba(255,250,230,0.35)", "rgba(255,255,255,0.15)");
  drawStar(ctx, width * 0.92, h * 0.88, 5 * s, 2 * s, 5, -0.2, "rgba(230,240,255,0.32)");

  ctx.restore();
}
