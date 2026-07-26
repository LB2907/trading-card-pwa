"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import {
  buildCardGif,
  CardGifExportAborted,
  type CardGifProgress,
  type CardGifResult,
} from "@/lib/export/card-gif-encoder";
import {
  GIF_KNOB_LABELS,
  GIF_QUALITY_KNOBS,
  GIF_QUALITY_MAX,
  GIF_QUALITY_MIN,
  LOSSLESS_QUALITY_LEVELS,
  describeKnobLevel,
  encodeParamsKey,
  isLosslessLevels,
  resolveEncodeParams,
  type GifQualityKnob,
  type GifQualityLevels,
} from "@/lib/export/gif-quality";
import {
  evaluateGifPlatformFits,
  formatFileSize,
  type GifPlatformFit,
  type GifPlatformId,
} from "@/lib/export/gif-platform-limits";
import { downloadBlobLocally } from "@/lib/export-card-download";
import type { CardExportRow } from "@/lib/export/types";
import { safeFileStem } from "@/lib/media/media-path";
import { primeExportFolderWriteFromUserGesture } from "@/lib/export-preferences";

/** Long enough that dragging the slider does not queue an encode per step. */
const RECODE_DEBOUNCE_MS = 400;

function PlatformGlyph({ id }: { id: GifPlatformId }) {
  if (id === "x") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden className="size-4 fill-current">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="size-4 fill-current">
      <path d="M20.317 4.37a19.79 19.79 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.865-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.6 12.6 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.028C.533 9.046-.32 13.58.099 18.058a.082.082 0 0 0 .031.056 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.1 13.1 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.291.074.074 0 0 1 .078-.011c3.928 1.794 8.18 1.794 12.061 0a.074.074 0 0 1 .079.01c.12.099.246.198.373.292a.077.077 0 0 1-.007.128 12.3 12.3 0 0 1-1.873.891.077.077 0 0 0-.04.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.029 19.84 19.84 0 0 0 6.002-3.03.077.077 0 0 0 .032-.055c.5-5.177-.838-9.674-3.549-13.66a.06.06 0 0 0-.031-.029ZM8.02 15.331c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.211 0 2.176 1.095 2.157 2.42 0 1.333-.956 2.418-2.157 2.418Zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.211 0 2.176 1.095 2.157 2.42 0 1.333-.946 2.418-2.157 2.418Z" />
    </svg>
  );
}

function PlatformBadge({ fit }: { fit: GifPlatformFit }) {
  const label =
    fit.level === "fits"
      ? `Fits ${fit.name} anywhere`
      : fit.level === "partial"
        ? `${fit.name}: ${fit.tierLabel} only — ${formatFileSize(fit.bytesOver)} over the ${fit.name === "X" ? "mobile" : "free"} limit`
        : `Too big for ${fit.name} — ${formatFileSize(fit.bytesOver)} over`;

  return (
    <div
      title={fit.note ? `${label}. ${fit.note}` : label}
      aria-label={label}
      className={cn(
        "flex items-center gap-2 rounded-lg border px-2.5 py-2 transition-colors",
        fit.level === "fits" &&
          "border-emerald-800/50 bg-emerald-950/25 text-emerald-300",
        fit.level === "partial" &&
          "border-amber-800/50 bg-amber-950/20 text-amber-300/90",
        fit.level === "over" &&
          "border-border/60 bg-muted/10 text-muted-foreground/50",
      )}
    >
      <PlatformGlyph id={fit.id} />
      <div className="min-w-0 leading-tight">
        <p className="text-[11px] font-medium">{fit.name}</p>
        <p className="truncate text-[10px] opacity-80">
          {fit.level === "fits"
            ? "fits anywhere"
            : fit.level === "partial"
              ? fit.tierLabel
              : "too big"}
        </p>
      </div>
    </div>
  );
}

function progressLabel(p: CardGifProgress): string {
  if (p.phase === "palette") {
    return `Analysing colours… ${Math.round(p.fraction * 100)}%`;
  }
  return `Encoding frame ${p.frame} of ${p.totalFrames}`;
}

