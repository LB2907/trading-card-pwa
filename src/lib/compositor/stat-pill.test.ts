import { describe, expect, it } from "vitest";
import { statPillHeight } from "@/lib/compositor/layout-metrics";

describe("statPillHeight", () => {
  it("gives a 14px stat label a 21px capsule", () => {
    expect(statPillHeight(14)).toBe(21);
  });

  it("is slimmer than the old fontSize + 11 capsule", () => {
    expect(statPillHeight(14)).toBeLessThan(14 + 11);
  });

  it("keeps padding proportionate rather than swallowing the glyph", () => {
    const fs = 14;
    expect((statPillHeight(fs) - fs) / fs).toBeLessThan(0.6);
    expect(statPillHeight(fs) - fs).toBeGreaterThanOrEqual(6);
  });

  it("scales with the font size", () => {
    expect(statPillHeight(20)).toBeGreaterThan(statPillHeight(14));
  });

  it("stays positive for a degenerate font size", () => {
    expect(statPillHeight(0)).toBeGreaterThan(0);
  });
});
