import type { CardLayoutJson } from "@/lib/card-layout";
import { type RarityVisual, rarityVisual } from "@/lib/card-visual";
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
    theme === "trainer" ? "rgba(255,236,170,0.62)" : "rgba(255,255,255,0.14)";
  ctx.lineWidth = theme === "trainer" ? 2.25 : 1.25;
  ctx.stroke();

  ctx.beginPath();
  pathRoundRect(ctx, 2.5, 2.5, width - 5, h - 5, Math.max(2, outerR - 2));
  if (theme === "planeswalker") {
    ctx.strokeStyle = accent;
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 1.35;
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

  if (theme === "planeswalker") {
    ctx.beginPath();
    pathRoundRect(ctx, pad + 2.5, artTop + 2.5, artW - 5, artH - 5, Math.max(2, innerR - 2));
    ctx.strokeStyle = "rgba(0,0,0,0.38)";
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
  if (theme === "planeswalker") {
    return { showBar: true, barColor: "rgba(0,0,0,0.45)" };
  }
  if (theme === "trainer") {
    return { showBar: true, barColor: "rgba(30,55,90,0.55)" };
  }
  if (theme === "duelist") {
    return { showBar: true, barColor: "rgba(20,10,35,0.5)" };
  }
  return { showBar: false, barColor: "transparent" };
}

export function applyTypeLineFont(
  ctx: CanvasRenderingContext2D,
  theme: TcgTheme,
  size: number,
): void {
  if (theme === "trainer") {
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
  switch (theme) {
    case "planeswalker":
      return {
        fill: "rgba(12,9,7,0.88)",
        fillTop: "rgba(42,32,24,0.55)",
        fillBottom: "rgba(4,3,2,0.92)",
        stroke: "rgba(200,170,120,0.38)",
        innerHighlight: "rgba(255,220,170,0.12)",
      };
    case "trainer":
      return {
        fill: "rgba(252,252,253,0.97)",
        fillTop: "rgba(255,255,255,0.99)",
        fillBottom: "rgba(226,232,240,0.88)",
        stroke: "rgba(51,65,107,0.32)",
        innerHighlight: "rgba(255,255,255,0.85)",
      };
    case "duelist":
      return {
        fill: "rgba(8,4,18,0.94)",
        fillTop: "rgba(36,22,58,0.65)",
        fillBottom: "rgba(3,1,8,0.96)",
        stroke: "rgba(175,155,220,0.42)",
        innerHighlight: "rgba(200,180,255,0.1)",
      };
    default:
      return {
        fill: "rgba(6,8,12,0.72)",
        fillTop: "rgba(28,32,42,0.55)",
        fillBottom: "rgba(2,3,6,0.88)",
        stroke: "rgba(255,255,255,0.16)",
        innerHighlight: "rgba(255,255,255,0.08)",
      };
  }
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
  const r = theme === "duelist" ? 4 : 7;
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
  }
  ctx.restore();
}

/** DOM preview: outer shell approximates canvas `paintThemedBackdrop`. */
export function domPreviewShellBackground(layout: CardLayoutJson): string {
  const theme = normalizeTcgTheme(layout.tcgTheme);
  const frame = parseHex(layout.frameColor, "#111015");
  switch (theme) {
    case "trainer":
      return `linear-gradient(168deg, #5c4d28 0%, #9a8230 22%, ${frame} 42%, #121008 78%, #0a0805 100%)`;
    case "duelist":
      return `linear-gradient(168deg, #564070 0%, ${frame} 38%, #0a0614 72%, #030208 100%)`;
    case "planeswalker":
      return `linear-gradient(158deg, #18120e 0%, ${frame} 48%, #060403 100%)`;
    default:
      return `linear-gradient(168deg, #1a1d24 0%, ${frame} 38%, #0e0d0c 72%, #050506 100%)`;
  }
}

export function domPreviewOuterRingClass(layout: CardLayoutJson): string {
  const theme = normalizeTcgTheme(layout.tcgTheme);
  if (theme === "trainer") return "ring-2 ring-amber-200/45";
  if (theme === "duelist") return "ring-1 ring-violet-300/40";
  if (theme === "planeswalker") return "ring-1 ring-amber-200/30";
  return "ring-1 ring-white/10";
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
  if (theme === "trainer") return "rounded-2xl";
  if (theme === "duelist") return "rounded-md";
  return "rounded-xl";
}

export function domPreviewArtRoundedClass(layout: CardLayoutJson): string {
  const theme = normalizeTcgTheme(layout.tcgTheme);
  if (theme === "trainer") return "rounded-xl";
  if (theme === "duelist") return "rounded";
  if (theme === "planeswalker") return "rounded-md";
  return "rounded-lg";
}
