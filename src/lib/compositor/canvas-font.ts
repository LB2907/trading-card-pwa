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
