import defaultLayout from "@/lib/default-layout.json";
import { normalizeTcgTheme, type TcgTheme } from "@/lib/tcg-theme-base";

export type { TcgTheme };

export type CardLayoutJson = {
  id: string;
  name: string;
  /** Visual language inspired by major TCGs (drives frame, bezel, type). */
  tcgTheme?: TcgTheme;
  artFlex: number;
  frameColor: string;
  accentColor: string;
  /** Letterbox / mat behind `object-fit: contain` art */
  artMatColor?: string;
  innerPadding: number;
  nameFontSize: number;
  typeFontSize: number;
  bodyFontSize: number;
  flavorFontSize: number;
  statFontSize: number;
  rarityGemSize: number;
};

function toFinite(n: unknown, fallback: number): number {
  const v = typeof n === "number" ? n : Number(n);
  return Number.isFinite(v) ? v : fallback;
}

/** Merge stored JSON with defaults and coerce numeric fields (strings/NaN break canvas math). */
export function parseLayout(json: string): CardLayoutJson {
  let partial: Partial<CardLayoutJson> = {};
  try {
    partial = JSON.parse(json) as Partial<CardLayoutJson>;
  } catch {
    partial = {};
  }
  const m = { ...defaultLayout, ...partial };
  return {
    ...m,
    tcgTheme: normalizeTcgTheme(m.tcgTheme),
    artFlex: toFinite(m.artFlex, defaultLayout.artFlex),
    innerPadding: toFinite(m.innerPadding, defaultLayout.innerPadding),
    nameFontSize: toFinite(m.nameFontSize, defaultLayout.nameFontSize),
    typeFontSize: toFinite(m.typeFontSize, defaultLayout.typeFontSize),
    bodyFontSize: toFinite(m.bodyFontSize, defaultLayout.bodyFontSize),
    flavorFontSize: toFinite(m.flavorFontSize, defaultLayout.flavorFontSize),
    statFontSize: toFinite(m.statFontSize, defaultLayout.statFontSize),
    rarityGemSize: toFinite(m.rarityGemSize, defaultLayout.rarityGemSize),
  };
}
