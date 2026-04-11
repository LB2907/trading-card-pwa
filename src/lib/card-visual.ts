/** Shared palette + glow tints for frames and UI. */
export type RarityVisual = {
  primary: string;
  soft: string;
  highlight: string;
  /** Secondary accent for dual-tone borders (higher rarities). */
  accent2?: string;
};

export function rarityVisual(rarity: string): RarityVisual {
  const r = rarity.toLowerCase();

  switch (r) {
    case "mythic":
      return {
        primary: "#f5d998",
        soft: "rgba(245,217,152,0.22)",
        highlight: "rgba(255,248,220,0.45)",
        accent2: "#ff6b9d",
      };
    case "legendary":
      return {
        primary: "#e8b84a",
        soft: "rgba(232,184,74,0.2)",
        highlight: "rgba(255,230,150,0.35)",
        accent2: "#a78bfa",
      };
    case "ultra_rare":
      return {
        primary: "#f472b6",
        soft: "rgba(244,114,182,0.18)",
        highlight: "rgba(251,207,232,0.4)",
        accent2: "#38bdf8",
      };
    case "super_rare":
      return {
        primary: "#22d3ee",
        soft: "rgba(34,211,238,0.16)",
        highlight: "rgba(165,243,252,0.35)",
        accent2: "#a78bfa",
      };
    case "rare":
      return {
        primary: "#9b8ed9",
        soft: "rgba(155,142,217,0.14)",
        highlight: "rgba(200,192,240,0.28)",
        accent2: "#7dd3fc",
      };
    case "uncommon":
      return {
        primary: "#5cad9d",
        soft: "rgba(92,173,157,0.12)",
        highlight: "rgba(167,220,210,0.22)",
      };
    case "common":
    default:
      return {
        primary: "#6b7280",
        soft: "rgba(107,114,128,0.1)",
        highlight: "rgba(156,163,175,0.16)",
      };
  }
}
