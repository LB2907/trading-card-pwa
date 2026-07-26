"use client";

/**
 * Bridge to the GIF encode worker, with an inline fallback.
 *
 * Bundler and browser support for module workers is good but not universal, and
 * a failed `new Worker(...)` must not cost the user their export. Both paths run
 * the same `gif-encode-core` code; the only difference is which thread it runs
 * on, so a fallback export is slower but byte-identical.
 */

import {
  createGifStream,
  quantizeSamples,
  type GifPalette,
  type GifStream,
} from "@/lib/export/gif-encode-core";
import type {
  GifWorkerRequest,
  GifWorkerResponse,
} from "@/lib/export/gif-encode-protocol";

export type GifEncodeSessionInit = {
  width: number;
  height: number;
  palette: GifPalette;
  difference?: boolean;
};

export type GifEncodeSession = {
  /** True when work is running off the main thread. */
  readonly offThread: boolean;
  trainPalette(
    samples: Uint8ClampedArray,
    maxColors: number,
  ): Promise<GifPalette>;
  init(opts: GifEncodeSessionInit): Promise<void>;
  addFrame(rgba: Uint8ClampedArray, delayMs: number): Promise<void>;
  finish(): Promise<Uint8Array>;
  dispose(): void;
};

/** Let the browser paint between frames so an inline encode is not a freeze. */
function yieldToEventLoop(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function createInlineSession(): GifEncodeSession {
  let stream: GifStream | null = null;
  return {
    offThread: false,
    async trainPalette(samples, maxColors) {
      return quantizeSamples(samples, maxColors);
    },
    async init(opts) {
      stream = createGifStream({
        width: opts.width,
        height: opts.height,
        palette: opts.palette,
        difference: opts.difference ?? true,
      });
    },
    async addFrame(rgba, delayMs) {
      if (!stream) throw new Error("Encoder received a frame before init.");
      stream.addFrame(rgba, delayMs);
      await yieldToEventLoop();
    },
    async finish() {
      if (!stream) throw new Error("Encoder finished before init.");
      const bytes = stream.finish();
      stream = null;
      return bytes;
    },
    dispose() {
      stream = null;
    },
  };
}

function createWorkerSession(worker: Worker): GifEncodeSession {
  let nextId = 1;
  let disposed = false;
  const pending = new Map<
    number,
    { resolve: (r: GifWorkerResponse) => void; reject: (e: Error) => void }
  >();

  const failAll = (message: string) => {
    for (const [, p] of pending) p.reject(new Error(message));
    pending.clear();
  };

  worker.onmessage = (event: MessageEvent<GifWorkerResponse>) => {
    const msg = event.data;
    const entry = pending.get(msg.id);
    if (!entry) return;
    pending.delete(msg.id);
    if (msg.type === "error") entry.reject(new Error(msg.message));
    else entry.resolve(msg);
  };
  // A worker that dies mid-encode must reject rather than hang the export.
  worker.onerror = () => failAll("GIF encoder worker failed.");
  worker.onmessageerror = () =>
    failAll("GIF encoder worker could not read a message.");

  function send(
    build: (id: number) => GifWorkerRequest,
    transfer?: Transferable[],
  ): Promise<GifWorkerResponse> {
    if (disposed) return Promise.reject(new Error("Encoder was disposed."));
    const id = nextId++;
    const message = build(id);
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      try {
        worker.postMessage(message, transfer ?? []);
      } catch (e) {
        pending.delete(id);
        reject(e instanceof Error ? e : new Error(String(e)));
      }
    });
  }

  return {
    offThread: true,
    async trainPalette(samples, maxColors) {
      // `samples` is built for this call and never read again, so transfer it.
      const buffer = samples.slice().buffer;
      const res = await send(
        (id) => ({ type: "train", id, samples: buffer, maxColors }),
        [buffer],
      );
      if (res.type !== "palette") throw new Error("Unexpected encoder reply.");
      return res.palette;
    },
    async init(opts) {
      await send((id) => ({
        type: "init",
        id,
        width: opts.width,
        height: opts.height,
        palette: opts.palette,
        difference: opts.difference ?? true,
      }));
    },
    async addFrame(rgba, delayMs) {
      // getImageData hands back a fresh buffer each call, so this is safe to
      // transfer — the caller has no further use for it.
      const buffer = rgba.buffer as ArrayBuffer;
      await send((id) => ({ type: "frame", id, rgba: buffer, delayMs }), [
        buffer,
      ]);
    },
    async finish() {
      const res = await send((id) => ({ type: "finish", id }));
      if (res.type !== "done") throw new Error("Unexpected encoder reply.");
      return new Uint8Array(res.bytes);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      failAll("Encoder was disposed.");
      worker.terminate();
    },
  };
}

/** How long a worker gets to answer the handshake before it is written off. */
const HANDSHAKE_TIMEOUT_MS = 4_000;

/**
 * Remembered across exports: probing is cheap but not free, and a worker that
 * failed once on this page load will fail again.
 */
let workerVerdict: "unknown" | "broken" = "unknown";

/**
 * Prove the worker actually runs before trusting an export to it.
 *
 * Construction succeeding is not enough. `new Worker(...)` resolves against a
 * bundler-generated bootstrap, and a mismatch there — a classic-mode
 * `importScripts` bootstrap loaded as a module, a chunk that never got emitted,
 * a CSP that blocks the script — throws *inside* the worker, well after the
 * constructor returned. Without this probe that surfaces as a failed export
 * rather than a slower one.
 */
async function handshake(session: GifEncodeSession): Promise<boolean> {
  const probe = new Uint8ClampedArray([0, 0, 0, 255, 255, 255, 255, 255]);
  try {
    const palette = await Promise.race([
      session.trainPalette(probe, 2),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error("worker handshake timed out")),
          HANDSHAKE_TIMEOUT_MS,
        ),
      ),
    ]);
    return Array.isArray(palette) && palette.length > 0;
  } catch {
    return false;
  }
}

function spawnWorker(type: WorkerType): Worker | null {
  try {
    return new Worker(new URL("./gif-encode.worker.ts", import.meta.url), {
      type,
    });
  } catch {
    return null;
  }
}

/**
 * Prefer a worker; fall back to inline when one cannot be constructed or fails
 * its handshake (older Safari, restrictive CSP, or a bundler that emitted a
 * bootstrap incompatible with the requested worker type).
 *
 * Module and classic are both tried: which one works is a property of the
 * bundler's output, not something worth hardcoding.
 */
export async function createGifEncodeSession(): Promise<GifEncodeSession> {
  if (typeof Worker === "undefined" || workerVerdict === "broken") {
    return createInlineSession();
  }
  for (const type of ["module", "classic"] as const) {
    const worker = spawnWorker(type);
    if (!worker) continue;
    const session = createWorkerSession(worker);
    if (await handshake(session)) return session;
    session.dispose();
  }
  workerVerdict = "broken";
  return createInlineSession();
}
