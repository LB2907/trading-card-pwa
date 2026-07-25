import { describe, expect, it } from "vitest";
import { abilityTextMaxWidth } from "@/lib/compositor/layout-metrics";

const W = 420;
const PAD = 14;
const INSET_X = PAD + 12; // textInsetX for themes that draw a nameplate bar

describe("abilityTextMaxWidth", () => {
  it("insets the text from the panel's right border, not just its left", () => {
    const maxW = abilityTextMaxWidth(W, PAD, INSET_X);
    const panelRight = W - PAD;
    const textRight = INSET_X + maxW;
    expect(panelRight - textRight).toBeGreaterThan(0);
  });

  it("pads the right the same as the left, so the panel reads centred", () => {
    const maxW = abilityTextMaxWidth(W, PAD, INSET_X);
    const leftInset = INSET_X - PAD;
    const rightInset = W - PAD - (INSET_X + maxW);
    expect(rightInset).toBeCloseTo(leftInset, 5);
  });

  it("is narrower than the old full-bleed width that caused the overflow", () => {
    // Previously: width - textInsetX - pad, which ran text to the panel edge.
    expect(abilityTextMaxWidth(W, PAD, INSET_X)).toBeLessThan(W - INSET_X - PAD);
  });

  it("never returns a negative width on an absurdly narrow card", () => {
    expect(abilityTextMaxWidth(40, 14, 26)).toBeGreaterThanOrEqual(0);
  });

  it("scales with the card width", () => {
    expect(abilityTextMaxWidth(840, PAD, INSET_X)).toBeGreaterThan(
      abilityTextMaxWidth(420, PAD, INSET_X),
    );
  });
});
