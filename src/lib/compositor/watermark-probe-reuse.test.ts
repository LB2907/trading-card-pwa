import { createCanvas, Image } from "@napi-rs/canvas";
import { describe, expect, it } from "vitest";
import { captureLuminanceProbe, drawTradingCard, cardCanvasSize } from "@/lib/compositor/draw-card";
import { buildLuminanceProbe } from "@/lib/compositor/watermark-ink";
import { CARD_LAYOUT_WIDTH } from "@/lib/compositor/card-resolution";
import { parseLayout } from "@/lib/card-layout";
import { BUILTIN_TEMPLATES } from "@/lib/templates/registry";
import type { CardInstance } from "@/lib/db/schema";

const g = globalThis as Record<string, unknown>;
g.HTMLVideoElement ??= class {};
g.HTMLImageElement ??= class {};
g.ImageBitmap ??= Image;
g.document ??= { body: {}, createElement: () => createCanvas(1, 1) };
g.getComputedStyle ??= () => ({ fontFamily: "sans-serif" });

function inst(): CardInstance {
  const now = new Date();
  return { id: "c", setId: "s", templateId: "t", mediaPath: "a.png", mediaKind: "image",
    name: "Velvet Sovereign", typeLine: "Legendary", rarity: "rare",
    statPower: 9, statDefense: 6, statCost: 7, statSpeed: 4, statHealth: 8, statMind: 9,
    abilityText: "Charm target creature.", flavorText: "Kneel.", creditText: "",
    createdAt: now, updatedAt: now } as CardInstance;
}

function flatProbe(level: number) {
  const w = 8, h = 11;
  const d = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    d[i * 4] = level; d[i * 4 + 1] = level; d[i * 4 + 2] = level; d[i * 4 + 3] = 255;
  }
  return buildLuminanceProbe(d, w, h);
}

function render(probe?: ReturnType<typeof flatProbe>) {
  const t = BUILTIN_TEMPLATES[0];
  const { bufW, bufH, cssW } = cardCanvasSize(CARD_LAYOUT_WIDTH, 2);
  const canvas = createCanvas(bufW, bufH);
  const ctx = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;
  drawTradingCard(ctx, {
    instance: inst(),
    layout: parseLayout(JSON.stringify(t.layout)),
    artImage: {} as unknown as CanvasImageSource,
    width: cssW,
    pixelRatio: 2,
    watermarkText: "@studio",
    watermarkProbe: probe,
  });
  return { canvas, ctx, cssW };
}

function hash(buf: Buffer): string {
  let h = 0;
  for (let i = 0; i < buf.length; i += 97) h = (h * 31 + buf[i]) >>> 0;
  return `${h}:${buf.length}`;
}

describe("watermark probe reuse", () => {
  it("honours a caller-supplied probe instead of re-measuring the frame", () => {
    // A dark card told it is bright must ink dark, differing from the default.
    const forcedBright = hash(render(flatProbe(250)).canvas.toBuffer("image/png"));
    const measured = hash(render().canvas.toBuffer("image/png"));
    expect(forcedBright).not.toBe(measured);
  });

  it("renders identically across frames when the same probe is reused", () => {
    const probe = flatProbe(20);
    const a = hash(render(probe).canvas.toBuffer("image/png"));
    const b = hash(render(probe).canvas.toBuffer("image/png"));
    expect(a).toBe(b);
  });

  it("exposes a probe that can be captured from a drawn frame and replayed", () => {
    const first = render();
    const probe = captureLuminanceProbe(first.ctx, first.cssW, first.cssW * (3.5 / 2.5));
    expect(probe).toBeDefined();
    expect(probe!.cells.length).toBeGreaterThan(0);
    // Replaying it must be stable.
    expect(hash(render(probe).canvas.toBuffer("image/png"))).toBe(
      hash(render(probe).canvas.toBuffer("image/png")),
    );
  });
});
