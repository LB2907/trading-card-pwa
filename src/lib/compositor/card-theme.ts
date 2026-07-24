import type { CardLayoutJson } from "@/lib/card-layout";
import { type RarityVisual, rarityVisual } from "@/lib/card-visual";
import { paintAutumnBackdropMotifs } from "@/lib/compositor/autumn-motifs";
import { paintCelestialBackdropMotifs } from "@/lib/compositor/celestial-motifs";
import { paintCelestialClockBackdropMotifs } from "@/lib/compositor/celestial-clock-motifs";
import { paintBoudoirBackdropMotifs } from "@/lib/compositor/boudoir-motifs";
import { paintGildedBackdropMotifs } from "@/lib/compositor/gilded-motifs";
import { paintObsidianBackdropMotifs } from "@/lib/compositor/obsidian-motifs";
import { paintFloralBackdropMotifs } from "@/lib/compositor/floral-motifs";
import { paintMonolineInkBackdropMotifs } from "@/lib/compositor/monoline-ink-motifs";
import { paintNeonCityBackdropMotifs } from "@/lib/compositor/neon-city-motifs";
import { paintTideBackdropMotifs } from "@/lib/compositor/tide-motifs";
import {
  canvasFontSans,
  canvasFontSansItalic,
  canvasFontSerifItalic,
} from "@/lib/compositor/canvas-font";
import { rarityTier } from "@/lib/rarity";
import {
  type TcgTheme,
  normalizeTcgTheme,
} from "@/lib/tcg-theme-base";
import { THEME_DESCRIPTORS } from "@/lib/compositor/theme-descriptors";

export type { TcgTheme } from "@/lib/tcg-theme-base";

function pathRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  rad: number,
) {
  const anyCtx = ctx as CanvasRenderingContext2D & {
    roundRect?: (x: number, y: number, w: number, h: number, r: number) => void;
  };
  if (typeof anyCtx.roundRect === "function") {
    anyCtx.roundRect(x, y, w, h, rad);
  } else {
    ctx.rect(x, y, w, h);
  }
}

function parseHex(hex: string, fallback: string): string {
  if (!hex?.startsWith("#") || hex.length < 7) return fallback;
  return hex;
}

/**
 * Layered glow and accent rings — stronger for higher gacha tiers
 * (0 = common … 6 = mythic).
 */
function paintRarityOrnament(
  ctx: CanvasRenderingContext2D,
  width: number,
  h: number,
  outerR: number,
  rv: RarityVisual,
  tier: number,
): void {
  if (tier < 1) return;

  const outerPath = () => {
    ctx.beginPath();
    pathRoundRect(ctx, 0.5, 0.5, width - 1, h - 1, outerR);
  };
  const midPath = () => {
    ctx.beginPath();
    pathRoundRect(ctx, 4, 4, width - 8, h - 8, Math.max(1, outerR - 3));
  };
  const innerBandPath = () => {
    ctx.beginPath();
    pathRoundRect(ctx, 7, 7, width - 14, h - 14, Math.max(1, outerR - 5));
  };

  ctx.save();
  outerPath();
  ctx.strokeStyle = rv.primary;
  ctx.globalAlpha = 0.3 + Math.min(tier, 4) * 0.07;
  ctx.lineWidth = tier >= 4 ? 2.25 : tier >= 2 ? 1.75 : 1.35;
  ctx.shadowColor = rv.primary;
  ctx.shadowBlur = 8 + tier * 5;
  ctx.stroke();
  ctx.restore();

  if (tier >= 2) {
    ctx.save();
    outerPath();
    ctx.strokeStyle = rv.highlight;
    ctx.globalAlpha = 0.38;
    ctx.lineWidth = 1;
    ctx.shadowColor = rv.primary;
    ctx.shadowBlur = 14 + tier * 6;
    ctx.stroke();
    ctx.restore();
  }

  if (tier >= 3 && rv.accent2) {
    ctx.save();
    midPath();
    ctx.strokeStyle = rv.accent2;
    ctx.globalAlpha = 0.48;
    ctx.lineWidth = 1.35;
    ctx.shadowColor = rv.accent2;
    ctx.shadowBlur = 18;
    ctx.stroke();
    ctx.restore();
  }

  if (tier >= 4) {
    ctx.save();
    outerPath();
    ctx.strokeStyle = "#ffffff";
    ctx.globalAlpha = 0.2;
    ctx.lineWidth = 0.75;
    ctx.shadowColor = rv.highlight;
    ctx.shadowBlur = 22 + tier * 4;
    ctx.stroke();
    ctx.restore();
  }

  if (tier >= 5) {
    ctx.save();
    innerBandPath();
    ctx.strokeStyle = rv.highlight;
    ctx.globalAlpha = 0.28;
    ctx.lineWidth = 1.6;
    ctx.shadowBlur = 16;
    ctx.stroke();
    ctx.restore();
  }

  if (tier >= 6) {
    ctx.save();
    ctx.beginPath();
    pathRoundRect(ctx, -1, -1, width + 2, h + 2, outerR + 1);
    ctx.strokeStyle = rv.accent2 ?? rv.primary;
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 3;
    ctx.shadowColor = rv.highlight;
    ctx.shadowBlur = 42;
    ctx.stroke();
    ctx.restore();

    ctx.save();
    outerPath();
    ctx.strokeStyle = rv.primary;
    ctx.globalAlpha = 0.32;
    ctx.lineWidth = 1.75;
    ctx.shadowBlur = 28;
    ctx.stroke();
    ctx.restore();
  }
}

