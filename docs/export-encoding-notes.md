# Export encoding notes

How the card exporters turn frames into files, what went wrong with the first
attempt, and how to verify changes here without a display.

Covers three encoders:

| Export | Source | Encoder | Status |
|---|---|---|---|
| GIF | GIF art, or one still frame | `gifenc` + own palette/differencing | Working |
| GIF card → video | GIF art | WebCodecs `VideoEncoder` + muxer | Working |
| Video card → video | video art | mediabunny (demux → decode → encode → mux) | Working |

---

## MediaRecorder is the wrong tool for this

The GIF→video export originally drove `MediaRecorder` from
`canvas.captureStream(0)` plus `track.requestFrame()`, playing the animation
against the wall clock and painting as it went. It lost almost every frame.

A real 5.285 s export contained **ten frames**, with these durations:

```
32, 40, 42, 132, 122, 125, 123, 1112, 2, 3557 ms
```

Mean 1.9 fps — smooth for half a second, then a 1.1 s freeze, a 2 ms blip, then
a 3.6 s freeze. The user described it as "plays the start smoothly, then stops
then continues then stops".

**Mechanism.** `MediaRecorder` samples a *live* canvas against the wall clock
and silently drops whatever the pipeline cannot keep up with. `requestFrame()`
is a request, not a guarantee. With GIF decoding and a 1260×1764 card composite
running on the same thread, it kept up with roughly 2 fps. The frames never
reached the encoder, so no amount of care in the timing loop could recover them.

Things that did **not** fix it, and why:

- *Cumulative-target drift correction.* Timing was already accurate — the
  recording ran 1204 ms against 1200 ms intended. Accurate timing does not help
  when frames are being dropped before encoding.
- *Pre-rendering frames so the record loop only blits.* Compositing cost was not
  the bottleneck; the capture pipeline was.
- *Reducing the canvas size.* 840×1176 dropped frames the same way.
- *Republishing the final frame to fix the short last frame.* The canvas is
  unchanged, so the encoder discards it as a duplicate.

## WebCodecs is

`VideoEncoder` takes frames with **explicit timestamps and durations**. The
output contains exactly the frames handed to it, for exactly the intended time,
with no realtime constraint — and it runs faster than realtime instead of making
the user sit through the clip.

Measured end to end (build a GIF, store it, run the real export):

| Source | Encoded | Duration | Encode time |
|---|---|---|---|
| 20 frames @ 100 ms | 20/20 | 2000 / 2000 ms | 1.5 s |
| 50 frames @ 100 ms | 50/50 | 5000 / 5000 ms | 2.8 s |
| 60 frames @ 40 ms | 60/60 | 2400 / 2400 ms | 2.8 s |

Adopting it also deleted the wall-clock pump, the drift correction and the
visibility-pause handling. Those existed only to prop up the realtime approach.

### Codec selection gotcha

Probe codecs with `VideoEncoder.isConfigSupported` rather than assuming, **and
mind the level**. An early probe used `avc1.42001f` (Baseline 3.1) and reported
*unsupported* at card resolution — not because H.264 was missing, but because
1260×1764 is 2.2 MP, above what that level allows. `avc1.640034` (High 5.2)
works on the same browser.

Order in `gif-video-codec.ts` is H.264/MP4 first (what X and iOS want), then
VP9 and VP8 in WebM. The fallbacks are load-bearing, not theoretical: browsers
exist that expose `VideoEncoder` with AVC unsupported and VP8/VP9 fine.

---

## The video-art card export (now on mediabunny)

Rewritten to demux → decode → composite → encode → mux via `mediabunny`, with
`MediaRecorder` kept only as a fallback where WebCodecs is missing.

Measured end to end against generated source clips (H.264 video + AAC audio):

| Source | Frames out | Duration | Audio | Time |
|---|---|---|---|---|
| 60 frames / 2 s | 60/60 | 2005 ms exact | passthrough | 3121 ms |
| 150 frames / 5 s | 150/150 | 5013 ms exact | passthrough | 6952 ms |
| 60 frames / 2 s, silent | 60/60 | 2000 ms exact | none | 2985 ms |

**The speed win is modest — roughly 15–20 %**, not the large gain the realtime
framing suggested. Per second of source: `MediaRecorder` ≈ 1678 ms, mediabunny
≈ 1390 ms. The realtime constraint was never the dominant cost; **card
compositing is**, at roughly 40 ms per frame at 1260×1764.

