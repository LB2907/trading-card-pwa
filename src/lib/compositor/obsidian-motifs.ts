/**
 * Obsidian backdrop motifs — glassy black-on-black: sharp angular facet planes
 * like cut onyx, with a couple of bright specular streaks catching the light.
 * Mirrored by `obsidian-dom-overlay.tsx`. Very low alpha; the drama is subtle.
 */
export function paintObsidianBackdropMotifs(
  ctx: CanvasRenderingContext2D,
  width: number,
  h: number,
  artTop: number,
  artH: number,
  accent: string,
): void {
  ctx.save();

  // Faceted planes: large angular polygons filled with faint light/dark tints.
  const facets: Array<[number[], number]> = [
    [[0, 0, width * 0.44, 0, 0, h * 0.3], 0.05],
    [[width, 0, width, h * 0.34, width * 0.62, 0], 0.035],
    [[0, h, width * 0.4, h, 0, h * 0.66], 0.045],
    [[width, h, width, h * 0.62, width * 0.58, h], 0.03],
  ];
  for (const [pts, alpha] of facets) {
    ctx.beginPath();
    ctx.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
    ctx.closePath();
    ctx.fillStyle = "#ffffff";
    ctx.globalAlpha = alpha;
    ctx.fill();
  }

  // Sharp specular streaks — thin bright diagonals like light on a polished edge.
  ctx.strokeStyle = accent;
  ctx.lineCap = "round";
  const streaks: Array<[number, number, number, number, number, number]> = [
    [width * 0.18, artTop * 0.4, width * 0.42, artTop + artH * 0.5, 0.22, 1.1],
    [width * 0.7, artTop + artH * 0.2, width * 0.9, artTop + artH * 0.9, 0.16, 0.9],
    [width * 0.1, artTop + artH + 12, width * 0.35, h - 8, 0.12, 0.7],
  ];
  for (const [x1, y1, x2, y2, alpha, lw] of streaks) {
    ctx.globalAlpha = alpha;
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  ctx.restore();
}
