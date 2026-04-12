/**
 * Neon city: soft horizon glow + a few restrained vertical accents (canvas).
 */

function parseRgb(hex: string): { r: number; g: number; b: number } {
  if (!hex?.startsWith("#") || hex.length < 7) return { r: 78, g: 205, b: 196 };
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
  };
}

export function paintNeonCityBackdropMotifs(
  ctx: CanvasRenderingContext2D,
  width: number,
  h: number,
  artTop: number,
  _artH: number,
  accentHex: string,
): void {
  const artBottom = artTop + _artH;
  const s = Math.max(0.65, Math.min(1.1, width / 220));
  const { r, g, b } = parseRgb(accentHex);

  ctx.save();

  const floor = ctx.createRadialGradient(
    width * 0.5,
    h * 0.97,
    0,
    width * 0.52,
    h * 0.88,
    width * 0.72,
  );
  floor.addColorStop(0, `rgba(${r},${g},${b},0.14)`);
  floor.addColorStop(0.45, `rgba(${Math.floor(r * 0.4)},${Math.floor(g * 0.5)},${Math.floor(b * 0.55)},0.06)`);
  floor.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = floor;
  ctx.fillRect(0, artBottom + (h - artBottom) * 0.45, width, h * 0.55);

  const cols = [0.22, 0.42, 0.62, 0.78];
  for (let i = 0; i < cols.length; i++) {
    const x = width * cols[i]!;
    const wCol = 22 * s;
    const g1 = ctx.createLinearGradient(x - wCol / 2, h * 0.52, x + wCol / 2, h * 0.52);
    g1.addColorStop(0, "rgba(0,0,0,0)");
    g1.addColorStop(0.5, `rgba(${r},${g},${b},0.055)`);
    g1.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g1;
    ctx.fillRect(x - wCol / 2, h * 0.52, wCol, h * 0.46);

    ctx.strokeStyle = `rgba(${r},${g},${b},0.22)`;
    ctx.lineWidth = 1.1 * s;
    ctx.shadowColor = `rgba(${r},${g},${b},0.35)`;
    ctx.shadowBlur = 6 * s;
    ctx.beginPath();
    ctx.moveTo(x, h * 0.56);
    ctx.lineTo(x, h * 0.96);
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  ctx.strokeStyle = "rgba(255,255,255,0.035)";
  ctx.lineWidth = 0.55;
  ctx.beginPath();
  ctx.moveTo(width * 0.08, h * 0.9);
  ctx.lineTo(width * 0.92, h * 0.9);
  ctx.stroke();

  if (artTop > 14) {
    ctx.globalAlpha = 0.12;
    ctx.strokeStyle = `rgba(${r},${g},${b},0.5)`;
    ctx.lineWidth = 0.65 * s;
    ctx.beginPath();
    ctx.moveTo(width * 0.18, artTop * 0.4);
    ctx.lineTo(width * 0.18, artTop * 0.75);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(width * 0.82, artTop * 0.38);
    ctx.lineTo(width * 0.82, artTop * 0.72);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  ctx.restore();
}