The wins that are unambiguous:

- **Exact frame count and duration**, guaranteed rather than best-effort.
- **Audio passthrough** — encoded packets are copied across untouched, so no
  generational loss. The old path re-encoded through Web Audio and also upmixed
  a mono source to stereo; the new one preserves the original channel count.
- **No dependence on playback.** No autoplay, `requestVideoFrameCallback`,
  visibility-pause or wall-clock handling, so a backgrounded tab is fine.

### The real speed lever, not yet taken

Compositing dominates, and **the card chrome is identical on every frame**.
Rendering the chrome once to an offscreen canvas and per frame drawing only
`art + cached chrome overlay` — rather than re-running the whole of
`drawTradingCard` — should cut the dominant cost substantially. It would speed up
the GIF export by the same mechanism. Not attempted yet; it needs
`drawTradingCard` split into "chrome" and "art window" passes.

## Historical: what MediaRecorder did here

`buildCompositedCardVideoBlob` (video art → video) uses the same realtime
`MediaRecorder` architecture, plus a `requestVideoFrameCallback` /
`requestAnimationFrame` pump. It has not been rewritten.

Measured here, feeding it a synthetic clip whose every frame is a distinct flat
colour:

| Source | Export duration | Distinct frames in output | Export time |
|---|---|---|---|
| 60 frames @ 30 fps (2000 ms) | 1950 ms | **1** | 3820 ms |
| 90 frames @ 30 fps (3000 ms) | 2949 ms | **1** | 4756 ms |

**That frame count was an artifact, now confirmed.** The export pumps via
`requestVideoFrameCallback`/`requestAnimationFrame`, which need a compositing
page, and the agent browser pane does not composite — so the pump never fired
and only the initial frame survived. Hand-checked on a real device on
2026-07-26: **video cards do not stutter.** The frame-loss that ruined the GIF
path does not occur here, because playback-driven pumping keeps the main thread
free in a way the GIF path's tight decode/composite loop did not.

The remaining problem is therefore speed, not correctness.

What the numbers *do* support, independent of the confound:

- It is bound to realtime and then some — a 2 s clip took 3.8 s to export, a 3 s
  clip took 4.8 s. A 60 s clip costs at least 60 s of the user's time.
- It inherits the architecture that demonstrably dropped ~80 % of frames in the
  GIF path, and adds a display-driven pump the GIF path did not have.

Kept as the fallback for browsers without WebCodecs, since it does work.

---

## Verifying encoders in the agent environment

The browser pane does not composite, which rules out screenshots and anything
driven by `requestAnimationFrame` or `requestVideoFrameCallback`. It does *not*
rule out encoder work:

- `canvas.captureStream(0)` + `requestFrame()` + `MediaRecorder` runs.
- WebCodecs `VideoEncoder` runs.
- `<video>` **seeking** plus `drawImage` reads decoded frames reliably;
  `requestVideoFrameCallback` playback does not.

The technique that works: a temporary route under `src/app/`, which builds a
source whose every frame is a distinct flat colour, runs the real export, then
seeks through the output sampling one pixel. Report frame count, duration and
the sampled sequence via `get_page_text`. Delete the route afterwards.

Two traps worth knowing:

1. **Card art must be an `ImageBitmap`.** `intrinsicArtSize` only measures
   `HTMLVideoElement`, `HTMLImageElement` and `ImageBitmap`. Hand
   `drawTradingCard` a plain `<canvas>` and it silently draws no art, so every
   frame comes out identical and the probe reports frame loss that is not there.
   This wasted a debugging cycle; check the art is actually visible first.
   `intrinsicArtSize` now also measures `VideoFrame`, `OffscreenCanvas` and
   `HTMLCanvasElement`, so the WebCodecs paths can hand decoded frames straight
   through — but anything not on that list still silently draws nothing.
2. **Encode the frame index with wide steps.** H.264 shifts the red channel by
   several counts (limited vs full range), so a small step decodes to the wrong
   index and invents frames that were never sent. Steps of ~18 survive; steps of
   8 do not. Prefer counting *transitions* over trusting absolute values.

---

## See also

- `docs/superpowers/specs/2026-07-26-gif-compression-design.md` — GIF palette,
  frame differencing, quality sliders and the platform-limit badges.
- `src/lib/export/gif-video-codec.ts` — codec probing and candidate order.
- `src/lib/export/card-gif-video.ts` — the WebCodecs encode path.
