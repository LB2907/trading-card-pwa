import { describe, expect, it } from "vitest";
import {
  CARD_LAYOUT_WIDTH,
  DEFAULT_EXPORT_RESOLUTION,
  EXPORT_RESOLUTIONS,
  type ExportResolution,
} from "@/lib/compositor/card-resolution";

describe("export resolution presets", () => {
  it("has ascending ratios web < high < ultra", () => {
    expect(EXPORT_RESOLUTIONS.web.ratio).toBeLessThan(
      EXPORT_RESOLUTIONS.high.ratio,
    );
    expect(EXPORT_RESOLUTIONS.high.ratio).toBeLessThan(
      EXPORT_RESOLUTIONS.ultra.ratio,
    );
  });

  it("derives width from the layout width and ratio", () => {
    (Object.keys(EXPORT_RESOLUTIONS) as ExportResolution[]).forEach((k) => {
      const p = EXPORT_RESOLUTIONS[k];
      expect(p.width).toBe(CARD_LAYOUT_WIDTH * p.ratio);
    });
  });

  it("keeps the 2.5:3.5 card aspect ratio", () => {
    (Object.keys(EXPORT_RESOLUTIONS) as ExportResolution[]).forEach((k) => {
      const p = EXPORT_RESOLUTIONS[k];
      expect(p.height / p.width).toBeCloseTo(3.5 / 2.5, 2);
    });
  });

  it("defaults to the current high preset", () => {
    expect(DEFAULT_EXPORT_RESOLUTION).toBe("high");
    expect(EXPORT_RESOLUTIONS[DEFAULT_EXPORT_RESOLUTION].ratio).toBe(4);
  });
});
