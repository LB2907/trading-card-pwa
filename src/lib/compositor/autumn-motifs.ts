/**
 * Harvest motifs: maple-style lobed leaf, simple oak leaf, acorn (Autumn theme).
 */

function drawMapleLeaf(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  scale: number,
  rotation: number,
  fill: string,
): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rotation);
  ctx.scale(scale, scale);
  ctx.beginPath();
  ctx.moveTo(0, -22);
  ctx.bezierCurveTo(8, -18, 14, -8, 10, 2);
  ctx.bezierCurveTo(16, 4, 18, 12, 8, 10);
  ctx.bezierCurveTo(6, 16, -6, 16, -8, 10);
  ctx.bezierCurveTo(-18, 12, -16, 4, -10, 2);
  ctx.bezierCurveTo(-14, -8, -8, -18, 0, -22);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, -22, 0, 12);
  g.addColorStop(0, fill);
  g.addColorStop(1, "rgba(120,45,20,0.35)");
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = "rgba(60,20,8,0.35)";
  ctx.lineWidth = 0.55;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, -18);
  ctx.lineTo(0, 10);
  ctx.strokeStyle = "rgba(80,30,12,0.25)";
  ctx.lineWidth = 0.4;
  ctx.stroke();
  ctx.restore();
}

function drawOakLeaf(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  scale: number,
  rotation: number,
): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rotation);
  ctx.scale(scale, scale);
  ctx.beginPath();
  ctx.moveTo(0, -18);
  for (let i = 0; i < 6; i++) {
    const t = (i / 6) * Math.PI - Math.PI / 2;
    const wobble = 1 + 0.12 * Math.sin(i * 2.1);
    ctx.lineTo(Math.cos(t) * 9 * wobble, Math.sin(t) * 18 * wobble);
  }
  ctx.closePath();
  const g = ctx.createLinearGradient(-8, -18, 8, 12);
  g.addColorStop(0, "rgba(200,120,40,0.55)");
  g.addColorStop(1, "rgba(100,55,18,0.45)");
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = "rgba(50,25,8,0.3)";
  ctx.lineWidth = 0.5;
  ctx.stroke();
  ctx.restore();
}

function drawAcorn(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  scale: number,
  rotation: number,
): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rotation);
  ctx.scale(scale, scale);
  ctx.beginPath();
  ctx.moveTo(-7, -6);
  ctx.quadraticCurveTo(0, -12, 7, -6);
  ctx.lineTo(5, 2);
  ctx.lineTo(-5, 2);
  ctx.closePath();
  const capG = ctx.createLinearGradient(0, -12, 0, 2);
  capG.addColorStop(0, "rgba(90,55,30,0.85)");
  capG.addColorStop(1, "rgba(55,32,18,0.9)");
  ctx.fillStyle = capG;
  ctx.fill();
  ctx.strokeStyle = "rgba(30,15,8,0.4)";
  ctx.lineWidth = 0.45;
  ctx.stroke();

  ctx.beginPath();
  ctx.ellipse(0, 10, 6, 9, 0, 0, Math.PI * 2);
  const nutG = ctx.createLinearGradient(0, 1, 0, 20);
  nutG.addColorStop(0, "rgba(180,110,50,0.9)");
  nutG.addColorStop(1, "rgba(95,48,22,0.85)");
  ctx.fillStyle = nutG;
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

export function paintAutumnBackdropMotifs(
  ctx: CanvasRenderingContext2D,
  width: number,
  h: number,
  artTop: number,
  artH: number,
): void {
  const artBottom = artTop + artH;
  const s = Math.max(0.65, Math.min(1.2, width / 220));
  ctx.save();

  drawMapleLeaf(ctx, width * 0.1, h * 0.88, 0.95 * s, -0.5, "rgba(220,90,35,0.5)");
  drawOakLeaf(ctx, width * 0.2, h * 0.92, 0.75 * s, 0.35);
  drawAcorn(ctx, width * 0.06, h * 0.82, 0.85 * s, 0.25);

  drawMapleLeaf(ctx, width * 0.9, h * 0.86, 0.88 * s, 0.55, "rgba(200,70,28,0.48)");
  drawOakLeaf(ctx, width * 0.78, h * 0.9, 0.7 * s, -0.4);
  drawAcorn(ctx, width * 0.94, h * 0.8, 0.8 * s, -0.35);

  const midY = artBottom + (h - artBottom) * 0.32;
  drawMapleLeaf(ctx, width * 0.42, midY, 0.55 * s, 0.15, "rgba(255,140,50,0.42)");
  drawOakLeaf(ctx, width * 0.55, midY + 8 * s, 0.5 * s, 1.0);
  drawMapleLeaf(ctx, width * 0.62, midY - 4 * s, 0.48 * s, -0.9, "rgba(180,60,22,0.4)");

  if (artTop > 10) {
    drawOakLeaf(ctx, width * 0.12, artTop * 0.55, 0.45 * s, -0.2);
    drawMapleLeaf(ctx, width * 0.88, artTop * 0.5, 0.42 * s, 0.8, "rgba(210,100,30,0.38)");
  }

  ctx.restore();
}
