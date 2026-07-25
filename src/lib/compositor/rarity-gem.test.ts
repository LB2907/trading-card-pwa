import { describe, expect, it } from "vitest";
import {
  GEM_BAR_CLEARANCE,
  barEdgeXAt,
  gemGradientStops,
  rarityGemPlacement,
  shadeHex,
} from "@/lib/compositor/rarity-gem";

const CARD_W = 420;

/** Arena/duelist: the template the alignment bug was spotted on. */
const duelist = {
  cardWidth: CARD_W,
  pad: 14,
  gemSize: 24,
  strokeWidth: 1.25,
  textCenterY: 13,
  bar: { top: -1, height: 32, radius: 4 },
};

/** Boudoir and most others: bigger gem, much rounder bar. */
const boudoir = {
  cardWidth: CARD_W,
  pad: 14,
  gemSize: 26,
  strokeWidth: 1.25,
  textCenterY: 13.5,
  bar: { top: -1, height: 33, radius: 8 },
};

describe("barEdgeXAt", () => {
  it("returns the full width along the bar's straight section", () => {
    expect(barEdgeXAt(15, -1, 32, 4, 406)).toBeCloseTo(406, 5);
  });

  it("pulls in toward the corners", () => {
    expect(barEdgeXAt(-1, -1, 32, 4, 406)).toBeLessThan(406);
    expect(barEdgeXAt(31, -1, 32, 4, 406)).toBeLessThan(406);
  });

  it("is symmetric about the bar's middle", () => {
    const top = barEdgeXAt(0, -1, 32, 4, 406);
    const bottom = barEdgeXAt(30, -1, 32, 4, 406);
    expect(top).toBeCloseTo(bottom, 5);
  });
});

describe("rarityGemPlacement", () => {
  it("centres the gem on the nameplate bar, not on the name text", () => {
    const p = rarityGemPlacement(duelist);
    const barCentre = duelist.bar.top + duelist.bar.height / 2;
    expect(p.centerY).toBeCloseTo(barCentre, 5);
    // The old behaviour centred on the text and sat 2px high.
    expect(p.centerY).not.toBeCloseTo(duelist.textCenterY, 1);
  });

  it("leaves equal breathing room above and below inside the bar", () => {
    const p = rarityGemPlacement(duelist);
    const above = p.centerY - duelist.gemSize / 2 - duelist.bar.top;
    const below =
      duelist.bar.top + duelist.bar.height - (p.centerY + duelist.gemSize / 2);
    expect(above).toBeCloseTo(below, 5);
  });

  for (const [name, input] of [
    ["duelist", duelist],
    ["boudoir", boudoir],
  ] as const) {
    it(`keeps the whole stroked gem inside the bar outline (${name})`, () => {
      const p = rarityGemPlacement(input);
      const R = input.gemSize / 2;
      const half = input.strokeWidth / 2;
      const rightLimit = input.cardWidth - input.pad;
      // Walk the circle: nowhere may its stroked edge cross the bar.
      for (let i = 0; i <= 40; i++) {
        const y = p.centerY - R + (2 * R * i) / 40;
        const circleHalfW = Math.sqrt(Math.max(0, R * R - (y - p.centerY) ** 2));
        const edge = barEdgeXAt(
          y,
          input.bar.top,
          input.bar.height,
          input.bar.radius,
          rightLimit,
        );
        expect(
          p.centerX + circleHalfW + half,
          `gem crowds the bar at y=${y.toFixed(2)}`,
        ).toBeLessThanOrEqual(edge - GEM_BAR_CLEARANCE + 1e-6);
      }
    });
  }

  it("leaves visible daylight between the gem and the bar's inner border", () => {
    expect(GEM_BAR_CLEARANCE).toBeGreaterThan(0);
    const p = rarityGemPlacement(duelist);
    const edgeAtCentre = barEdgeXAt(
      p.centerY,
      duelist.bar.top,
      duelist.bar.height,
      duelist.bar.radius,
      duelist.cardWidth - duelist.pad,
    );
    const gemRight = p.centerX + duelist.gemSize / 2 + duelist.strokeWidth / 2;
    expect(edgeAtCentre - gemRight).toBeGreaterThanOrEqual(GEM_BAR_CLEARANCE);
  });

  it("keeps the stroke inside the content edge when there is no bar", () => {
    const p = rarityGemPlacement({ ...duelist, bar: undefined });
    const right = p.centerX + duelist.gemSize / 2 + duelist.strokeWidth / 2;
    expect(right).toBeLessThanOrEqual(CARD_W - duelist.pad + 1e-6);
  });

  it("falls back to the text centre when there is no bar", () => {
    const p = rarityGemPlacement({ ...duelist, bar: undefined });
    expect(p.centerY).toBeCloseTo(duelist.textCenterY, 5);
  });

  it("reports a left edge consistent with the centre", () => {
    const p = rarityGemPlacement(duelist);
    expect(p.left).toBeCloseTo(p.centerX - duelist.gemSize / 2, 5);
  });

  it("only ever pulls the gem inward, never past the content edge", () => {
    const p = rarityGemPlacement(duelist);
    expect(p.centerX + duelist.gemSize / 2).toBeLessThanOrEqual(
      CARD_W - duelist.pad,
    );
    // ...but not so far that it drifts into the middle of the card.
    expect(p.centerX).toBeGreaterThan(CARD_W - duelist.pad - duelist.gemSize - 6);
  });
});

describe("shadeHex", () => {
  const lum = (hex: string) => {
    const n = parseInt(hex.slice(1), 16);
    return 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
  };

  it("returns an opaque six-digit hex", () => {
    expect(shadeHex("#e8b84a", 0.3)).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("lightens for a positive amount", () => {
    expect(lum(shadeHex("#e8b84a", 0.35))).toBeGreaterThan(lum("#e8b84a"));
  });

  it("darkens for a negative amount", () => {
    expect(lum(shadeHex("#e8b84a", -0.5))).toBeLessThan(lum("#e8b84a"));
  });

  it("clamps rather than wrapping around", () => {
    expect(shadeHex("#ffffff", 0.9)).toBe("#ffffff");
    expect(shadeHex("#000000", -0.9)).toBe("#000000");
  });

  it("falls back to the input when it is not a plain hex", () => {
    expect(shadeHex("rgba(1,2,3,0.5)", 0.3)).toBe("rgba(1,2,3,0.5)");
  });
});

describe("gemGradientStops", () => {
  const lum = (hex: string) => {
    const n = parseInt(hex.slice(1), 16);
    return 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
  };

  it("uses only opaque colours, so the dark card cannot show through as grey", () => {
    const s = gemGradientStops("#e8b84a");
    for (const c of [s.inner, s.mid, s.outer]) {
      expect(c, `${c} is translucent`).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it("keeps the gem's own rarity colour at its middle", () => {
    expect(gemGradientStops("#e8b84a").mid).toBe("#e8b84a");
  });

  it("reads as a lit gem: bright inside, deep at the rim", () => {
    const s = gemGradientStops("#e8b84a");
    expect(lum(s.inner)).toBeGreaterThan(lum(s.mid));
    expect(lum(s.outer)).toBeLessThan(lum(s.mid));
  });

  it("stays tinted by the rarity rather than washing out to white", () => {
    const s = gemGradientStops("#e8b84a");
    const n = parseInt(s.inner.slice(1), 16);
    const [r, b] = [(n >> 16) & 255, n & 255];
    // A white wash would flatten the channels; gold must stay gold.
    expect(r - b).toBeGreaterThan(40);
  });
});
