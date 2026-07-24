import type { TcgTheme } from "@/lib/tcg-theme-base";

/**
 * Single source of truth for per-theme values that were previously spread
 * across ~7 switch/if-chains. `Record<TcgTheme, …>` makes the compiler enforce
 * that every theme defines every field — a missing theme is a build error, not
 * a silent fallback to the default frame.
 *
 * Not yet consolidated (deeply inlined ternary chains in the canvas hot path):
 * `paintThemedOuterBorder` / `paintThemedArtBezel` stroke colors, the name-fill
 * and type-line color chains in `draw-card.ts`, and `abilityPanelStyle`. Those
 * are the next consolidation pass.
 */
export type ThemeDescriptor = {
  /** Outer frame corner radius (canvas px at design width). */
  outerRadius: number;
  /** Inner art-window corner radius. */
  artInnerRadius: number;
  /** Nameplate bar behind the card name. */
  nameplate: { showBar: boolean; barColor: string };
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

export const THEME_DESCRIPTORS: Record<TcgTheme, ThemeDescriptor> = {
  skirmish: {
    outerRadius: 14,
    artInnerRadius: 9,
    nameplate: NO_BAR,
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
    shellGradient: (frame) =>
      `linear-gradient(160deg, #191a1e 0%, ${frame} 40%, #0a0b0d 74%, #050506 100%)`,
    outerRingClass: "ring-1 ring-slate-200/22",
    roundedClass: "rounded-xl",
    artRoundedClass: "rounded-lg",
  },
};
