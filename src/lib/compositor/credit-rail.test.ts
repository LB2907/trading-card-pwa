import { createCanvas } from "@napi-rs/canvas";
import { describe, expect, it } from "vitest";
import {
  CARD_BOTTOM_MARGIN,
  CREDIT_RAIL_TRACKING,
  bottomMarginForCredit,
  creditRailMetrics,
  fitCreditText,
  hasCreditRail,
  trackedTextWidth,
} from "@/lib/compositor/credit-rail";

function ctx2d(): CanvasRenderingContext2D {
  const c = createCanvas(420, 588);
  const ctx = c.getContext("2d") as unknown as CanvasRenderingContext2D;
  ctx.font = "9px sans-serif";
  return ctx;
}

describe("hasCreditRail", () => {
  it("is off for empty text", () => {
    expect(hasCreditRail("")).toBe(false);
  });

  it("is off for whitespace only", () => {
    expect(hasCreditRail("   \n ")).toBe(false);
  });

  it("is on once there is real text", () => {
    expect(hasCreditRail("Requested by: Jane")).toBe(true);
  });
});

describe("creditRailMetrics", () => {
  it("stays a thin band at the 420 px design width", () => {
    const m = creditRailMetrics(420);
    // Small: no more than ~4% of the 588 px card height.
    expect(m.height).toBeLessThanOrEqual(24);
    expect(m.height).toBeGreaterThanOrEqual(10);
  });

  it("keeps the label legible but subordinate to the flavor line", () => {
    const m = creditRailMetrics(420);
    expect(m.fontSize).toBeGreaterThanOrEqual(7);
    expect(m.fontSize).toBeLessThanOrEqual(11);
  });

  it("scales proportionally with card width", () => {
    const small = creditRailMetrics(420);
    const big = creditRailMetrics(840);
    expect(big.height).toBeCloseTo(small.height * 2, 0);
    expect(big.fontSize).toBeCloseTo(small.fontSize * 2, 0);
  });
});

describe("bottomMarginForCredit", () => {
  it("leaves the existing bottom margin alone when there is no credit", () => {
    expect(bottomMarginForCredit(420, "")).toBe(CARD_BOTTOM_MARGIN);
    expect(bottomMarginForCredit(420, undefined)).toBe(CARD_BOTTOM_MARGIN);
  });

  it("reserves the rail's height so body text cannot run into it", () => {
    const rail = creditRailMetrics(420);
    expect(bottomMarginForCredit(420, "Requested by: Jane")).toBe(
      CARD_BOTTOM_MARGIN + rail.height,
    );
  });
});

describe("trackedTextWidth", () => {
  it("matches plain measurement when tracking is zero", () => {
    const ctx = ctx2d();
    expect(trackedTextWidth(ctx, "Requested by", 0)).toBeCloseTo(
      ctx.measureText("Requested by").width,
      1,
    );
  });

  it("grows by one tracking step per gap between characters", () => {
    const ctx = ctx2d();
    const text = "abcd";
    const plain = trackedTextWidth(ctx, text, 0);
    expect(trackedTextWidth(ctx, text, 2)).toBeCloseTo(plain + 2 * 3, 1);
  });

  it("is zero for empty text", () => {
    expect(trackedTextWidth(ctx2d(), "", CREDIT_RAIL_TRACKING)).toBe(0);
  });
});

describe("fitCreditText", () => {
  it("returns short text unchanged", () => {
    const ctx = ctx2d();
    expect(fitCreditText(ctx, "Requested by: Jane", 400, CREDIT_RAIL_TRACKING)).toBe(
      "Requested by: Jane",
    );
  });

  it("ellipsizes text that overruns the rail", () => {
    const ctx = ctx2d();
    const long = "Requested by: " + "Wilhelmina Featherstonehaugh ".repeat(6);
    const out = fitCreditText(ctx, long, 300, CREDIT_RAIL_TRACKING);
    expect(out.endsWith("…")).toBe(true);
    expect(out.length).toBeLessThan(long.length);
    expect(trackedTextWidth(ctx, out, CREDIT_RAIL_TRACKING)).toBeLessThanOrEqual(300);
  });

  it("trims surrounding whitespace", () => {
    expect(fitCreditText(ctx2d(), "  Requested by: Jane  ", 400, 0)).toBe(
      "Requested by: Jane",
    );
  });

  it("survives an unusably narrow rail without looping forever", () => {
    const out = fitCreditText(ctx2d(), "Requested by: Jane", 2, CREDIT_RAIL_TRACKING);
    expect(out.length).toBeLessThanOrEqual(2);
  });
});
