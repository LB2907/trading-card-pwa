# Lossless GIF compression with quality slider and platform badges

Date: 2026-07-26
Status: approved, implementing

## Problem

`buildCompositedCardGifBlob` produces a card GIF with no size feedback and no
controls. Every frame is quantized independently to 256 colors and written
full-size with its own 768-byte local color table. The user cannot tell whether
the result will be accepted by X or Discord until after they download it and
check by hand.

## Scope

Card GIF export only, inside the existing export dialog. Not a standalone
GIF-compressor tool, and not applied to the bulk-export/zip path beyond it
inheriting the improved default encoder.

## Design

### 1. Lossless encoding improvements (always on)

Two changes reduce bytes without spending visible quality:

**Transparent-index frame differencing.** A composited card is mostly static —
border, name, type line, ability text and frame never change between frames;
only the art window moves. Each frame after the first is written with unchanged
pixels set to a reserved transparent palette index and `dispose: 1`, so the
previously displayed pixel shows through. Output is pixel-identical; LZW
compresses the long transparent runs hard. This is genuinely lossless.

The comparison is against the *intended* full index image of the previous frame,
not the emitted one. With `dispose: 1` the displayed state of a pixel is the last
non-transparent index written to it, so comparing against the previous intended
image is correct. Frame 0 is fully opaque and covers the whole canvas, so every
pixel is defined from frame 0 onward and nothing shows through from the GIF
background.

**One global palette.** A single palette is trained across the animation instead
of re-quantizing per frame. This drops a color table per frame and fixes an
existing defect: independent per-frame quantization lands the same source color
on slightly different RGB in different frames, which shimmers. This changes pixel
values relative to today's output, so it is quality-neutral-or-better rather than
byte-identical to the current encoder.

Transparency reserves one palette slot, so the lossless path uses 255 colors
instead of 256.

**Measured**, on a real composited card (840×1176, 24 frames, foil + watermark,
old encoder vs new):

| Art | Before | After | Reduction |
|---|---|---|---|
| Drifting gradient (typical animated art) | 3.41 MB | 1.47 MB | **56.8%** |
| Per-pixel noise (worst case, nothing repeats) | 18.09 MB | 17.50 MB | 3.3% |

The noise case is the floor: differencing has nothing to find, so only the
global-palette saving remains. It also shows why the quality knobs are needed —
18 MB clears no platform tier at all.

`gifenc` hardcodes `x=0, y=0` in the image descriptor
(`node_modules/gifenc/src/index.js:230`), so bounding-box sub-rectangle
optimization is not available without patching the library. Transparent-index
differencing captures most of the same win and is not pursued further here.

### 2. Quality knobs — opt-in per export, default lossless

Default state is lossless: full palette, every frame, full dimensions. The
quality slider (1–10) is present but inert until the user enables at least one
knob. Level 10 always resolves to lossless parameters regardless of which knobs
are enabled.

| Knob | Effect | Cost |
|---|---|---|
| Colors | 255 → 32 | Gradients and foil band first; text stays sharp |
| Frames | keep every Nth, delays summed so duration is preserved | Choppier motion, no blur |
| Scale | full → 40% | Serif card name and ability text go mushy fast |

Differencing is applied on every path, including reduced-color ones — it is
lossless relative to the quantized frames, and fewer colors make more pixels
match between frames, so it compresses better rather than worse.

### 3. Platform badges — tri-state, because limits are tiered

Real limits, confirmed 2026-07-26:

- X: 15 MB desktop web, 5 MB mobile app
- Discord: 10 MB free, 50 MB Nitro Basic / Boost L2, 500 MB Nitro

A single boolean "fits X" would be a lie, so each badge has three states:

- **fits** — under the strictest tier (5 MB X / 10 MB Discord); safe anywhere
- **partial** — fits a higher tier only; the badge names which one
- **over** — too big for every tier

Thresholds live in one exported table so a platform change is a one-line edit.
Byte thresholds use decimal MB (10^6), which is the conservative reading: if a
platform actually means MiB we under-promise rather than over-promise.

