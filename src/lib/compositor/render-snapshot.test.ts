import { createCanvas } from "@napi-rs/canvas";
import { describe, expect, it } from "vitest";
import { drawTradingCard, cardCanvasSize } from "@/lib/compositor/draw-card";
import { CARD_LAYOUT_WIDTH } from "@/lib/compositor/card-resolution";
import { parseLayout } from "@/lib/card-layout";
import { BUILTIN_TEMPLATES } from "@/lib/templates/registry";
import type { CardInstance } from "@/lib/db/schema";

// drawTradingCard's intrinsic-art-size check uses `instanceof HTMLImageElement`
// etc.; those globals are undefined in the node test env and would throw. Stub
// them so the check returns false and the (absent) art is simply not drawn.
const g = globalThis as Record<string, unknown>;
g.HTMLVideoElement ??= class {};
g.HTMLImageElement ??= class {};
g.ImageBitmap ??= class {};

function fakeInstance(rarity: string): CardInstance {
  const now = new Date();
  return {
    id: "card_test",
    setId: "set_test",
    templateId: "tpl_test",
    mediaPath: "art.png",
    mediaKind: "image",
    name: "Velvet Sovereign",
    typeLine: "Legendary · Enchantress",
    rarity,
    statPower: 9,
    statDefense: 6,
    statCost: 7,
    statSpeed: 4,
    statHealth: 8,
    statMind: 9,
    abilityText: "Charm target creature until end of turn.",
    flavorText: "Kneel, and keep your name.",
    createdAt: now,
    updatedAt: now,
  };
}

/** Render one built-in template + rarity to a PNG buffer via the real compositor. */
function renderTemplate(layoutJson: string, rarity = "rare"): Buffer {
  const layout = parseLayout(layoutJson);
  const pixelRatio = 2;
  const { bufW, bufH, cssW } = cardCanvasSize(CARD_LAYOUT_WIDTH, pixelRatio);
  const canvas = createCanvas(bufW, bufH);
  const ctx = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;
  drawTradingCard(ctx, {
    instance: fakeInstance(rarity),
    layout,
    // Not a real image; intrinsicArtSize returns {0,0} so no art is blitted.
    artImage: {} as unknown as CanvasImageSource,
    width: cssW,
    pixelRatio,
  });
  return canvas.toBuffer("image/png");
}

function hash(buf: Buffer): string {
  let h = 0;
  for (let i = 0; i < buf.length; i += 97) h = (h * 31 + buf[i]) >>> 0;
  return `${h}:${buf.length}`;
}

describe("compositor render snapshots (headless napi canvas)", () => {
  it("every built-in template renders to a valid PNG without throwing", () => {
    for (const t of BUILTIN_TEMPLATES) {
      const buf = renderTemplate(JSON.stringify(t.layout));
      expect(buf.length, `${t.name} produced no output`).toBeGreaterThan(1000);
      // PNG magic bytes.
      expect(buf.slice(1, 4).toString()).toBe("PNG");
    }
  });

  it("every built-in template renders distinctly (no silent fallback)", () => {
    const seen = new Map<string, string>();
    for (const t of BUILTIN_TEMPLATES) {
      const h = hash(renderTemplate(JSON.stringify(t.layout)));
      const prev = seen.get(h);
      expect(
        prev,
        `${t.name} renders identically to ${prev} — a theme is falling through`,
      ).toBeUndefined();
      seen.set(h, t.name);
    }
    expect(seen.size).toBe(BUILTIN_TEMPLATES.length);
  });

  it("rendering is deterministic (same input → identical bytes)", () => {
    const t = BUILTIN_TEMPLATES[0];
    const a = renderTemplate(JSON.stringify(t.layout));
    const b = renderTemplate(JSON.stringify(t.layout));
    expect(hash(a)).toBe(hash(b));
  });

  it("foil changes the render (mythic differs from common)", () => {
    const t = BUILTIN_TEMPLATES.find((x) => x.id === "tpl_obsidian")!;
    const common = hash(renderTemplate(JSON.stringify(t.layout), "common"));
    const mythic = hash(renderTemplate(JSON.stringify(t.layout), "mythic"));
    expect(mythic).not.toBe(common);
  });
});
