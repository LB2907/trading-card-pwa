/**
 * Coastal motifs: scallop shell, wave bands, sea foam (Tide theme).
 */

function drawScallopShell(
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
  const ridges = 6;
  ctx.beginPath();
  ctx.moveTo(0, 14);
  for (let i = 0; i <= ridges; i++) {
    const t = (i / ridges) * Math.PI - Math.PI / 2;
    const rx = Math.cos(t) * 16;
    const ry = Math.sin(t) * 10 - 4;
    ctx.lineTo(rx, ry);
  }
  ctx.closePath();
  const g = ctx.createLinearGradient(0, -14, 0, 14);
  g.addColorStop(0, "rgba(230,248,255,0.55)");
  g.addColorStop(0.5, "rgba(180,220,235,0.4)");
  g.addColorStop(1, "rgba(120,175,195,0.35)");
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = "rgba(60,110,130,0.35)";
  ctx.lineWidth = 0.65;
  ctx.stroke();
  for (let i = 1; i < ridges; i++) {
    const t = (i / ridges) * Math.PI - Math.PI / 2;
    ctx.beginPath();
    ctx.moveTo(0, 12);
    ctx.quadraticCurveTo(Math.cos(t) * 12, Math.sin(t) * 7 - 2, Math.cos(t) * 4, -6);
    ctx.strokeStyle = "rgba(80,130,150,0.22)";
    ctx.lineWidth = 0.4;
    ctx.stroke();
  }
  ctx.restore();
}

function drawWaveBand(
  ctx: CanvasRenderingContext2D,
  y: number,
  width: number,
  amp: number,
  phase: number,
  color: string,
  lw: number,
): void {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = lw;
  ctx.lineCap = "round";
  ctx.beginPath();
  const step = 8;
  for (let x = 0; x <= width; x += step) {
    const yy = y + Math.sin((x + phase) * 0.045) * amp;
    if (x === 0) ctx.moveTo(x, yy);
    else ctx.lineTo(x, yy);
  }
  ctx.stroke();
  ctx.restore();
}

export function paintTideBackdropMotifs(
  ctx: CanvasRenderingContext2D,
  width: number,
  h: number,
  artTop: number,
  artH: number,
): void {
  const artBottom = artTop + artH;
  const s = Math.max(0.65, Math.min(1.15, width / 220));
  ctx.save();

  const baseY = artBottom + (h - artBottom) * 0.55;
  drawWaveBand(ctx, baseY, width, 4 * s, 0, "rgba(120,190,210,0.35)", 1.4 * s);
  drawWaveBand(ctx, baseY + 10 * s, width, 3 * s, 40, "rgba(90,160,185,0.28)", 1.1 * s);
  drawWaveBand(ctx, baseY + 20 * s, width, 2.5 * s, 80, "rgba(70,130,155,0.22)", 0.9 * s);

  drawScallopShell(ctx, width * 0.1, h * 0.88, 0.9 * s, -0.35);
  drawScallopShell(ctx, width * 0.9, h * 0.85, 0.75 * s, 0.4);

  for (let i = 0; i < 18; i++) {
    const x = ((i * 47) % 100) / 100 * width * 0.85 + width * 0.08;
    const y = baseY - 8 + (i % 3) * 5;
    ctx.globalAlpha = 0.12 + (i % 4) * 0.06;
    ctx.beginPath();
    ctx.arc(x, y, 1.2 * s, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(240,255,255,0.7)";
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  if (artTop > 10) {
    drawWaveBand(ctx, artTop * 0.75, width * 0.35, 2 * s, 120, "rgba(140,200,220,0.18)", 0.7 * s);
    ctx.beginPath();
    ctx.arc(width * 0.92, artTop * 0.45, 2.5 * s, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(200,235,255,0.25)";
    ctx.fill();
  }

  ctx.restore();
}