/** Backdrop inside outer clip (no stroke here — draw-card adds borders). */
export function paintThemedBackdrop(
  ctx: CanvasRenderingContext2D,
  width: number,
  h: number,
  layout: CardLayoutJson,
  rv: RarityVisual,
  theme: TcgTheme,
  artTop: number,
  artH: number,
  artW: number,
): void {
  const frame = parseHex(layout.frameColor, "#111015");
  const accent = parseHex(layout.accentColor, "#c9a962");

  switch (theme) {
    case "trainer": {
      const g = ctx.createLinearGradient(0, 0, width * 0.55, h * 1.05);
      g.addColorStop(0, "#5c4d28");
      g.addColorStop(0.18, "#9a8230");
      g.addColorStop(0.42, frame);
      g.addColorStop(0.78, "#121008");
      g.addColorStop(1, "#0a0805");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, width, h);
      const g2 = ctx.createLinearGradient(width, 0, 0, h * 0.42);
      g2.addColorStop(0, "rgba(255,240,180,0.22)");
      g2.addColorStop(0.28, "rgba(255,220,130,0.08)");
      g2.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g2;
      ctx.fillRect(0, 0, width, h);
      break;
    }
    case "duelist": {
      const g = ctx.createRadialGradient(
        width * 0.5,
        h * 0.1,
        width * 0.06,
        width * 0.52,
        h * 0.58,
        h * 0.98,
      );
      g.addColorStop(0, "#564070");
      g.addColorStop(0.32, frame);
      g.addColorStop(0.7, "#0a0614");
      g.addColorStop(1, "#030208");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, width, h);
      const sweep = ctx.createLinearGradient(0, 0, width, 0);
      sweep.addColorStop(0, "rgba(196,181,232,0.14)");
      sweep.addColorStop(0.5, "rgba(110,90,160,0.1)");
      sweep.addColorStop(1, "rgba(196,181,232,0.12)");
      ctx.fillStyle = sweep;
      ctx.fillRect(0, 0, width, h * 0.38);
      break;
    }
    case "planeswalker": {
      const g = ctx.createLinearGradient(0, 0, width * 0.4, h * 1.08);
      g.addColorStop(0, "#18120e");
      g.addColorStop(0.48, frame);
      g.addColorStop(1, "#060403");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, width, h);
      const warm = ctx.createLinearGradient(width, 0, width * 0.38, h * 0.72);
      warm.addColorStop(0, "rgba(214,180,124,0.24)");
      warm.addColorStop(0.5, "rgba(130,98,60,0.1)");
      warm.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = warm;
      ctx.fillRect(0, 0, width, h);
      const vign = ctx.createRadialGradient(
        width * 0.5,
        h * 0.85,
        0,
        width * 0.5,
        h * 0.85,
        h * 0.65,
      );
      vign.addColorStop(0, "rgba(0,0,0,0)");
      vign.addColorStop(1, "rgba(0,0,0,0.45)");
      ctx.fillStyle = vign;
      ctx.fillRect(0, 0, width, h);
      break;
    }
    case "floral": {
      const g = ctx.createLinearGradient(0, 0, width * 0.92, h * 1.02);
      g.addColorStop(0, "#1a1016");
      g.addColorStop(0.22, "#26141c");
      g.addColorStop(0.48, frame);
      g.addColorStop(0.76, "#120a0e");
      g.addColorStop(1, "#080406");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, width, h);
      const leaf = ctx.createLinearGradient(0, h * 0.5, width * 0.45, h);
      leaf.addColorStop(0, "rgba(0,0,0,0)");
      leaf.addColorStop(0.55, "rgba(48,72,52,0.28)");
      leaf.addColorStop(1, "rgba(24,40,30,0.42)");
      ctx.fillStyle = leaf;
      ctx.fillRect(0, 0, width, h);
      const bloom = ctx.createRadialGradient(
        width * 0.88,
        h * 0.12,
        0,
        width * 0.72,
        h * 0.22,
        width * 0.55,
      );
      bloom.addColorStop(0, "rgba(252,210,228,0.2)");
      bloom.addColorStop(0.4, "rgba(180,110,140,0.09)");
      bloom.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = bloom;
      ctx.fillRect(0, 0, width, h);
      const mist = ctx.createLinearGradient(0, 0, width * 0.35, h * 0.55);
      mist.addColorStop(0, "rgba(200,230,210,0.08)");
      mist.addColorStop(0.55, "rgba(0,0,0,0)");
      mist.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = mist;
      ctx.fillRect(0, 0, width, h);
      paintFloralBackdropMotifs(ctx, width, h, artTop, artH);
      break;
    }
    case "celestial": {
      const g = ctx.createLinearGradient(0, 0, width, h * 1.05);
      g.addColorStop(0, "#0a0e1a");
      g.addColorStop(0.35, frame);
      g.addColorStop(0.7, "#060812");
      g.addColorStop(1, "#03050a");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, width, h);
      const neb = ctx.createRadialGradient(
        width * 0.2,
        h * 0.35,
        0,
        width * 0.35,
        h * 0.45,
        width * 0.55,
      );
      neb.addColorStop(0, "rgba(100,80,180,0.18)");
      neb.addColorStop(0.4, "rgba(40,60,140,0.08)");
      neb.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = neb;
      ctx.fillRect(0, 0, width, h);
      const neb2 = ctx.createRadialGradient(
        width * 0.85,
        h * 0.55,
        0,
        width * 0.72,
        h * 0.42,
        width * 0.45,
      );
      neb2.addColorStop(0, "rgba(60,120,200,0.12)");
      neb2.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = neb2;
      ctx.fillRect(0, 0, width, h);
      paintCelestialBackdropMotifs(ctx, width, h, artTop, artH);
      break;
    }
    case "autumn": {
      const g = ctx.createLinearGradient(0, 0, width * 0.9, h);
      g.addColorStop(0, "#1c0e08");
      g.addColorStop(0.28, "#2a140c");
      g.addColorStop(0.5, frame);
      g.addColorStop(0.75, "#140a06");
      g.addColorStop(1, "#080402");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, width, h);
      const glow = ctx.createRadialGradient(
        width * 0.25,
        h * 0.75,
        0,
        width * 0.35,
        h * 0.82,
        width * 0.5,
      );
      glow.addColorStop(0, "rgba(220,120,40,0.15)");
      glow.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, width, h);
      const rust = ctx.createLinearGradient(width, 0, 0, h * 0.6);
      rust.addColorStop(0, "rgba(180,60,30,0.1)");
      rust.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = rust;
      ctx.fillRect(0, 0, width, h);
      paintAutumnBackdropMotifs(ctx, width, h, artTop, artH);
      break;
    }
    case "tide": {
      const g = ctx.createLinearGradient(0, 0, width * 0.5, h * 1.02);
      g.addColorStop(0, "#061218");
      g.addColorStop(0.4, frame);
      g.addColorStop(0.75, "#040c12");
      g.addColorStop(1, "#020608");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, width, h);
      const caustic = ctx.createLinearGradient(0, h * 0.4, width, h);
      caustic.addColorStop(0, "rgba(0,0,0,0)");
      caustic.addColorStop(0.5, "rgba(80,200,220,0.1)");
      caustic.addColorStop(1, "rgba(40,120,140,0.14)");
      ctx.fillStyle = caustic;
      ctx.fillRect(0, 0, width, h);
      const surface = ctx.createLinearGradient(0, h * 0.65, width * 0.8, h);
      surface.addColorStop(0, "rgba(0,0,0,0)");
      surface.addColorStop(1, "rgba(30,90,110,0.22)");
      ctx.fillStyle = surface;
      ctx.fillRect(0, 0, width, h);
      paintTideBackdropMotifs(ctx, width, h, artTop, artH);
      break;
    }
    case "celestial_clock": {
      const g = ctx.createLinearGradient(0, 0, width * 0.85, h);
      g.addColorStop(0, "#0e0a12");
      g.addColorStop(0.35, frame);
      g.addColorStop(0.72, "#08060c");
      g.addColorStop(1, "#030205");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, width, h);
      const halo = ctx.createRadialGradient(
        width * 0.5,
        h * 0.72,
        0,
        width * 0.5,
        h * 0.78,
        width * 0.55,
      );
      halo.addColorStop(0, "rgba(180,140,80,0.12)");
      halo.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = halo;
      ctx.fillRect(0, 0, width, h);
      paintCelestialClockBackdropMotifs(ctx, width, h, artTop, artH);
      break;
    }
    case "neon_city": {
      const g = ctx.createLinearGradient(0, 0, width, h * 1.02);
      g.addColorStop(0, "#050810");
      g.addColorStop(0.45, frame);
      g.addColorStop(0.82, "#03060c");
      g.addColorStop(1, "#020308");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, width, h);
      const mist = ctx.createRadialGradient(
        width * 0.35,
        h * 0.88,
        0,
        width * 0.5,
        h * 0.95,
        width * 0.75,
      );
      mist.addColorStop(0, "rgba(40,90,95,0.12)");
      mist.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = mist;
      ctx.fillRect(0, 0, width, h);
      paintNeonCityBackdropMotifs(ctx, width, h, artTop, artH, accent);
      break;
    }
    case "monoline_ink": {
      const g = ctx.createLinearGradient(0, 0, width, h * 1.05);
      g.addColorStop(0, "#12100e");
      g.addColorStop(0.42, frame);
      g.addColorStop(0.78, "#0c0a08");
      g.addColorStop(1, "#060504");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, width, h);
      const paper = ctx.createLinearGradient(0, h * 0.55, width * 0.6, h);
      paper.addColorStop(0, "rgba(0,0,0,0)");
      paper.addColorStop(1, "rgba(55,48,40,0.18)");
      ctx.fillStyle = paper;
      ctx.fillRect(0, 0, width, h);
      paintMonolineInkBackdropMotifs(ctx, width, h, artTop, artH, accent);
      break;
    }
    case "boudoir": {
      const g = ctx.createLinearGradient(0, 0, width * 0.5, h * 1.04);
      g.addColorStop(0, "#1f0f18");
      g.addColorStop(0.3, frame);
      g.addColorStop(0.72, "#120810");
      g.addColorStop(1, "#070308");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, width, h);
      const glow = ctx.createRadialGradient(
        width * 0.82, h * 0.16, 0,
        width * 0.7, h * 0.24, width * 0.6,
      );
      glow.addColorStop(0, "rgba(232,164,186,0.16)");
      glow.addColorStop(0.45, "rgba(160,90,116,0.07)");
      glow.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, width, h);
      paintBoudoirBackdropMotifs(ctx, width, h, artTop, artH, accent);
      break;
    }
    case "gilded": {
      const g = ctx.createLinearGradient(0, 0, width * 0.6, h * 1.04);
      g.addColorStop(0, "#241b0c");
      g.addColorStop(0.34, frame);
      g.addColorStop(0.74, "#100c05");
      g.addColorStop(1, "#070503");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, width, h);
      const warm = ctx.createRadialGradient(
        width * 0.5, -h * 0.05, 0,
        width * 0.5, h * 0.2, width * 0.7,
      );
      warm.addColorStop(0, "rgba(212,175,55,0.14)");
      warm.addColorStop(0.5, "rgba(180,140,40,0.05)");
      warm.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = warm;
      ctx.fillRect(0, 0, width, h);
      paintGildedBackdropMotifs(ctx, width, h, artTop, artH, accent);
      break;
    }
    case "obsidian": {
      const g = ctx.createLinearGradient(0, 0, width * 0.5, h * 1.05);
      g.addColorStop(0, "#191a1e");
      g.addColorStop(0.34, frame);
      g.addColorStop(0.72, "#0a0b0d");
      g.addColorStop(1, "#050506");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, width, h);
      const cool = ctx.createRadialGradient(
        width * 0.72, h * 0.2, 0,
        width * 0.6, h * 0.3, width * 0.7,
      );
      cool.addColorStop(0, "rgba(174,182,194,0.1)");
      cool.addColorStop(0.5, "rgba(120,130,150,0.035)");
      cool.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = cool;
      ctx.fillRect(0, 0, width, h);
      paintObsidianBackdropMotifs(ctx, width, h, artTop, artH, accent);
      break;
    }
    default: {
      const base = ctx.createLinearGradient(0, 0, width * 1.05, h * 1.02);
      base.addColorStop(0, "#1a1d24");
      base.addColorStop(0.38, frame);
      base.addColorStop(0.72, "#0e0d0c");
      base.addColorStop(1, "#050506");
      ctx.fillStyle = base;
      ctx.fillRect(0, 0, width, h);
      const edge = ctx.createLinearGradient(0, 0, 0, h * 0.5);
      edge.addColorStop(0, "rgba(212,175,55,0.1)");
      edge.addColorStop(0.45, "rgba(201,162,39,0.04)");
      edge.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = edge;
      ctx.fillRect(0, 0, width, h);
      const cool = ctx.createLinearGradient(width, 0, 0, h);
      cool.addColorStop(0, "rgba(148,163,184,0.06)");
      cool.addColorStop(0.5, "rgba(0,0,0,0)");
      cool.addColorStop(1, "rgba(15,23,42,0.08)");
      ctx.fillStyle = cool;
      ctx.fillRect(0, 0, width, h);
    }
  }

  const sheen = ctx.createLinearGradient(0, 0, 0, h * 0.42);
  sheen.addColorStop(0, "rgba(255,255,255,0.055)");
  sheen.addColorStop(0.55, "rgba(255,255,255,0.02)");
  sheen.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = sheen;
  ctx.fillRect(0, 0, width, h);

  if (theme !== "duelist") {
    const softGlow = ctx.createRadialGradient(
      width * 0.5,
      artTop + artH * 0.35,
      0,
      width * 0.5,
      artTop + artH * 0.35,
      artW * 0.9,
    );
    softGlow.addColorStop(0, rv.soft);
    softGlow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = softGlow;
    ctx.fillRect(0, 0, width, h);
  } else {
    const g3 = ctx.createRadialGradient(
      width * 0.5,
      artTop + artH * 0.4,
      0,
      width * 0.5,
      artTop + artH * 0.4,
      artW * 0.75,
    );
    g3.addColorStop(0, "rgba(155,126,189,0.14)");
    g3.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g3;
    ctx.fillRect(0, 0, width, h);
  }
}

