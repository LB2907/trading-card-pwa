import type { TcgTheme } from "@/lib/tcg-theme-base";

/**
 * Single source of truth for per-theme values that were previously spread
 * across many switch/if-chains. `Record<TcgTheme, …>` makes the compiler
 * enforce that every theme defines every field — a missing theme is a build
 * error, not a silent fallback to the default frame.
 *
 * Not yet consolidated (deeply interleaved stroke color/width/alpha in the
 * canvas hot path): `paintThemedOuterBorder` / `paintThemedArtBezel`. Those are
 * the final consolidation pass.
 */
export type AbilityPanelStyle = {
  fill: string;
  fillTop: string;
  fillBottom: string;
  stroke: string;
  innerHighlight: string;
};

export type ThemeDescriptor = {
  /** Outer frame corner radius (canvas px at design width). */
  outerRadius: number;
  /** Inner art-window corner radius. */
  artInnerRadius: number;
  /** Nameplate bar behind the card name. */
  nameplate: { showBar: boolean; barColor: string };
  /** Card-name text fill. */
  nameColor: string;
  /** Card-name drop-shadow blur. */
  nameShadowBlur: number;
  /** Type-line text fill. */
  typeColor: string;
  /** Type line uses italic sans (true) vs italic serif (false). */
  typeLineSansItalic: boolean;
  /** Ability/rules panel gradient + strokes. */
  abilityPanel: AbilityPanelStyle;
  /** DOM preview shell gradient; `frame` is the template's frameColor. */
  shellGradient: (frame: string) => string;
  /** DOM preview outer ring (Tailwind classes). */
  outerRingClass: string;
  /** DOM preview outer corner rounding (Tailwind classes). */
  roundedClass: string;
  /** DOM preview art-window rounding (Tailwind classes). */
  artRoundedClass: string;
};

const NO_BAR = { showBar: false, barColor: "transparent" };

const DEFAULT_NAME_COLOR = "#f8fafc";
const DEFAULT_NAME_SHADOW = 8;
const DEFAULT_TYPE_COLOR = "rgba(248,250,252,0.72)";
const DEFAULT_ABILITY_PANEL: AbilityPanelStyle = {
  fill: "rgba(6,8,12,0.72)",
  fillTop: "rgba(28,32,42,0.55)",
  fillBottom: "rgba(2,3,6,0.88)",
  stroke: "rgba(255,255,255,0.16)",
  innerHighlight: "rgba(255,255,255,0.08)",
};

