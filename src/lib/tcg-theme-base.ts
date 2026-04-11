export type TcgTheme = "skirmish" | "planeswalker" | "trainer" | "duelist";

export function normalizeTcgTheme(raw: unknown): TcgTheme {
  const t = typeof raw === "string" ? raw.toLowerCase() : "";
  if (
    t === "planeswalker" ||
    t === "trainer" ||
    t === "duelist" ||
    t === "skirmish"
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
    default:
      return 9;
  }
}
