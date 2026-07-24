/**
 * Boudoir noir backdrop motifs: silk-drape curves rising from the lower text
 * band and a lace scallop edge under the art window. Kept below ~0.35 alpha so
 * the art and text stay dominant. Mirrored by `boudoir-dom-overlay.tsx`.
 */
export function paintBoudoirBackdropMotifs(
  ctx: CanvasRenderingContext2D,
  width: number,
  h: number,
  artTop: number,
  artH: number,
  accent: string,
): void {
  const bandTop = artTop + artH;

  ctx.save();

  // Silk drape curves sweeping through the lower band
  const drapes: Array<[number, number, number]> = [
    [0.06, 0.3, 1.4],
    [0.16, 0.24, 1.1],
    [0.3, 0.18, 0.8],
  ];
  for (const [lift, alpha, lw] of drapes) {
    ctx.beginPath();
    ctx.moveTo(-width * 0.05, h * 0.99);
    ctx.bezierCurveTo(
      width * 0.25,
      bandTop + (h - bandTop) * lift,
      width * 0.7,
      h * 1.02,
      width * 1.05,
      bandTop + (h - bandTop) * (lift + 0.28),
    );
    ctx.strokeStyle = accent;
    ctx.globalAlpha = alpha;
    ctx.lineWidth = lw;
    ctx.stroke();
  }

  // Lace scallop edge hugging the bottom of the art window
  const scallops = 9;
  const rr = width / scallops / 2;
  ctx.beginPath();
  for (let i = 0; i < scallops; i++) {
    const cx = rr + i * rr * 2;
    ctx.moveTo(cx + rr, bandTop + 3);
    ctx.arc(cx, bandTop + 3, rr, 0, Math.PI, false);
  }
  ctx.strokeStyle = accent;
  ctx.globalAlpha = 0.22;
  ctx.lineWidth = 0.8;
  ctx.stroke();

  // Dot picots under each scallop dip
  ctx.globalAlpha = 0.3;
  ctx.fillStyle = accent;
  for (let i = 0; i <= scallops; i++) {
    const cx = i * rr * 2;
    ctx.beginPath();
    ctx.arc(cx, bandTop + 3 + rr * 0.55, 0.9, 0, Math.PI * 2);
    ctx.fill();
  }

  // Corner rose bud — small spiral, upper right of the frame
  const bx = width * 0.9;
  const by = artTop * 0.55;
  ctx.globalAlpha = 0.35;
  ctx.strokeStyle = accent;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let t = 0; t < Math.PI * 4.2; t += 0.25) {
    const r = 1.1 + t * 1.05;
    const px = bx + Math.cos(t) * r;
    const py = by + Math.sin(t) * r * 0.85;
    if (t === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.stroke();

  ctx.restore();
}