export function paintThemedOuterBorder(
  ctx: CanvasRenderingContext2D,
  width: number,
  h: number,
  outerR: number,
  layout: CardLayoutJson,
  rv: RarityVisual,
  theme: TcgTheme,
  raritySlug: string,
): void {
  const accent = parseHex(layout.accentColor, "#8b7355");
  ctx.beginPath();
  pathRoundRect(ctx, 0.5, 0.5, width - 1, h - 1, outerR);
  ctx.strokeStyle = "rgba(0,0,0,0.55)";
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.beginPath();
  pathRoundRect(ctx, 0, 0, width, h, outerR);
  ctx.strokeStyle =
    theme === "trainer"
      ? "rgba(255,236,170,0.62)"
      : theme === "boudoir"
        ? "rgba(255,214,228,0.26)"
        : theme === "floral"
        ? "rgba(255,232,242,0.22)"
        : theme === "celestial"
          ? "rgba(210,230,255,0.28)"
          : theme === "autumn"
            ? "rgba(255,215,170,0.26)"
            : theme === "tide"
              ? "rgba(170,240,252,0.28)"
              : theme === "celestial_clock"
                ? "rgba(215,185,120,0.3)"
                : theme === "neon_city"
                  ? "rgba(120,220,210,0.28)"
                  : theme === "monoline_ink"
                    ? "rgba(220,210,200,0.24)"
                    : "rgba(255,255,255,0.14)";
  ctx.lineWidth =
    theme === "trainer"
      ? 2.25
      : theme === "boudoir"
        ? 1.35
        : theme === "floral"
        ? 1.4
        : theme === "celestial" || theme === "autumn"
          ? 1.35
          : theme === "tide"
            ? 1.3
            : theme === "celestial_clock" || theme === "monoline_ink"
              ? 1.28
              : theme === "neon_city"
                ? 1.15
                : 1.25;
  ctx.stroke();

  ctx.beginPath();
  pathRoundRect(ctx, 2.5, 2.5, width - 5, h - 5, Math.max(2, outerR - 2));
  if (theme === "planeswalker") {
    ctx.strokeStyle = accent;
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 1.35;
  } else if (theme === "boudoir") {
    ctx.strokeStyle = "rgba(226,158,184,0.5)";
    ctx.globalAlpha = 1;
    ctx.lineWidth = 1.3;
  } else if (theme === "floral") {
    ctx.strokeStyle = "rgba(236,182,206,0.48)";
    ctx.globalAlpha = 1;
    ctx.lineWidth = 1.25;
  } else if (theme === "celestial") {
    ctx.strokeStyle = "rgba(150,195,255,0.48)";
    ctx.globalAlpha = 1;
    ctx.lineWidth = 1.2;
  } else if (theme === "autumn") {
    ctx.strokeStyle = "rgba(230,150,80,0.45)";
    ctx.globalAlpha = 1;
    ctx.lineWidth = 1.2;
  } else if (theme === "tide") {
    ctx.strokeStyle = "rgba(120,210,225,0.46)";
    ctx.globalAlpha = 1;
    ctx.lineWidth = 1.15;
  } else if (theme === "celestial_clock") {
    ctx.strokeStyle = "rgba(200,170,110,0.42)";
    ctx.globalAlpha = 1;
    ctx.lineWidth = 1.15;
  } else if (theme === "neon_city") {
    ctx.strokeStyle = "rgba(78,200,195,0.42)";
    ctx.globalAlpha = 1;
    ctx.lineWidth = 1.1;
  } else if (theme === "monoline_ink") {
    ctx.strokeStyle = "rgba(210,200,190,0.4)";
    ctx.globalAlpha = 1;
    ctx.lineWidth = 1.05;
  } else if (theme === "duelist") {
    ctx.strokeStyle = "rgba(210,195,255,0.42)";
    ctx.globalAlpha = 1;
    ctx.lineWidth = 1.1;
  } else if (theme === "trainer") {
    ctx.strokeStyle = "rgba(255,250,220,0.22)";
    ctx.globalAlpha = 1;
    ctx.lineWidth = 1;
  } else {
    ctx.strokeStyle = rv.primary;
    ctx.globalAlpha = 0.42;
    ctx.lineWidth = 1.15;
  }
  ctx.stroke();
  ctx.globalAlpha = 1;

  ctx.beginPath();
  pathRoundRect(ctx, 1.25, 1.25, width - 2.5, h - 2.5, Math.max(1, outerR - 1));
  ctx.strokeStyle = "rgba(255,255,255,0.06)";
  ctx.lineWidth = 0.75;
  ctx.stroke();

  paintRarityOrnament(ctx, width, h, outerR, rv, rarityTier(raritySlug));
}

