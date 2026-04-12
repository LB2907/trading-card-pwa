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
  | "monoline_ink";

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
    t === "monoline_ink"
  ) {
    return t;
  }
  return "skirmish";
}

export function outerRadiusForTheme(theme: TcgTheme): number {
  switch (theme) {
    case "trainer":
      return 18;
    case "duelist":
      return 5;
    case "planeswalker":
      return 11;
    case "floral":
      return 15;
    case "autumn":
      return 14;
    case "celestial":
      return 14;
    case "tide":
      return 12;
    case "celestial_clock":
      return 12;
    case "neon_city":
      return 9;
    case "monoline_ink":
      return 16;
    default:
      return 14;
  }
}

export function artInnerRadiusForTheme(theme: TcgTheme): number {
  switch (theme) {
    case "duelist":
      return 4;
    case "trainer":
      return 14;
    case "planeswalker":
      return 6;
    case "floral":
      return 10;
    case "autumn":
      return 10;
    case "celestial":
      return 9;
    case "tide":
      return 8;
    case "celestial_clock":
      return 7;
    case "neon_city":
      return 6;
    case "monoline_ink":
      return 11;
    default:
      return 9;
  }
}
