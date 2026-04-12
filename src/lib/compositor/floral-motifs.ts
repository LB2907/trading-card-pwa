/**
 * Stylized botanical motifs for the floral TCG theme (canvas).
 * References common illustration patterns: five-petal wild rose (Rosa), Prunus-style
 * five-petal blossom, simple elliptic leaves and a light trailing stem.
 * DOM preview: `FloralDomMotifOverlay` in `floral-dom-overlay.tsx`.
 */

function drawPetalPath(
  ctx: CanvasRenderingContext2D,
  petalLen: number,
  petalW: number,
): void {
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(
    petalW * 1.1,
    -petalLen * 0.15,
    petalW * 0.95,
    -petalLen * 0.72,
    0,
    -petalLen,
  );
  ctx.bezierCurveTo(
    -petalW * 0.95,
    -petalLen * 0.72,
    -petalW * 1.1,
    -petalLen * 0.15,
    0,
    0,
  );
  ctx.closePath();
}

/** Wild-rose style: five overlapping petals, sepals, stamen disk. */
export function drawWildRose(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  scale: number,
  rotation: number,
  opts?: { petal?: string; center?: string; sepal?: string },
): void {
  const petal = opts?.petal ?? "rgba(232,168,195,0.42)";
  const center = opts?.center ?? "rgba(90,40,52,0.55)";
  const sepal = opts?.sepal ?? "rgba(72,110,78,0.38)";
  const petalLen = 26 * scale;
  const petalW = 11 * scale;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rotation);

  ctx.save();
  for (let i = 0; i < 5; i++) {
    ctx.rotate((2 * Math.PI) / 5);
    ctx.beginPath();
    drawPetalPath(ctx, petalLen, petalW);
    const g = ctx.createLinearGradient(0, 0, 0, -petalLen);
    g.addColorStop(0, petal);
    g.addColorStop(1, "rgba(255,220,235,0.2)");
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = "rgba(120,50,70,0.18)";
    ctx.lineWidth = Math.max(0.4, 0.5 * scale);
    ctx.stroke();
  }
  ctx.restore();

  ctx.save();
  for (let i = 0; i < 5; i++) {
    ctx.save();
    ctx.rotate((i * 2 * Math.PI) / 5 + Math.PI / 10);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(5 * scale, 4 * scale);
    ctx.lineTo(0, 7 * scale);
    ctx.lineTo(-5 * scale, 4 * scale);
    ctx.closePath();
    ctx.fillStyle = sepal;
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();

  const rg = ctx.createRadialGradient(0, 0, 0, 0, 0, 8 * scale);
  rg.addColorStop(0, "rgba(255,230,160,0.55)");
  rg.addColorStop(0.45, center);
  rg.addColorStop(1, "rgba(40,18,28,0.35)");
  ctx.beginPath();
  ctx.arc(0, 0, 7 * scale, 0, Math.PI * 2);
  ctx.fillStyle = rg;
  ctx.fill();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    ctx.fillStyle = "rgba(255,248,220,0.35)";
    ctx.beginPath();
    ctx.arc(Math.cos(a) * 3.2 * scale, Math.sin(a) * 3.2 * scale, 0.9 * scale, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

/** Sakura-style: five shallow rounded petals with slight notch. */
export function drawCherryBlossom(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  scale: number,
  rotation: number,
): void {
  const n = 5;
  const r = 14 * scale;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rotation);
  for (let i = 0; i < n; i++) {
    ctx.rotate((2 * Math.PI) / n);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(5.5 * scale, -r * 0.35, 0, -r);
    ctx.quadraticCurveTo(-5.5 * scale, -r * 0.35, 0, 0);
    const g = ctx.createLinearGradient(0, 0, 0, -r);
    g.addColorStop(0, "rgba(255,218,230,0.5)");
    g.addColorStop(1, "rgba(240,170,200,0.28)");
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = "rgba(180,100,130,0.2)";
    ctx.lineWidth = 0.45 * scale;
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(0, 0, 3.2 * scale, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,240,210,0.45)";
  ctx.fill();
  ctx.restore();
}

function drawLeaf(
  ctx: CanvasRenderingContext2D,
  ox: number,
  oy: number,
  angle: number,
  scale: number,
): void {
  ctx.save();
  ctx.translate(ox, oy);
  ctx.rotate(angle);
  ctx.scale(scale, scale);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(10, -4, 18, -16, 0, -28);
  ctx.bezierCurveTo(-18, -16, -10, -4, 0, 0);
  const g = ctx.createLinearGradient(0, 0, 0, -28);
  g.addColorStop(0, "rgba(88,130,92,0.45)");
  g.addColorStop(1, "rgba(48,78,52,0.35)");
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = "rgba(32,56,36,0.35)";
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  ctx.moveTo(0, -2);
  ctx.quadraticCurveTo(2, -14, 0, -26);
  ctx.stroke();
  ctx.restore();
}

function drawCurvedStem(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  scale: number,
): void {
  const cx = (x0 + x1) / 2 + 22 * scale;
  const cy = (y0 + y1) / 2 - 8 * scale;
  ctx.save();
  ctx.strokeStyle = "rgba(58,88,58,0.42)";
  ctx.lineWidth = Math.max(1.1, 1.6 * scale);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.quadraticCurveTo(cx, cy, x1, y1);
  ctx.stroke();
  ctx.strokeStyle = "rgba(120,160,120,0.22)";
  ctx.lineWidth = 0.45 * scale;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.quadraticCurveTo(cx, cy, x1, y1);
  ctx.stroke();
  ctx.restore();
}

/**
 * Paints decorative flowers into the card backdrop (call before global sheen).
 * Motifs concentrate in the lower text band and corners so art stays readable.
 */
export function paintFloralBackdropMotifs(
  ctx: CanvasRenderingContext2D,
  width: number,
  h: number,
  artTop: number,
  artH: number,
): void {
  const artBottom = artTop + artH;
  const s = Math.max(0.65, Math.min(1.35, width / 200));

  ctx.save();
  ctx.globalCompositeOperation = "source-over";

  drawCurvedStem(ctx, width * 0.02, h * 0.78, width * 0.34, h * 0.93, s);
  drawLeaf(ctx, width * 0.08, h * 0.82, -0.9, 0.85 * s);
  drawLeaf(ctx, width * 0.18, h * 0.88, 0.4, 0.7 * s);
  drawWildRose(ctx, width * 0.1, h * 0.9, 1.05 * s, -0.35);

  drawCurvedStem(ctx, width * 0.98, h * 0.76, width * 0.66, h * 0.92, s);
  drawLeaf(ctx, width * 0.92, h * 0.8, 0.85, 0.8 * s);
  drawLeaf(ctx, width * 0.78, h * 0.87, -0.55, 0.65 * s);
  drawWildRose(ctx, width * 0.9, h * 0.89, 0.98 * s, 0.42, {
    petal: "rgba(220,158,188,0.38)",
    center: "rgba(75,38,55,0.5)",
  });

  const midY = artBottom + (h - artBottom) * 0.38;
  drawCherryBlossom(ctx, width * 0.42, midY, 0.72 * s, 0.2);
  drawCherryBlossom(ctx, width * 0.52, midY + 6 * s, 0.58 * s, 1.1);
  drawCherryBlossom(ctx, width * 0.6, midY - 2 * s, 0.62 * s, -0.6);

  drawCurvedStem(ctx, width * 0.48, artBottom + 4, width * 0.5, midY + 10, s * 0.9);
  drawLeaf(ctx, width * 0.47, midY + 2, -0.2, 0.55 * s);

  if (artTop > 10) {
    drawCherryBlossom(ctx, width * 0.08, artTop * 0.55, 0.5 * s, 0.8);
    drawCherryBlossom(ctx, width * 0.92, artTop * 0.5, 0.48 * s, -0.4);
    drawLeaf(ctx, width * 0.04, artTop * 0.85, -0.5, 0.45 * s);
    drawLeaf(ctx, width * 0.96, artTop * 0.78, 0.6, 0.42 * s);
  }

  ctx.restore();
}
