import { createCanvas, loadImage, Image } from "@napi-rs/canvas";
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
// napi's Image stands in for ImageBitmap so `intrinsicArtSize` recognises real
// art; tests that pass `{}` still fall through to the "no art" path.
g.ImageBitmap ??= Image;

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
    creditText: "",
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

/** Render an explicit instance (no art), for card-content variations. */
function renderInstance(
  layoutJson: string,
  instance: CardInstance,
  pixelRatio = 2,
): Buffer {
  const layout = parseLayout(layoutJson);
  const { bufW, bufH, cssW } = cardCanvasSize(CARD_LAYOUT_WIDTH, pixelRatio);
  const canvas = createCanvas(bufW, bufH);
  const ctx = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;
  drawTradingCard(ctx, {
    instance,
    layout,
    artImage: {} as unknown as CanvasImageSource,
    width: cssW,
    pixelRatio,
  });
  return canvas.toBuffer("image/png");
}

/** A high-frequency test pattern, larger than the art window so it downscales. */
async function makeArt(w: number, h: number): Promise<Image> {
  const c = createCanvas(w, h);
  const x = c.getContext("2d");
  x.fillStyle = "#101014";
  x.fillRect(0, 0, w, h);
  x.strokeStyle = "#f0e6d2";
  x.lineWidth = 1;
  for (let i = 0; i < w; i += 3) {
    x.beginPath();
    x.moveTo(i, 0);
    x.lineTo(i, h);
    x.stroke();
  }
  return loadImage(c.toBuffer("image/png"));
}

