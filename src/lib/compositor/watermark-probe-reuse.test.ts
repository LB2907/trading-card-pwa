import { createCanvas, Image } from "@napi-rs/canvas";
import { beforeEach, describe, expect, it } from "vitest";
import {
  captureLuminanceProbe,
  drawTradingCard,
  cardCanvasSize,
  resetWatermarkLayerCache,
} from "@/lib/compositor/draw-card";
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

function render(
  probe?: ReturnType<typeof flatProbe>,
  watermarkText = "@studio",
) {
  const t = BUILTIN_TEMPLATES[0];
  const { bufW, bufH, cssW } = cardCanvasSize(CARD_LAYOUT_WIDTH, 2);
  const canvas = createCanvas(bufW, bufH);
  const ctx = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;
  const used = drawTradingCard(ctx, {
    instance: inst(),
    layout: parseLayout(JSON.stringify(t.layout)),
    artImage: {} as unknown as CanvasImageSource,
    width: cssW,
    pixelRatio: 2,
    watermarkText,
    watermarkProbe: probe,
  });
  return { canvas, ctx, cssW, cssH: cssW * (3.5 / 2.5), used };
}

function hash(buf: Buffer): string {
  let h = 0;
  for (let i = 0; i < buf.length; i += 97) h = (h * 31 + buf[i]) >>> 0;
  return `${h}:${buf.length}`;
}

describe("watermark probe reuse", () => {
  beforeEach(() => {
    resetWatermarkLayerCache();
  });

  it("returns the probe it inked against, measured before the mark goes on", () => {
    // The animated exporters keep this value and feed it back. Measuring it
    // off the finished frame — as the first version of the fix did — folds the
    // mark's own ink into the measurement, so frame 0 and frame 1 disagree.
    const clean = render(undefined, "");
    const preWatermark = captureLuminanceProbe(
      clean.ctx,
      clean.cssW,
      clean.cssH,
    );
    const marked = render();
    expect(marked.used).toBeDefined();
    expect(Array.from(marked.used!.cells)).toEqual(
      Array.from(preWatermark!.cells),
    );
  });

  it("differs from what a post-composite measurement would have produced", () => {
    const marked = render();
    const postWatermark = captureLuminanceProbe(
      marked.ctx,
      marked.cssW,
      marked.cssH,
    );
    expect(Array.from(postWatermark!.cells)).not.toEqual(
      Array.from(marked.used!.cells),
    );
  });

  it("is idempotent: feeding the returned probe back reproduces the frame", () => {
    // This is the invariant every later frame of a video or GIF relies on.
    const first = render();
    const replayed = render(first.used as ReturnType<typeof flatProbe>);
    expect(hash(replayed.canvas.toBuffer("image/png"))).toBe(
      hash(first.canvas.toBuffer("image/png")),
    );
  });

  it("does not serve a cached watermark layer to different mark text", () => {
    const probe = flatProbe(20);
    const a = hash(render(probe, "@studio").canvas.toBuffer("image/png"));
    const b = hash(render(probe, "@other").canvas.toBuffer("image/png"));
    expect(a).not.toBe(b);
  });

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
