import { describe, expect, it } from "vitest";
import {
  GIF_PLATFORM_LIMITS,
  evaluateGifPlatformFit,
  evaluateGifPlatformFits,
  formatFileSize,
} from "@/lib/export/gif-platform-limits";

const MB = 1_000_000;
const x = GIF_PLATFORM_LIMITS.find((l) => l.id === "x")!;
const discord = GIF_PLATFORM_LIMITS.find((l) => l.id === "discord")!;

describe("evaluateGifPlatformFit", () => {
  it("treats the strictest tier as the safe-anywhere ceiling for X", () => {
    expect(evaluateGifPlatformFit(4.9 * MB, x).level).toBe("fits");
    expect(evaluateGifPlatformFit(5 * MB, x).level).toBe("fits");
    expect(evaluateGifPlatformFit(5 * MB + 1, x).level).toBe("partial");
  });

  it("names the tier a partial fit lands in", () => {
    const r = evaluateGifPlatformFit(12 * MB, x);
    expect(r.level).toBe("partial");
    expect(r.tierLabel).toBe("desktop web");
  });

  it("reports over past the highest tier", () => {
    const r = evaluateGifPlatformFit(15 * MB + 1, x);
    expect(r.level).toBe("over");
    expect(r.tierLabel).toBeNull();
    expect(r.bytesOver).toBe(1);
  });

  it("walks Discord's three tiers", () => {
    expect(evaluateGifPlatformFit(10 * MB, discord).level).toBe("fits");
    expect(evaluateGifPlatformFit(10 * MB + 1, discord)).toMatchObject({
      level: "partial",
      tierLabel: "Nitro Basic / Boost L2",
    });
    expect(evaluateGifPlatformFit(50 * MB + 1, discord)).toMatchObject({
      level: "partial",
      tierLabel: "Nitro",
    });
    expect(evaluateGifPlatformFit(500 * MB + 1, discord).level).toBe("over");
  });

  it("reports the shortfall to safe-anywhere, not to the tier it scraped into", () => {
    // 12 MB fits X desktop, but the actionable number is what it takes to also
    // clear the 5 MB mobile ceiling.
    expect(evaluateGifPlatformFit(12 * MB, x).bytesOver).toBe(7 * MB);
  });

  it("reports zero shortfall once it fits everywhere", () => {
    expect(evaluateGifPlatformFit(1 * MB, x).bytesOver).toBe(0);
    expect(evaluateGifPlatformFit(1 * MB, discord).bytesOver).toBe(0);
  });

  it("carries the X transcode caveat", () => {
    expect(evaluateGifPlatformFit(1 * MB, x).note).toMatch(/MP4/);
    expect(evaluateGifPlatformFit(1 * MB, discord).note).toBeUndefined();
  });
});

describe("evaluateGifPlatformFits", () => {
  it("covers every configured platform", () => {
    const fits = evaluateGifPlatformFits(6 * MB);
    expect(fits.map((f) => f.id)).toEqual(["x", "discord"]);
    // 6 MB clears Discord free but not X mobile — exactly the case a single
    // boolean badge would get wrong.
    expect(fits[0].level).toBe("partial");
    expect(fits[1].level).toBe("fits");
  });
});

describe("GIF_PLATFORM_LIMITS", () => {
  it("keeps every platform's tiers ascending", () => {
    for (const limit of GIF_PLATFORM_LIMITS) {
      const maxes = limit.tiers.map((t) => t.maxBytes);
      expect(maxes).toEqual([...maxes].sort((a, b) => a - b));
      expect(limit.tiers.length).toBeGreaterThan(0);
    }
  });
});

describe("formatFileSize", () => {
  it("formats across the range", () => {
    expect(formatFileSize(0)).toBe("0 B");
    expect(formatFileSize(820)).toBe("820 B");
    expect(formatFileSize(820_000)).toBe("820 KB");
    expect(formatFileSize(4_700_000)).toBe("4.7 MB");
    expect(formatFileSize(24_000_000)).toBe("24 MB");
  });

  it("degrades rather than printing NaN", () => {
    expect(formatFileSize(Number.NaN)).toBe("—");
    expect(formatFileSize(-1)).toBe("—");
  });
});
