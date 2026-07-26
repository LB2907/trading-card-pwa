import { describe, expect, it } from "vitest";
import {
  evenDimension,
  hasVideoEncoder,
  pickGifVideoCodec,
} from "@/lib/export/gif-video-codec";

describe("evenDimension", () => {
  it("leaves even values alone", () => {
    expect(evenDimension(1260)).toBe(1260);
    expect(evenDimension(1764)).toBe(1764);
  });

  it("rounds odd values down, since H.264 rejects odd dimensions", () => {
    expect(evenDimension(1261)).toBe(1260);
    expect(evenDimension(841)).toBe(840);
  });

  it("rounds fractional values before making them even", () => {
    expect(evenDimension(839.6) % 2).toBe(0);
    expect(evenDimension(1259.4) % 2).toBe(0);
  });

  it("never returns something an encoder would reject", () => {
    for (const v of [-10, 0, 1, 2, 3, NaN]) {
      const out = evenDimension(v);
      expect(out % 2, `input ${v}`).toBe(0);
      expect(out).toBeGreaterThanOrEqual(2);
    }
  });
});

describe("hasVideoEncoder", () => {
  it("reports absence rather than throwing where WebCodecs is missing", () => {
    // vitest runs in node, which has no VideoEncoder.
    expect(hasVideoEncoder()).toBe(false);
  });
});

describe("pickGifVideoCodec", () => {
  it("resolves to null rather than throwing when WebCodecs is unavailable", async () => {
    await expect(
      pickGifVideoCodec({
        width: 1260,
        height: 1764,
        framerate: 30,
        bitrate: 8_000_000,
      }),
    ).resolves.toBeNull();
  });
});
