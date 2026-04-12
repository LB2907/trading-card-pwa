# Export watermark and iOS Safari (learnings)

## Canvas text on iPhone

- **Clip + text**: Safari iOS often **skips** tiled `fillText` under a **round-rect clip** plus `scale(pixelRatio)`. The card body still uses that clip; the watermark is drawn on a **same-size offscreen canvas** (no clip), then composited with **`drawImage` through the same round-rect clip** so it stays inside the frame without relying on `fillText` under clip.
- **Webfonts on canvas**: Text drawn with the same `font` string as the DOM (e.g. Geist from `getComputedStyle(document.body)`) may **not render** or may fall back inconsistently on **Safari iOS** if the face is not loaded for canvas. Export watermarks should use a **system stack** (e.g. `-apple-system`, `Segoe UI`, `Roboto`, `Arial`).
- **`strokeText`**: Thick strokes around watermark text can **glitch or disappear** on Safari. Prefer **fill-only** watermarks; a **one-pixel-offset** dark fill behind a light fill gives contrast without relying on stroke.

## `toBlob` returning `null`

- On some Safari paths, **`HTMLCanvasElement.toBlob`** invokes the callback with **`null`** (memory, codec, or implementation quirks). **`toDataURL`** then **`fetch(dataUrl).blob()`** is a practical fallback before failing the export.

## GIF exports

- **Palette quantization** (256-color GIF) can **wash out** very light watermarks on **any** device, not only iOS. If GIF previews look watermark-free, consider a slightly stronger mark only on the GIF path or accept softer marks after quantization.

## Softer default watermark

- Users often want a **subtle** mark: lower alpha, slightly smaller type, wider tile spacing, and weight **600** instead of **800** reads cleaner on busy card art.
