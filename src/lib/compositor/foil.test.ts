import { describe, expect, it } from "vitest";
import { foilFinishForTier, hasFoil } from "@/lib/compositor/foil";

describe("foilFinishForTier", () => {
  it("gives common and uncommon no finish", () => {
    expect(foilFinishForTier(0).kind).toBe("none");
    expect(foilFinishForTier(1).kind).toBe("none");
    expect(hasFoil(0)).toBe(false);
    expect(hasFoil(1)).toBe(false);
  });

  it("gives rare and super-rare a metallic finish", () => {
    expect(foilFinishForTier(2).kind).toBe("metallic");
    expect(foilFinishForTier(3).kind).toBe("metallic");
    expect(hasFoil(2)).toBe(true);
  });

  it("gives ultra-rare and legendary a holographic finish", () => {
    expect(foilFinishForTier(4).kind).toBe("holographic");
    expect(foilFinishForTier(5).kind).toBe("holographic");
  });

  it("gives mythic a prismatic finish", () => {
    expect(foilFinishForTier(6).kind).toBe("prismatic");
    expect(hasFoil(6)).toBe(true);
  });

  it("intensity rises monotonically with tier", () => {
    const t = [2, 3, 4, 5, 6].map((n) => foilFinishForTier(n).intensity);
    for (let i = 1; i < t.length; i++) {
      expect(t[i]).toBeGreaterThanOrEqual(t[i - 1]);
    }
  });

  it("treats unknown/negative tiers as no finish", () => {
    expect(foilFinishForTier(-1).kind).toBe("none");
  });
});