export function paintThemedArtBezel(
  ctx: CanvasRenderingContext2D,
  pad: number,
  artTop: number,
  artW: number,
  artH: number,
  layout: CardLayoutJson,
  theme: TcgTheme,
  innerR: number,
): void {
  const accent = parseHex(layout.accentColor, "#8b7355");
  ctx.save();
  ctx.beginPath();
  pathRoundRect(ctx, pad, artTop, artW, artH, innerR);
  ctx.clip();
  const winHi = ctx.createLinearGradient(pad, artTop, pad, artTop + artH * 0.18);
  winHi.addColorStop(0, "rgba(255,255,255,0.055)");
  winHi.addColorStop(0.55, "rgba(255,255,255,0.012)");
  winHi.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = winHi;
  ctx.fillRect(pad, artTop, artW, artH * 0.2);
  ctx.restore();

  ctx.beginPath();
  pathRoundRect(ctx, pad + 0.5, artTop + 0.5, artW - 1, artH - 1, innerR);
  if (theme === "planeswalker") {
    ctx.strokeStyle = accent;
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = 1.65;
  } else if (theme === "boudoir") {
    ctx.strokeStyle = "rgba(222,160,188,0.5)";
    ctx.globalAlpha = 1;
    ctx.lineWidth = 1.45;
  } else if (theme === "floral") {
    ctx.strokeStyle = "rgba(228,168,196,0.52)";
    ctx.globalAlpha = 1;
    ctx.lineWidth = 1.5;
  } else if (theme === "celestial") {
    ctx.strokeStyle = "rgba(160,200,255,0.5)";
    ctx.globalAlpha = 1;
    ctx.lineWidth = 1.45;
  } else if (theme === "autumn") {
    ctx.strokeStyle = "rgba(220,150,70,0.48)";
    ctx.globalAlpha = 1;
    ctx.lineWidth = 1.45;
  } else if (theme === "tide") {
    ctx.strokeStyle = "rgba(100,200,215,0.5)";
    ctx.globalAlpha = 1;
    ctx.lineWidth = 1.35;
  } else if (theme === "celestial_clock") {
    ctx.strokeStyle = "rgba(200,175,120,0.48)";
    ctx.globalAlpha = 1;
    ctx.lineWidth = 1.35;
  } else if (theme === "neon_city") {
    ctx.strokeStyle = "rgba(90,210,200,0.48)";
    ctx.globalAlpha = 1;
    ctx.lineWidth = 1.25;
  } else if (theme === "monoline_ink") {
    ctx.strokeStyle = "rgba(215,205,195,0.48)";
    ctx.globalAlpha = 1;
    ctx.lineWidth = 1.2;
  } else if (theme === "trainer") {
    ctx.strokeStyle = "rgba(255,255,255,0.5)";
    ctx.globalAlpha = 0.95;
    ctx.lineWidth = 2;
  } else if (theme === "duelist") {
    ctx.strokeStyle = "rgba(185,165,230,0.5)";
    ctx.globalAlpha = 1;
    ctx.lineWidth = 1.2;
  } else {
    ctx.strokeStyle = "rgba(255,255,255,0.16)";
    ctx.globalAlpha = 1;
    ctx.lineWidth = 1.1;
  }
  ctx.stroke();
  ctx.globalAlpha = 1;

  ctx.beginPath();
  pathRoundRect(ctx, pad + 1.5, artTop + 1.5, artW - 3, artH - 3, Math.max(1, innerR - 1));
  ctx.strokeStyle = "rgba(255,255,255,0.1)";
  ctx.lineWidth = 0.85;
  ctx.stroke();

  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.45)";
  ctx.shadowBlur = 6;
  ctx.shadowOffsetY = 2;
  ctx.beginPath();
  pathRoundRect(ctx, pad + 0.5, artTop + 0.5, artW - 1, artH - 1, innerR);
  ctx.strokeStyle = "rgba(0,0,0,0.4)";
  ctx.lineWidth = 1.25;
  ctx.stroke();
  ctx.restore();

  if (
    theme === "planeswalker" ||
    theme === "boudoir" ||
    theme === "floral" ||
    theme === "celestial" ||
    theme === "autumn" ||
    theme === "tide" ||
    theme === "celestial_clock" ||
    theme === "neon_city" ||
    theme === "monoline_ink"
  ) {
    ctx.beginPath();
    pathRoundRect(ctx, pad + 2.5, artTop + 2.5, artW - 5, artH - 5, Math.max(2, innerR - 2));
    ctx.strokeStyle =
      theme === "boudoir"
        ? "rgba(28,12,20,0.44)"
        : theme === "floral"
        ? "rgba(32,18,26,0.42)"
        : theme === "celestial"
          ? "rgba(20,35,55,0.4)"
          : theme === "autumn"
            ? "rgba(40,20,10,0.42)"
            : theme === "tide"
              ? "rgba(10,40,48,0.42)"
              : theme === "celestial_clock"
                ? "rgba(30,22,18,0.4)"
                : theme === "neon_city"
                  ? "rgba(8,28,32,0.42)"
                  : theme === "monoline_ink"
                    ? "rgba(24,20,16,0.38)"
                    : "rgba(0,0,0,0.38)";
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

export function formatCostStat(theme: TcgTheme, cost: number): string {
  if (theme === "duelist") return `★${cost}`;
  return `C${cost}`;
}

export function formatPowerStat(theme: TcgTheme, power: number): string {
  if (theme === "duelist") return `ATK ${power}`;
  return `P${power}`;
}

export function formatDefenseStat(theme: TcgTheme, defense: number): string {
  if (theme === "duelist") return `DEF ${defense}`;
  return `D${defense}`;
}

export function formatHealthStat(theme: TcgTheme, health: number): string {
  if (theme === "duelist") return `LP ${health}`;
  return `HP${health}`;
}

/** Trainer theme: big HP lives in the name row; omit from stat grid. */
export function showHpInNameRow(theme: TcgTheme): boolean {
  return theme === "trainer";
}

export function nameplateStyle(
  theme: TcgTheme,
): { showBar: boolean; barColor: string } {
  return THEME_DESCRIPTORS[theme].nameplate;
}

export function applyTypeLineFont(
  ctx: CanvasRenderingContext2D,
  theme: TcgTheme,
  size: number,
): void {
  if (THEME_DESCRIPTORS[theme].typeLineSansItalic) {
    ctx.font = canvasFontSansItalic(600, size);
  } else {
    ctx.font = canvasFontSerifItalic(500, size);
  }
}

export function abilityPanelStyle(theme: TcgTheme): {
  fill: string;
  fillTop: string;
  fillBottom: string;
  stroke: string;
  innerHighlight: string;
} {
  return THEME_DESCRIPTORS[theme].abilityPanel;
}

export function abilityTextColor(theme: TcgTheme): string {
  if (theme === "trainer") return "rgba(15,23,42,0.95)";
  return "rgba(248,250,252,0.94)";
}

/** Draw trainer-style HP badge in name row; returns width used (for layout). */
export function trainerHpBadgeWidth(
  ctx: CanvasRenderingContext2D,
  hp: number,
  fontSize: number,
): number {
  ctx.save();
  ctx.font = canvasFontSans(800, fontSize + 3);
  const tw = ctx.measureText(`HP ${hp}`).width;
  ctx.restore();
  return Math.ceil(tw + 16) + 8;
}

export function drawTrainerHpBadge(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  hp: number,
  fontSize: number,
): number {
  const label = `HP ${hp}`;
  ctx.save();
  ctx.font = canvasFontSans(800, fontSize + 3);
  const tw = ctx.measureText(label).width;
  const pw = Math.ceil(tw + 16);
  const ph = fontSize + 14;
  ctx.beginPath();
  pathRoundRect(ctx, x, y, pw, ph, 8);
  const g = ctx.createLinearGradient(x, y, x + pw, y + ph);
  g.addColorStop(0, "#facc15");
  g.addColorStop(1, "#ca8a04");
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = "rgba(120,90,0,0.5)";
  ctx.lineWidth = 1.25;
  ctx.stroke();
  ctx.beginPath();
  pathRoundRect(ctx, x + 0.75, y + 0.75, pw - 1.5, ph - 1.5, 7);
  ctx.strokeStyle = "rgba(255,255,255,0.22)";
  ctx.lineWidth = 0.65;
  ctx.stroke();
  ctx.fillStyle = "#1c1508";
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";
  ctx.fillText(label, x + pw / 2, y + ph / 2);
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.restore();
  return pw + 8;
}

export function drawNameplateBar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  theme: TcgTheme,
): void {
  const { showBar, barColor } = nameplateStyle(theme);
  if (!showBar) return;
  const r =
    theme === "duelist"
      ? 4
      : theme === "floral" || theme === "autumn" || theme === "boudoir"
        ? 8
        : theme === "tide"
          ? 6
          : theme === "neon_city"
            ? 5
            : theme === "celestial_clock"
              ? 6
              : theme === "monoline_ink"
                ? 9
                : 7;
  ctx.save();
  ctx.beginPath();
  pathRoundRect(ctx, x, y, w, h, r);
  const g = ctx.createLinearGradient(x, y, x, y + h);
  g.addColorStop(0, "rgba(255,255,255,0.14)");
  g.addColorStop(0.35, barColor);
  g.addColorStop(1, "rgba(0,0,0,0.4)");
  ctx.fillStyle = g;
  ctx.fill();
  ctx.beginPath();
  pathRoundRect(ctx, x + 0.5, y + 0.5, w - 1, h - 1, Math.max(1, r - 0.5));
  if (theme === "planeswalker") {
    ctx.strokeStyle = "rgba(196,165,116,0.4)";
    ctx.lineWidth = 1;
    ctx.stroke();
  } else if (theme === "trainer") {
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.lineWidth = 0.75;
    ctx.stroke();
  } else if (theme === "duelist") {
    ctx.strokeStyle = "rgba(160,140,200,0.35)";
    ctx.lineWidth = 0.75;
    ctx.stroke();
  } else if (theme === "boudoir") {
    ctx.strokeStyle = "rgba(214,148,176,0.38)";
    ctx.lineWidth = 0.8;
    ctx.stroke();
  } else if (theme === "floral") {
    ctx.strokeStyle = "rgba(210,150,175,0.36)";
    ctx.lineWidth = 0.8;
    ctx.stroke();
  } else if (theme === "celestial") {
    ctx.strokeStyle = "rgba(140,180,240,0.34)";
    ctx.lineWidth = 0.75;
    ctx.stroke();
  } else if (theme === "autumn") {
    ctx.strokeStyle = "rgba(220,140,70,0.34)";
    ctx.lineWidth = 0.8;
    ctx.stroke();
  } else if (theme === "tide") {
    ctx.strokeStyle = "rgba(100,190,210,0.34)";
    ctx.lineWidth = 0.75;
    ctx.stroke();
  } else if (theme === "celestial_clock") {
    ctx.strokeStyle = "rgba(190,160,100,0.32)";
    ctx.lineWidth = 0.75;
    ctx.stroke();
  } else if (theme === "neon_city") {
    ctx.strokeStyle = "rgba(80,200,190,0.3)";
    ctx.lineWidth = 0.7;
    ctx.stroke();
  } else if (theme === "monoline_ink") {
    ctx.strokeStyle = "rgba(200,190,180,0.3)";
    ctx.lineWidth = 0.7;
    ctx.stroke();
  }
  ctx.restore();
}

