import { THEME_DESCRIPTORS } from "@/lib/compositor/theme-descriptors";

export type TcgTheme =
  | "skirmish"
  | "planeswalker"
  | "trainer"
  | "duelist"
  | "floral"
  | "celestial"
  | "autumn"
  | "tide"
  | "celestial_clock"
  | "neon_city"
  | "monoline_ink"
  | "boudoir"
  | "gilded"
  | "obsidian";

export function normalizeTcgTheme(raw: unknown): TcgTheme {
  const t = typeof raw === "string" ? raw.toLowerCase() : "";
  if (
    t === "planeswalker" ||
    t === "trainer" ||
    t === "duelist" ||
    t === "skirmish" ||
    t === "floral" ||
    t === "celestial" ||
    t === "autumn" ||
    t === "tide" ||
    t === "celestial_clock" ||
    t === "neon_city" ||
    t === "monoline_ink" ||
    t === "boudoir" ||
    t === "gilded" ||
    t === "obsidian"
  ) {
    return t;
  }
  return "skirmish";
}

export function outerRadiusForTheme(theme: TcgTheme): number {
  return THEME_DESCRIPTORS[theme].outerRadius;
}

export function artInnerRadiusForTheme(theme: TcgTheme): number {
  return THEME_DESCRIPTORS[theme].artInnerRadius;
}
