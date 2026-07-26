import { describe, expect, it } from "vitest";
import { canEncodeVideoCard } from "@/lib/export/card-video-encoder";
import type { CardExportRow } from "@/lib/export/types";
import type { CardInstance } from "@/lib/db/schema";

function row(mediaKind: string, mediaPath: string): CardExportRow {
  const now = new Date();
  const instance = {
    id: "c", setId: "s", templateId: "t", mediaPath, mediaKind,
    name: "Velvet Sovereign", typeLine: "Legendary", rarity: "mythic",
    statPower: 1, statDefense: 1, statCost: 1, statSpeed: 1, statHealth: 1, statMind: 1,
    abilityText: "", flavorText: "", creditText: "", foil: false,
    createdAt: now, updatedAt: now,
  } as unknown as CardInstance;
  return { instance, layoutJson: "{}" } as CardExportRow;
}

describe("canEncodeVideoCard", () => {
  it("rejects cards whose art is not a video", async () => {
    await expect(canEncodeVideoCard(row("gif", "a.gif"))).resolves.toBe(false);
    await expect(canEncodeVideoCard(row("image", "a.png"))).resolves.toBe(false);
  });

  it("reports unavailable rather than throwing where WebCodecs is missing", async () => {
    // vitest runs in node, which has no VideoEncoder.
    await expect(canEncodeVideoCard(row("video", "a.mp4"))).resolves.toBe(false);
  });

  it("does not need the media file to answer", async () => {
    // The check must be cheap enough to run on dialog open, so it must not
    // touch storage — a missing path is not an error here.
    await expect(
      canEncodeVideoCard(row("video", "does-not-exist.mp4")),
    ).resolves.toBe(false);
  });
});
