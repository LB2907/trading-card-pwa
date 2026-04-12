/**
 * Monoline ink: stroke-only corner flourishes (no mid-card rules — keeps stats area clean).
 */

function hexToRgba(hex: string, a: number): string {
  if (!hex.startsWith("#") || hex.length < 7) return `rgba(44,24,16,${a})`;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
}

function drawCornerFlourish(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  scale: number,
  rotation: number,
  stroke: string,
): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rotation);
  ctx.scale(scale, scale);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(8, -2, 14, -12, 10, -22);
  ctx.bezierCurveTo(6, -30, -4, -28, -8, -18);
  ctx.bezierCurveTo(-12, -8, -6, -2, 0, 0);
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 1.15;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(4, -6);
  ctx.quadraticCurveTo(18, -10, 22, -24);
  ctx.strokeStyle = stroke;
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = 0.65;
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.restore();
}

export function paintMonolineInkBackdropMotifs(
  ctx: CanvasRenderingContext2D,
  width: number,
  h: number,
  _artTop: number,
  _artH: number,
  accentHex: string,
): void {
  const stroke = hexToRgba(accentHex, 0.58);
  const s = Math.max(0.65, Math.min(1.2, width / 220));
  ctx.save();

  drawCornerFlourish(ctx, 8 * s, 8 * s, 0.85 * s, 0, stroke);
  drawCornerFlourish(ctx, width - 8 * s, 8 * s, 0.85 * s, Math.PI / 2, stroke);
  drawCornerFlourish(ctx, 8 * s, h - 8 * s, 0.85 * s, -Math.PI / 2, stroke);
  drawCornerFlourish(ctx, width - 8 * s, h - 8 * s, 0.85 * s, Math.PI, stroke);

  ctx.restore();
}
