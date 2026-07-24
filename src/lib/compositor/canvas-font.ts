/**
 * Canvas 2D `ctx.font` must use a concrete family list. We mirror the app shell
 * (Geist on `body` from root layout) so exports match DOM preview.
 */
let cachedSans = "";

export function getCanvasFontFamilySans(): string {
  if (typeof document === "undefined") {
    return "ui-sans-serif, system-ui, sans-serif";
  }
  if (!cachedSans) {
    const ff = getComputedStyle(document.body).fontFamily?.trim();
    cachedSans = ff || "ui-sans-serif, system-ui, sans-serif";
  }
  return cachedSans;
}

/** Resets cache (e.g. if body font changes at runtime). */
export function clearCanvasFontCache(): void {
  cachedSans = "";
}

export function canvasFontSans(weight: number, sizePx: number): string {
  return `${weight} ${sizePx}px ${getCanvasFontFamilySans()}`;
}

export function canvasFontSansItalic(weight: number, sizePx: number): string {
  return `italic ${weight} ${sizePx}px ${getCanvasFontFamilySans()}`;
}

export function canvasFontSerifItalic(weight: number, sizePx: number): string {
  return `italic ${weight} ${sizePx}px ui-serif, Georgia, "Times New Roman", serif`;
}

/** Display family for card names — must match the DOM preview exactly. */
export function getCanvasFontFamilyDisplay(): string {
  return `"Fraunces", ui-serif, Georgia, serif`;
}

export function canvasFontDisplay(weight: number, sizePx: number): string {
  return `${weight} ${sizePx}px ${getCanvasFontFamilyDisplay()}`;
}

let fontsLoadedPromise: Promise<void> | null = null;

/**
 * Await webfont availability for canvas text. Safari (especially iOS) silently
 * falls back for `ctx.fillText` when the face has not been loaded for canvas
 * use — see docs/export-watermark-ios-notes.md. Cached after first success.
 */
export function ensureCardFontsLoaded(): Promise<void> {
  if (typeof document === "undefined" || !("fonts" in document)) {
    return Promise.resolve();
  }
  if (!fontsLoadedPromise) {
    fontsLoadedPromise = Promise.all([
      document.fonts.load(`600 21px "Fraunces"`),
      document.fonts.load(`700 21px "Fraunces"`),
    ])
      .then(() => undefined)
      .catch(() => {
        fontsLoadedPromise = null; // allow retry on transient failure
      });
  }
  return fontsLoadedPromise;
}
