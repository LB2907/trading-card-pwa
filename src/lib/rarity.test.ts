import { describe, expect, it } from "vitest";
import { rarityTier } from "@/lib/rarity";

describe("rarityTier", () => {
  it("orders known rarities ascending by tier index", () => {
    expect(rarityTier("common")).toBe(0);
    expect(rarityTier("MYTHIC")).toBeGreaterThan(rarityTier("rare"));
  });

  it("returns -1 for unknown slugs", () => {
    expect(rarityTier("")).toBe(-1);
    expect(rarityTier("custom_xyz")).toBe(-1);
  });
});
