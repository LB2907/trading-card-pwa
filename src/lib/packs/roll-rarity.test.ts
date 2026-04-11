import { describe, expect, it } from "vitest";
import { parsePackWeights, rollRarityFromWeights } from "@/lib/packs/roll-rarity";

describe("parsePackWeights", () => {
  it("parses valid JSON object", () => {
    expect(parsePackWeights('{"rare":2,"common":1}')).toEqual({
      rare: 2,
      common: 1,
    });
  });

  it("falls back on invalid JSON", () => {
    expect(parsePackWeights("not-json")).toEqual({ common: 1 });
  });
});

describe("rollRarityFromWeights", () => {
  it("returns the only key when rng is tiny", () => {
    const weights = { only: 1 };
    expect(rollRarityFromWeights(weights, () => 0)).toBe("only");
  });

  it("returns the heavier bucket when rng is high", () => {
    const weights = { light: 1, heavy: 9 };
    expect(rollRarityFromWeights(weights, () => 0.95)).toBe("heavy");
  });

  it("returns common when weight map is empty", () => {
    expect(rollRarityFromWeights({}, () => 0)).toBe("common");
  });
});
