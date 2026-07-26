/// <reference lib="webworker" />

/**
 * Runs palette quantization and GIF encoding off the main thread.
 *
 * Compositing stays on the main thread — `drawTradingCard` needs a real canvas
 * and loaded fonts, and moving it here would mean OffscreenCanvas plus worker
 * `FontFace`, which is exactly the combination Safari is worst at. What crosses
 * the boundary is finished RGBA, transferred rather than copied.
 *
 * All the real work lives in `gif-encode-core`; this file is only plumbing, so
 * the identical code path is what the tests exercise and what runs when worker
 * construction fails and the caller falls back to inline encoding.
 */

import {
  createGifStream,
  quantizeSamples,
  type GifStream,
} from "@/lib/export/gif-encode-core";
import type {
  GifWorkerRequest,
  GifWorkerResponse,
} from "@/lib/export/gif-encode-protocol";

const ctx = self as unknown as DedicatedWorkerGlobalScope;

let stream: GifStream | null = null;
let frameSize = 0;

function post(message: GifWorkerResponse, transfer?: Transferable[]): void {
  ctx.postMessage(message, transfer ?? []);
}

ctx.onmessage = (event: MessageEvent<GifWorkerRequest>) => {
  const msg = event.data;
  try {
    switch (msg.type) {
      case "train": {
        const palette = quantizeSamples(
          new Uint8ClampedArray(msg.samples),
          msg.maxColors,
        );
        post({ type: "palette", id: msg.id, palette });
        break;
      }
      case "init": {
        stream = createGifStream({
          width: msg.width,
          height: msg.height,
          palette: msg.palette,
          difference: msg.difference,
        });
        frameSize = msg.width * msg.height * 4;
        post({ type: "ready", id: msg.id });
        break;
      }
      case "frame": {
        if (!stream) throw new Error("Encoder received a frame before init.");
        const rgba = new Uint8ClampedArray(msg.rgba);
        if (rgba.length !== frameSize) {
          throw new Error(
            `Frame is ${rgba.length} bytes, expected ${frameSize}.`,
          );
        }
        stream.addFrame(rgba, msg.delayMs);
        post({ type: "frameDone", id: msg.id, frameCount: stream.frameCount });
        break;
      }
      case "finish": {
        if (!stream) throw new Error("Encoder finished before init.");
        const bytes = stream.finish();
        stream = null;
        // Copy out of the encoder's buffer so the transferred ArrayBuffer is
        // exactly the GIF and nothing else.
        const out = new Uint8Array(bytes).buffer;
        post({ type: "done", id: msg.id, bytes: out }, [out]);
        break;
      }
      case "dispose": {
        stream = null;
        break;
      }
    }
  } catch (e) {
    stream = null;
    post({
      type: "error",
      id: msg.id,
      message: e instanceof Error ? e.message : String(e),
    });
  }
};
