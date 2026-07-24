/**
 * Gilded backdrop motifs — art-deco gold: a radiating sunburst of fine rays
 * from the top edge and stepped deco fans in the lower corners. Mirrored by
 * `gilded-dom-overlay.tsx`. Alphas kept low so art/text stay dominant.
 */
export function paintGildedBackdropMotifs(
  ctx: CanvasRenderingContext2D,
  width: number,
  h: number,
  artTop: number,
  artH: number,
  accent: string,
): void {
  ctx.save();

  // Sunburst rays fanning down from top-center
  const cx = width * 0.5;
  const cy = -h * 0.06;
  const rays = 24;
  ctx.strokeStyle = accent;
  ctx.lineWidth = 0.7;
  for (let i = 0; i < rays; i++) {
    const a = (Math.PI / (rays - 1)) * i;
    const len = h * 0.42;
    ctx.globalAlpha = i % 2 === 0 ? 0.14 : 0.07;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(a) * len, cy + Math.sin(a) * len);
    ctx.stroke();
  }

  // Thin deco double-rule under the art window
  const bandTop = artTop + artH;
  ctx.globalAlpha = 0.3;
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.moveTo(width * 0.12, bandTop + 4);
  ctx.lineTo(width * 0.88, bandTop + 4);
  ctx.stroke();
  ctx.globalAlpha = 0.16;
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  ctx.moveTo(width * 0.16, bandTop + 7);
  ctx.lineTo(width * 0.84, bandTop + 7);
  ctx.stroke();

  // Stepped deco fans in the lower corners
  const fan = (ox: number, dir: number) => {
    ctx.globalAlpha = 0.22;
    ctx.lineWidth = 0.8;
    for (let k = 1; k <= 4; k++) {
      const r = 6 + k * 5;
      ctx.beginPath();
      ctx.arc(ox, h - 6, r, dir > 0 ? -Math.PI / 2 : Math.PI, dir > 0 ? 0 : -Math.PI / 2, false);
      ctx.stroke();
    }
  };
  fan(width * 0.06, 1);
  fan(width * 0.94, -1);

  ctx.restore();
}