X transcodes uploaded GIFs to silent MP4, so quality spent to squeeze under X's
limit is partly discarded. The X badge carries that as a note.

### 4. Architecture

**Compositing stays on the main thread.** Moving `drawTradingCard` into a worker
requires OffscreenCanvas plus `FontFace` in worker scope — a real iOS Safari risk,
and canvas compositing cannot be verified in the current agent environment. Instead
each composited frame's RGBA is transferred into a worker for the expensive half
(quantize / applyPalette / diff / LZW), one frame in flight at a time.

**Worker with inline fallback, gated on a handshake.** The encode core is a plain
module. A thin worker wrapper runs it off-thread; the same core runs inline if the
worker is unusable. Tests exercise the core directly with no worker plumbing.

Construction succeeding is not sufficient evidence the worker works: `new Worker`
resolves against a bundler-generated bootstrap, and a mismatch there (a classic
`importScripts` bootstrap loaded as a module, a missing chunk, a blocking CSP)
throws *inside* the worker long after the constructor returned — which would
surface as a failed export rather than a slower one. So the session sends a
trivial quantize request and waits for the reply before trusting the worker,
trying module then classic, and caching a "broken" verdict for the page load.

Verified against the real Turbopack build: the module worker loads and encodes
(`offThread: true`, valid `GIF89a` output, no console errors), so the fallback is
insurance rather than the normal path.

**Two passes, because a global palette must see the whole animation.** Pass 1
composites every 8th frame and subsamples pixels into a small training buffer,
quantized once. Pass 2 composites every frame and encodes. Pass 1 costs roughly
12% of a compositing pass.

**No frame cache.** 280 frames × 840×1176 × 4 bytes ≈ 1.1 GB — not survivable on a
phone. Instead the finished blob is cached keyed by
`colors|frameStep|scale|watermark`, so returning to an already-visited slider
position is instant and only new levels cost an encode. Cache is bounded and
cleared when the dialog closes.

**Nothing encodes until asked.** The GIF button becomes a section with an explicit
"Prepare GIF" action → progress → size + badges → Download. Opening the dialog for
a PNG costs nothing. Cancellation via `AbortSignal`, matching the video export
pattern.

### 5. Files

New:

- `src/lib/export/gif-platform-limits.ts` — limit table, tri-state fit function
- `src/lib/export/gif-quality.ts` — quality level → `{maxColors, frameStep, scale}`
- `src/lib/export/gif-encode-core.ts` — palette, differencing, LZW; pure
- `src/lib/export/gif-encode.worker.ts` — thin worker wrapper over the core
- `src/lib/export/card-gif-encoder.ts` — two-pass orchestration, worker bridge,
  cache, abort
- `src/components/card-gif-export-section.tsx` — GIF UI, extracted from
  `card-export-panel.tsx` (535 lines and would otherwise keep growing)

Changed:

- `src/lib/export/card-rendered-media.ts` — `buildCompositedCardGifBlob` delegates
  to the new encoder, keeping its signature so the bulk-export/zip callers are
  unaffected.

### 6. Testing

The load-bearing test is a **round-trip proof**: encode a synthetic multi-frame
image with differencing on, decode with `gifuct-js`, assert decoded frames are
pixel-identical to the pre-encode indexed frames. That proves losslessness rather
than asserting it.

Also:

- differencing output is strictly smaller than non-differenced for a
  partially-static animation
- badge tiers at boundary sizes (4.9 / 5.0 / 9.9 / 10.0 / 15.0 / 50.0 MB)
- quality level → parameter mapping, including level 10 == lossless for every
  knob combination, and monotonicity across levels
- frame decimation preserves total animation duration
- global palette is deterministic for identical input

## Out of scope

- Standalone GIF compressor for arbitrary uploaded GIFs
- Bounding-box sub-rectangle optimization (needs a gifenc patch)
- Dimension-based platform rules (only file size drives the badges)
- Applying the slider to the bulk-export path