export const THEME_DESCRIPTORS: Record<TcgTheme, ThemeDescriptor> = {
  skirmish: {
    outerRadius: 14,
    artInnerRadius: 9,
    nameplate: NO_BAR,
    nameColor: DEFAULT_NAME_COLOR,
    nameShadowBlur: DEFAULT_NAME_SHADOW,
    typeColor: DEFAULT_TYPE_COLOR,
    typeLineSansItalic: false,
    abilityPanel: DEFAULT_ABILITY_PANEL,
    shellGradient: (frame) =>
      `linear-gradient(168deg, #1a1d24 0%, ${frame} 38%, #0e0d0c 72%, #050506 100%)`,
    outerRingClass: "ring-1 ring-white/10",
    roundedClass: "rounded-xl",
    artRoundedClass: "rounded-lg",
  },
  planeswalker: {
    outerRadius: 11,
    artInnerRadius: 6,
    nameplate: { showBar: true, barColor: "rgba(0,0,0,0.45)" },
    nameColor: DEFAULT_NAME_COLOR,
    nameShadowBlur: DEFAULT_NAME_SHADOW,
    typeColor: DEFAULT_TYPE_COLOR,
    typeLineSansItalic: false,
    abilityPanel: {
      fill: "rgba(12,9,7,0.88)",
      fillTop: "rgba(42,32,24,0.55)",
      fillBottom: "rgba(4,3,2,0.92)",
      stroke: "rgba(200,170,120,0.38)",
      innerHighlight: "rgba(255,220,170,0.12)",
    },
    shellGradient: (frame) =>
      `linear-gradient(158deg, #18120e 0%, ${frame} 48%, #060403 100%)`,
    outerRingClass: "ring-1 ring-amber-200/30",
    roundedClass: "rounded-xl",
    artRoundedClass: "rounded-md",
  },
  trainer: {
    outerRadius: 18,
    artInnerRadius: 14,
    nameplate: { showBar: true, barColor: "rgba(30,55,90,0.55)" },
    nameColor: DEFAULT_NAME_COLOR,
    nameShadowBlur: DEFAULT_NAME_SHADOW,
    typeColor: "rgba(241,245,249,0.88)",
    typeLineSansItalic: true,
    abilityPanel: {
      fill: "rgba(252,252,253,0.97)",
      fillTop: "rgba(255,255,255,0.99)",
      fillBottom: "rgba(226,232,240,0.88)",
      stroke: "rgba(51,65,107,0.32)",
      innerHighlight: "rgba(255,255,255,0.85)",
    },
    shellGradient: (frame) =>
      `linear-gradient(168deg, #5c4d28 0%, #9a8230 22%, ${frame} 42%, #121008 78%, #0a0805 100%)`,
    outerRingClass: "ring-2 ring-amber-200/45",
    roundedClass: "rounded-2xl",
    artRoundedClass: "rounded-xl",
  },
  duelist: {
    outerRadius: 5,
    artInnerRadius: 4,
    nameplate: { showBar: true, barColor: "rgba(20,10,35,0.5)" },
    nameColor: "#ede9fe",
    nameShadowBlur: 5,
    typeColor: "rgba(221,214,255,0.78)",
    typeLineSansItalic: false,
    abilityPanel: {
      fill: "rgba(8,4,18,0.94)",
      fillTop: "rgba(36,22,58,0.65)",
      fillBottom: "rgba(3,1,8,0.96)",
      stroke: "rgba(175,155,220,0.42)",
      innerHighlight: "rgba(200,180,255,0.1)",
    },
    shellGradient: (frame) =>
      `linear-gradient(168deg, #564070 0%, ${frame} 38%, #0a0614 72%, #030208 100%)`,
    outerRingClass: "ring-1 ring-violet-300/40",
    roundedClass: "rounded-md",
    artRoundedClass: "rounded",
  },
  floral: {
    outerRadius: 15,
    artInnerRadius: 10,
    nameplate: { showBar: true, barColor: "rgba(42,24,34,0.62)" },
    nameColor: "#fce7f0",
    nameShadowBlur: 6,
    typeColor: "rgba(252,231,243,0.86)",
    typeLineSansItalic: false,
    abilityPanel: {
      fill: "rgba(16,8,12,0.9)",
      fillTop: "rgba(52,32,44,0.58)",
      fillBottom: "rgba(6,2,5,0.94)",
      stroke: "rgba(214,165,188,0.38)",
      innerHighlight: "rgba(255,228,240,0.11)",
    },
    shellGradient: (frame) =>
      `linear-gradient(162deg, #1a1016 0%, #26141c 24%, ${frame} 48%, #120a0e 76%, #080406 100%)`,
    outerRingClass: "ring-1 ring-rose-200/35",
    roundedClass: "rounded-2xl",
    artRoundedClass: "rounded-xl",
  },
  celestial: {
    outerRadius: 14,
    artInnerRadius: 9,
    nameplate: { showBar: true, barColor: "rgba(18,28,52,0.62)" },
    nameColor: "#e8f0ff",
    nameShadowBlur: 7,
    typeColor: "rgba(216,228,255,0.84)",
    typeLineSansItalic: false,
    abilityPanel: {
      fill: "rgba(8,12,24,0.9)",
      fillTop: "rgba(28,40,72,0.55)",
      fillBottom: "rgba(4,6,14,0.94)",
      stroke: "rgba(150,190,255,0.35)",
      innerHighlight: "rgba(220,235,255,0.1)",
    },
    shellGradient: (frame) =>
      `linear-gradient(165deg, #0a0e1a 0%, #121a30 32%, ${frame} 52%, #060812 78%, #03050a 100%)`,
    outerRingClass: "ring-1 ring-sky-200/35",
    roundedClass: "rounded-xl",
    artRoundedClass: "rounded-lg",
  },
  autumn: {
    outerRadius: 14,
    artInnerRadius: 10,
    nameplate: { showBar: true, barColor: "rgba(48,26,14,0.62)" },
    nameColor: "#ffe8d4",
    nameShadowBlur: 6,
    typeColor: "rgba(255,224,190,0.86)",
    typeLineSansItalic: false,
    abilityPanel: {
      fill: "rgba(24,12,6,0.9)",
      fillTop: "rgba(72,38,18,0.55)",
      fillBottom: "rgba(12,5,2,0.94)",
      stroke: "rgba(220,150,80,0.36)",
      innerHighlight: "rgba(255,210,160,0.1)",
    },
    shellGradient: (frame) =>
      `linear-gradient(162deg, #1c0e08 0%, #2a140c 26%, ${frame} 50%, #140a06 74%, #080402 100%)`,
    outerRingClass: "ring-1 ring-amber-300/35",
    roundedClass: "rounded-2xl",
    artRoundedClass: "rounded-xl",
  },
  tide: {
    outerRadius: 12,
    artInnerRadius: 8,
    nameplate: { showBar: true, barColor: "rgba(12,36,48,0.62)" },
    nameColor: "#dff8fc",
    nameShadowBlur: 7,
    typeColor: "rgba(200,240,248,0.82)",
    typeLineSansItalic: false,
    abilityPanel: {
      fill: "rgba(6,16,22,0.9)",
      fillTop: "rgba(22,58,72,0.55)",
      fillBottom: "rgba(2,8,12,0.94)",
      stroke: "rgba(100,200,215,0.34)",
      innerHighlight: "rgba(200,245,255,0.1)",
    },
    shellGradient: (frame) =>
      `linear-gradient(168deg, #061218 0%, #0c1c28 34%, ${frame} 55%, #040c12 80%, #020608 100%)`,
    outerRingClass: "ring-1 ring-cyan-200/35",
    roundedClass: "rounded-xl",
    artRoundedClass: "rounded-lg",
  },
  celestial_clock: {
    outerRadius: 12,
    artInnerRadius: 7,
    nameplate: { showBar: true, barColor: "rgba(28,22,38,0.65)" },
    nameColor: "#f5ecd8",
    nameShadowBlur: 6,
    typeColor: "rgba(235,220,195,0.84)",
    typeLineSansItalic: false,
    abilityPanel: {
      fill: "rgba(14,10,18,0.9)",
      fillTop: "rgba(48,38,28,0.52)",
      fillBottom: "rgba(6,4,8,0.94)",
      stroke: "rgba(200,170,110,0.34)",
      innerHighlight: "rgba(255,230,190,0.09)",
    },
    shellGradient: (frame) =>
      `linear-gradient(168deg, #0e0a12 0%, #1a1420 34%, ${frame} 55%, #08060c 78%, #030205 100%)`,
    outerRingClass: "ring-1 ring-amber-200/30",
    roundedClass: "rounded-xl",
    artRoundedClass: "rounded-lg",
  },
  neon_city: {
    outerRadius: 9,
    artInnerRadius: 6,
    nameplate: { showBar: true, barColor: "rgba(8,18,28,0.68)" },
    nameColor: "#ecf8f8",
    nameShadowBlur: 6,
    typeColor: "rgba(210,240,238,0.82)",
    typeLineSansItalic: false,
    abilityPanel: {
      fill: "rgba(6,10,18,0.92)",
      fillTop: "rgba(18,48,52,0.5)",
      fillBottom: "rgba(2,4,10,0.96)",
      stroke: "rgba(78,200,195,0.28)",
      innerHighlight: "rgba(200,245,240,0.07)",
    },
    shellGradient: (frame) =>
      `linear-gradient(168deg, #050810 0%, #0a1420 40%, ${frame} 58%, #040a12 82%, #020308 100%)`,
    outerRingClass: "ring-1 ring-teal-300/28",
    roundedClass: "rounded-lg",
    artRoundedClass: "rounded-md",
  },
  monoline_ink: {
    outerRadius: 16,
    artInnerRadius: 11,
    nameplate: { showBar: true, barColor: "rgba(28,24,20,0.58)" },
    nameColor: "#f2ebe3",
    nameShadowBlur: 6,
    typeColor: "rgba(228,218,208,0.82)",
    typeLineSansItalic: false,
    abilityPanel: {
      fill: "rgba(18,15,12,0.88)",
      fillTop: "rgba(42,36,30,0.48)",
      fillBottom: "rgba(8,6,5,0.92)",
      stroke: "rgba(200,190,180,0.3)",
      innerHighlight: "rgba(235,228,218,0.08)",
    },
    shellGradient: (frame) =>
      `linear-gradient(168deg, #12100e 0%, #1c1814 40%, ${frame} 58%, #0c0a08 80%, #060504 100%)`,
    outerRingClass: "ring-1 ring-stone-300/25",
    roundedClass: "rounded-xl",
    artRoundedClass: "rounded-xl",
  },
  boudoir: {
    outerRadius: 17,
    artInnerRadius: 12,
    nameplate: { showBar: true, barColor: "rgba(43,18,30,0.64)" },
    nameColor: "#fbe3ea",
    nameShadowBlur: 6,
    typeColor: "rgba(250,222,234,0.85)",
    typeLineSansItalic: false,
    abilityPanel: {
      fill: "rgba(14,6,10,0.9)",
      fillTop: "rgba(56,28,42,0.58)",
      fillBottom: "rgba(5,2,4,0.94)",
      stroke: "rgba(216,158,184,0.38)",
      innerHighlight: "rgba(255,222,236,0.11)",
    },
    shellGradient: (frame) =>
      `linear-gradient(164deg, #1c0d16 0%, #2b1620 26%, ${frame} 50%, #140911 76%, #090407 100%)`,
    outerRingClass: "ring-1 ring-rose-200/30",
    roundedClass: "rounded-2xl",
    artRoundedClass: "rounded-xl",
  },
  gilded: {
    outerRadius: 8,
    artInnerRadius: 5,
    nameplate: NO_BAR,
    nameColor: DEFAULT_NAME_COLOR,
    nameShadowBlur: DEFAULT_NAME_SHADOW,
    typeColor: DEFAULT_TYPE_COLOR,
    typeLineSansItalic: false,
    abilityPanel: DEFAULT_ABILITY_PANEL,
    shellGradient: (frame) =>
      `linear-gradient(160deg, #241b0c 0%, ${frame} 40%, #100c05 74%, #070503 100%)`,
    outerRingClass: "ring-1 ring-amber-200/40",
    roundedClass: "rounded-xl",
    artRoundedClass: "rounded-lg",
  },
  obsidian: {
    outerRadius: 6,
    artInnerRadius: 3,
    nameplate: NO_BAR,
    nameColor: DEFAULT_NAME_COLOR,
    nameShadowBlur: DEFAULT_NAME_SHADOW,
    typeColor: DEFAULT_TYPE_COLOR,
    typeLineSansItalic: false,
    abilityPanel: DEFAULT_ABILITY_PANEL,
    shellGradient: (frame) =>
      `linear-gradient(160deg, #191a1e 0%, ${frame} 40%, #0a0b0d 74%, #050506 100%)`,
    outerRingClass: "ring-1 ring-slate-200/22",
    roundedClass: "rounded-xl",
    artRoundedClass: "rounded-lg",
  },
};
