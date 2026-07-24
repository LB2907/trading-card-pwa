/**
 * Rarity-driven foil / finish overlay, layered over any template.
 * Baked into the canvas compositor so it survives export; mirrored in the DOM
 * preview by `foil-overlay.tsx`. Alphas are tuned to enhance, not obscure, the
 * art — a sheen, not a curtain.
 */
import type { RarityVisual } from "@/lib/card-visual";

export type FoilKind = "none" | "metallic" | "holographic" | "prismatic";

export type FoilFinish = {
  kind: FoilKind;
  /** 0..1 — scales the overlay opacity. */
  intensity: number;
};

/** Map the 7-tier gacha ladder (0 = common … 6 = mythic) to a finish. */
export function foilFinishForTier(tier: number): FoilFinish {
  if (tier <= 1) return { kind: "none", intensity: 0 };
  if (tier === 2) return { kind: "metallic", intensity: 0.45 };
  if (tier === 3) return { kind: "metallic", intensity: 0.6 };
  if (tier === 4) return { kind: "holographic", intensity: 0.68 };
  if (tier === 5) return { kind: "holographic", intensity: 0.82 };
  return { kind: "prismatic", intensity: 1 }; // >= 6
}

export function hasFoil(tier: number): boolean {
  return foilFinishForTier(tier).kind !== "none";
}

const SPECTRUM: readonly string[] = [
  "#ff5f6d",
  "#ffc371",
  "#f9f871",
  "#77dd77",
  "#6fd0ff",
  "#8a7bff",
  "#ff8ad8",
];

function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const anyCtx = ctx as CanvasRenderingContext2D & {
    roundRect?: (x: number, y: number, w: number, h: number, r: number) => void;
  };
  ctx.beginPath();
  if (typeof anyCtx.roundRect === "function") anyCtx.roundRect(x, y, w, h, r);
  else ctx.rect(x, y, w, h);
}

/**
 * Composite the finish over the whole card face. Assumes the caller is already
 * inside the card's rounded-rect clip and the correct scale transform.
 */
export function paintFoilFinish(
  ctx: CanvasRenderingContext2D,
  width: number,
  h: number,
  outerR: number,
  finish: FoilFinish,
  rv: RarityVisual,
): void {
  if (finish.kind === "none") return;

  ctx.save();
  roundRectPath(ctx, 0, 0, width, h, outerR);
  ctx.clip();

  // 1) Brushed-metal sheen — a bright diagonal streak that reads as a
  //    reflective surface. Present on every foil tier.
  ctx.globalCompositeOperation = "soft-light";
  const sheen = ctx.createLinearGradient(0, 0, width, h);
  const s = finish.intensity;
  sheen.addColorStop(0.0, `rgba(255,255,255,${0.05 * s})`);
  sheen.addColorStop(0.32, `rgba(255,255,255,${0.22 * s})`);
  sheen.addColorStop(0.44, `rgba(0,0,0,${0.16 * s})`);
  sheen.addColorStop(0.56, `rgba(255,255,255,${0.26 * s})`);
  sheen.addColorStop(0.7, `rgba(0,0,0,${0.12 * s})`);
  sheen.addColorStop(1.0, `rgba(255,255,255,${0.08 * s})`);
  ctx.fillStyle = sheen;
  ctx.fillRect(0, 0, width, h);

  // Rarity-tinted top gloss so the finish still nods to the tier color.
  const gloss = ctx.createLinearGradient(0, 0, 0, h * 0.5);
  gloss.addColorStop(0, rv.highlight);
  gloss.addColorStop(1, "rgba(0,0,0,0)");
  ctx.globalAlpha = 0.4 * s;
  ctx.fillStyle = gloss;
  ctx.fillRect(0, 0, width, h);
  ctx.globalAlpha = 1;

  if (finish.kind === "holographic" || finish.kind === "prismatic") {
    // 2) Diagonal rainbow bands — the holographic shimmer.
    ctx.globalCompositeOperation = "overlay";
    const holo = ctx.createLinearGradient(-width * 0.25, 0, width * 1.25, h);
    const bandAlpha = 0.16 * finish.intensity;
    SPECTRUM.forEach((c, i) => {
      const p = i / (SPECTRUM.length - 1);
      const rgb = hexToRgb(c);
      holo.addColorStop(p, `rgba(${rgb},${bandAlpha})`);
    });
    ctx.fillStyle = holo;
    ctx.fillRect(0, 0, width, h);

    // Counter-diagonal second pass for depth.
    const holo2 = ctx.createLinearGradient(width * 1.25, 0, -width * 0.25, h);
    SPECTRUM.forEach((c, i) => {
      const p = i / (SPECTRUM.length - 1);
      const rgb = hexToRgb(c);
      holo2.addColorStop(p, `rgba(${rgb},${bandAlpha * 0.6})`);
    });
    ctx.fillStyle = holo2;
    ctx.fillRect(0, 0, width, h);
  }

  if (finish.kind === "prismatic") {
    // 3) Prism burst — a bright radial highlight in the upper third.
    ctx.globalCompositeOperation = "color-dodge";
    const burst = ctx.createRadialGradient(
      width * 0.7,
      h * 0.22,
      0,
      width * 0.7,
      h * 0.22,
      width * 0.8,
    );
    burst.addColorStop(0, "rgba(255,255,255,0.22)");
    burst.addColorStop(0.4, "rgba(180,200,255,0.08)");
    burst.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = burst;
    ctx.fillRect(0, 0, width, h);
  }

  ctx.restore();
}

function hexToRgb(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
}