/** DOM preview: outer shell approximates canvas `paintThemedBackdrop`. */
export function domPreviewShellBackground(layout: CardLayoutJson): string {
  const theme = normalizeTcgTheme(layout.tcgTheme);
  const frame = parseHex(layout.frameColor, "#111015");
  return THEME_DESCRIPTORS[theme].shellGradient(frame);
}

export function domPreviewOuterRingClass(layout: CardLayoutJson): string {
  const theme = normalizeTcgTheme(layout.tcgTheme);
  return THEME_DESCRIPTORS[theme].outerRingClass;
}

/** Layered outer glow for DOM preview (matches canvas rarity tiers). */
export function domPreviewRarityExtraShadow(raritySlug: string): string {
  const tier = rarityTier(raritySlug);
  if (tier < 1) return "";
  const rv = rarityVisual(raritySlug);
  const parts: string[] = [
    `0 0 ${16 + tier * 6}px color-mix(in srgb, ${rv.primary} 52%, transparent)`,
  ];
  if (tier >= 2) {
    parts.push(
      `0 0 ${28 + tier * 8}px color-mix(in srgb, ${rv.primary} 34%, transparent)`,
    );
  }
  if (tier >= 4) {
    parts.push(
      `0 0 ${36 + tier * 7}px color-mix(in srgb, ${rv.highlight} 30%, transparent)`,
    );
  }
  if (tier >= 5 && rv.accent2) {
    parts.push(
      `0 0 ${48 + tier * 5}px color-mix(in srgb, ${rv.accent2} 38%, transparent)`,
    );
  }
  if (tier >= 6) {
    parts.push(
      `0 0 72px color-mix(in srgb, ${rv.highlight} 24%, transparent)`,
    );
  }
  return parts.join(", ");
}

export function domPreviewRoundedClass(layout: CardLayoutJson): string {
  const theme = normalizeTcgTheme(layout.tcgTheme);
  return THEME_DESCRIPTORS[theme].roundedClass;
}

export function domPreviewArtRoundedClass(layout: CardLayoutJson): string {
  const theme = normalizeTcgTheme(layout.tcgTheme);
  return THEME_DESCRIPTORS[theme].artRoundedClass;
}