/** Render with art blitted (the export path every real card takes). */
function renderWithArt(layoutJson: string, art: Image, rarity = "rare"): Buffer {
  const layout = parseLayout(layoutJson);
  const pixelRatio = 2;
  const { bufW, bufH, cssW } = cardCanvasSize(CARD_LAYOUT_WIDTH, pixelRatio);
  const canvas = createCanvas(bufW, bufH);
  const ctx = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;
  drawTradingCard(ctx, {
    instance: fakeInstance(rarity),
    layout,
    artImage: art as unknown as CanvasImageSource,
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

  it("blits the art into the card (art-bearing render differs from artless)", async () => {
    const t = BUILTIN_TEMPLATES[0];
    const art = await makeArt(1600, 1600);
    const withArt = hash(renderWithArt(JSON.stringify(t.layout), art));
    const without = hash(renderTemplate(JSON.stringify(t.layout)));
    expect(withArt).not.toBe(without);
  });

  it("downscales art with high smoothing quality (no aliasing)", async () => {
    const t = BUILTIN_TEMPLATES[0];
    const art = await makeArt(1600, 1600);
    const layout = parseLayout(JSON.stringify(t.layout));
    const pixelRatio = 2;
    const { bufW, bufH, cssW } = cardCanvasSize(CARD_LAYOUT_WIDTH, pixelRatio);
    const canvas = createCanvas(bufW, bufH);
    const raw = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;

    // Record the smoothing settings in force at the moment the art is blitted.
    const seen: { enabled: unknown; quality: unknown }[] = [];
    const ctx = new Proxy(raw, {
      get(target, prop, receiver) {
        if (prop === "drawImage") {
          return (...args: unknown[]) => {
            seen.push({
              enabled: target.imageSmoothingEnabled,
              quality: target.imageSmoothingQuality,
            });
            return (target.drawImage as (...a: unknown[]) => void).apply(target, args);
          };
        }
        const v = Reflect.get(target, prop, receiver);
        return typeof v === "function" ? v.bind(target) : v;
      },
      set(target, prop, value) {
        return Reflect.set(target, prop, value);
      },
    }) as CanvasRenderingContext2D;

    drawTradingCard(ctx, {
      instance: fakeInstance("rare"),
      layout,
      artImage: art as unknown as CanvasImageSource,
      width: cssW,
      pixelRatio,
    });

    expect(seen.length, "art was never drawn").toBeGreaterThan(0);
    expect(seen[0].enabled).toBe(true);
    expect(seen[0].quality).toBe("high");
  });

  it("draws a bottom rail when the card carries credit text", () => {
    const t = BUILTIN_TEMPLATES[0];
    const plain = hash(renderTemplate(JSON.stringify(t.layout)));
    const credited = hash(
      renderInstance(JSON.stringify(t.layout), {
        ...fakeInstance("rare"),
        creditText: "Requested by: Jane",
      }),
    );
    expect(credited).not.toBe(plain);
  });

  it("draws no rail when the credit is empty", () => {
    const t = BUILTIN_TEMPLATES[0];
    const empty = hash(
      renderInstance(JSON.stringify(t.layout), {
        ...fakeInstance("rare"),
        creditText: "",
      }),
    );
    const absent = hash(renderTemplate(JSON.stringify(t.layout)));
    expect(empty).toBe(absent);
  });

  it("draws no rail for whitespace-only credit", () => {
    const t = BUILTIN_TEMPLATES[0];
    const blank = hash(
      renderInstance(JSON.stringify(t.layout), {
        ...fakeInstance("rare"),
        creditText: "   ",
      }),
    );
    expect(blank).toBe(hash(renderTemplate(JSON.stringify(t.layout))));
  });

  it("does not swallow the flavor line to make room for the rail", () => {
    const t = BUILTIN_TEMPLATES[0];
    const base = { ...fakeInstance("legendary"), creditText: "Requested by: Jane" };
    const withFlavor = hash(renderInstance(JSON.stringify(t.layout), base));
    const noFlavor = hash(
      renderInstance(JSON.stringify(t.layout), { ...base, flavorText: "" }),
    );
    expect(withFlavor).not.toBe(noFlavor);
  });

  it("does not swallow the ability panel to make room for the rail", () => {
    const t = BUILTIN_TEMPLATES[0];
    const base = { ...fakeInstance("legendary"), creditText: "Requested by: Jane" };
    const withAbility = hash(renderInstance(JSON.stringify(t.layout), base));
    const noAbility = hash(
      renderInstance(JSON.stringify(t.layout), { ...base, abilityText: "" }),
    );
    expect(withAbility).not.toBe(noAbility);
  });

  it("never costs a template content it could render without the rail", () => {
    // Aurora already drops flavor on a full card for its own layout reasons
    // (see the 2026-07-25 card-quality review); the rail must not *add* any
    // template to that list. Rendered at ratio 1 — this walks the whole
    // registry and only needs hashes to differ, not print resolution.
    const CREDIT = "Requested by: Jane";
    for (const t of BUILTIN_TEMPLATES) {
      const json = JSON.stringify(t.layout);
      const render = (creditText: string, over: Partial<CardInstance>) =>
        hash(
          renderInstance(
            json,
            { ...fakeInstance("legendary"), creditText, ...over },
            1,
          ),
        );

      const fullNoRail = render("", {});
      const fullRail = render(CREDIT, {});

      for (const [field, over] of [
        ["flavor", { flavorText: "" }],
        ["ability", { abilityText: "" }],
      ] as const) {
        const renderedWithoutRail = fullNoRail !== render("", over);
        if (!renderedWithoutRail) continue;
        expect(
          fullRail !== render(CREDIT, over),
          `${t.name} lost its ${field} once a rail was added`,
        ).toBe(true);
      }
    }
  }, 30_000);



  it("renders the rail on every built-in template", () => {
    for (const t of BUILTIN_TEMPLATES) {
      const plain = hash(renderTemplate(JSON.stringify(t.layout)));
      const credited = hash(
        renderInstance(JSON.stringify(t.layout), {
          ...fakeInstance("rare"),
          creditText: "Requested by: Jane",
        }),
      );
      expect(credited, `${t.name} ignored the credit rail`).not.toBe(plain);
    }
  });

  it("foil changes the render (mythic differs from common)", () => {
    const t = BUILTIN_TEMPLATES.find((x) => x.id === "tpl_obsidian")!;
    const common = hash(renderTemplate(JSON.stringify(t.layout), "common"));
    const mythic = hash(renderTemplate(JSON.stringify(t.layout), "mythic"));
    expect(mythic).not.toBe(common);
  });
});