export function CardGifExportSection({
  row,
  watermarkText,
  disabled,
  animated,
  onBusyChange,
}: {
  row: CardExportRow;
  /** Baked into the render; part of the cache key. */
  watermarkText: string;
  disabled?: boolean;
  /** Source art is a GIF, so the export will be multi-frame. */
  animated: boolean;
  onBusyChange?: (busy: boolean) => void;
}) {
  const [levels, setLevels] = useState<GifQualityLevels>(
    LOSSLESS_QUALITY_LEVELS,
  );
  const [result, setResult] = useState<CardGifResult | null>(null);
  const [progress, setProgress] = useState<CardGifProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [started, setStarted] = useState(false);

  const cacheRef = useRef(new Map<string, CardGifResult>());
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<number | null>(null);
  // Guards against a slow encode resolving after a newer one and overwriting it.
  const runIdRef = useRef(0);

  const params = resolveEncodeParams(levels);
  const cacheKey = encodeParamsKey(params, watermarkText);
  const busy = progress !== null;

  useEffect(() => {
    onBusyChange?.(busy);
  }, [busy, onBusyChange]);

  const run = useCallback(
    async (key: string) => {
      const cached = cacheRef.current.get(key);
      if (cached) {
        setResult(cached);
        setError(null);
        return;
      }
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      const runId = ++runIdRef.current;

      setError(null);
      setProgress({
        phase: "palette",
        fraction: 0,
        frame: 0,
        totalFrames: 0,
      });
      try {
        const next = await buildCardGif(row, {
          watermarkText,
          params: resolveEncodeParams(levels),
          signal: controller.signal,
          onProgress: (p) => {
            if (runIdRef.current === runId) setProgress(p);
          },
        });
        if (runIdRef.current !== runId) return;
        cacheRef.current.set(key, next);
        setResult(next);
      } catch (e) {
        if (runIdRef.current !== runId) return;
        if (!(e instanceof CardGifExportAborted)) {
          setError(e instanceof Error ? e.message : String(e));
        }
      } finally {
        if (runIdRef.current === runId) {
          setProgress(null);
          abortRef.current = null;
        }
      }
    },
    [row, watermarkText, levels],
  );

  // Re-encode when the settings change, but only once the user has asked for a
  // GIF at all — opening the export dialog for a PNG should cost nothing.
  useEffect(() => {
    if (!started) return;
    if (cacheRef.current.has(cacheKey)) {
      setResult(cacheRef.current.get(cacheKey)!);
      return;
    }
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      void run(cacheKey);
    }, RECODE_DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [started, cacheKey, run]);

  useEffect(() => {
    // A dialog closed mid-encode must not leave a worker running.
    const cache = cacheRef.current;
    return () => {
      abortRef.current?.abort();
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
      cache.clear();
    };
  }, []);

  const setKnobLevel = (knob: GifQualityKnob, value: number) => {
    setLevels((prev) => ({ ...prev, [knob]: value }));
  };

  const lossless = isLosslessLevels(levels);
  const fits = result ? evaluateGifPlatformFits(result.bytes) : null;

  if (!started) {
    return (
      <Button
        type="button"
        variant="secondary"
        className="w-full"
        disabled={disabled}
        onClick={() => {
          setStarted(true);
          void run(cacheKey);
        }}
      >
        GIF{animated ? " · animated" : " · still"} — check size…
      </Button>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border border-border/80 bg-muted/15 p-3">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
          GIF
        </p>
        <p className="text-sm font-semibold tabular-nums">
          {result ? formatFileSize(result.bytes) : "—"}
        </p>
      </div>

      {result ? (
        <p className="text-[11px] leading-snug text-muted-foreground">
          {result.width}×{result.height}
          {result.frames > 1 ? ` · ${result.frames} frames` : " · still"}
          {lossless ? " · lossless" : ` · ${params.maxColors} colors`}
        </p>
      ) : null}

      {fits ? (
        <div className="grid grid-cols-2 gap-2">
          {fits.map((f) => (
            <PlatformBadge key={f.id} fit={f} />
          ))}
        </div>
      ) : null}

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] font-medium text-muted-foreground">
            Quality
          </p>
          {lossless ? (
            <span className="text-[10px] uppercase tracking-wider text-emerald-400/80">
              lossless
            </span>
          ) : (
            <button
              type="button"
              disabled={disabled}
              onClick={() => setLevels(LOSSLESS_QUALITY_LEVELS)}
              className="text-[10px] uppercase tracking-wider text-muted-foreground underline-offset-2 hover:underline disabled:opacity-50"
            >
              reset to lossless
            </button>
          )}
        </div>

        {GIF_QUALITY_KNOBS.map((knob) => {
          const level = levels[knob];
          const atMax = level === GIF_QUALITY_MAX;
          return (
            <div key={knob} className="space-y-1">
              <div className="flex items-baseline justify-between gap-3">
                <label
                  htmlFor={`gif-quality-${knob}`}
                  className="text-[11px] font-medium"
                  title={GIF_KNOB_LABELS[knob].hint}
                >
                  {GIF_KNOB_LABELS[knob].label}
                </label>
                <span
                  className={cn(
                    "text-[10px] tabular-nums",
                    atMax ? "text-muted-foreground" : "text-[var(--tc-accent)]",
                  )}
                >
                  {describeKnobLevel(knob, level)}
                </span>
              </div>
              <Slider
                id={`gif-quality-${knob}`}
                min={GIF_QUALITY_MIN}
                max={GIF_QUALITY_MAX}
                step={1}
                value={[level]}
                disabled={disabled}
                onValueChange={([v]) => setKnobLevel(knob, v)}
                aria-label={`${GIF_KNOB_LABELS[knob].label} quality`}
                aria-valuetext={describeKnobLevel(knob, level)}
              />
            </div>
          );
        })}

        <p className="text-[10px] leading-snug text-muted-foreground">
          Each slider is independent and lossless at its right-hand end. Colors
          and Frames leave the card frame and text completely still — only the
          art window changes between frames. Size rescales the whole card, text
          included.
        </p>
      </div>

      {progress ? (
        <div className="space-y-1.5">
          <div
            className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress.fraction * 100)}
            aria-label="GIF encode progress"
          >
            <div
              className="h-full rounded-full bg-[var(--tc-accent)] transition-[width] duration-150"
              style={{ width: `${Math.round(progress.fraction * 100)}%` }}
            />
          </div>
          <div className="flex items-center justify-between gap-2">
            <p
              className="text-[11px] text-muted-foreground"
              role="status"
              aria-live="polite"
            >
              {progressLabel(progress)}
            </p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 shrink-0 px-2 text-[11px]"
              onClick={() => abortRef.current?.abort()}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : null}

      {error ? (
        <p className="text-[11px] leading-snug text-amber-300/90" role="status">
          {error}
        </p>
      ) : null}

      <Button
        type="button"
        className="w-full"
        disabled={disabled || !result || busy}
        onClick={() => {
          if (!result) return;
          primeExportFolderWriteFromUserGesture();
          const stem = safeFileStem(row.instance.name || "card");
          void downloadBlobLocally(result.blob, `${stem}_card.gif`);
        }}
      >
        Download GIF{result ? ` · ${formatFileSize(result.bytes)}` : ""}
      </Button>
    </div>
  );
}
