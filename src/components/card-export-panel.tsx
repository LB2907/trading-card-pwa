"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useModalA11y } from "@/hooks/use-modal-a11y";
import type {
  CardExportOptions,
  CardExportRow,
  CardVideoProgress,
} from "@/lib/export-card-download";
import {
  downloadCompositedGifCardVideo,
  downloadCompositedCardJpeg,
  downloadCompositedCardPng,
  downloadCompositedCardVideo,
  downloadCompositedCardWebp,
  downloadOriginalMedia,
  shareCompositedPng,
  shareOriginalMedia,
} from "@/lib/export-card-download";
import {
  canvasSupportsWebpExport,
  CardVideoExportAborted,
  getCompositedCardVideoExportFormat,
} from "@/lib/export/card-rendered-media";
import { canExportGifCardVideo } from "@/lib/export/card-gif-video";
import { cardMediaMode } from "@/lib/media/card-media-mode";
import {
  DEFAULT_EXPORT_RESOLUTION,
  EXPORT_RESOLUTIONS,
  type ExportResolution,
} from "@/lib/compositor/card-resolution";
import {
  getExportWatermarkText,
  hydrateExportDirHandleFromStorage,
  primeExportFolderWriteFromUserGesture,
} from "@/lib/export-preferences";
import { CardGifExportSection } from "@/components/card-gif-export-section";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

function formatSeconds(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

/**
 * Recording is bound to wall clock, so the remaining time is simply the
 * remaining clip. Worth stating plainly rather than showing a bare spinner for
 * what can be several minutes.
 */
function videoProgressLabel(p: CardVideoProgress): string {
  if (p.fraction == null || p.totalMs == null) {
    return `Recording… ${formatSeconds(p.elapsedMs)} elapsed`;
  }
  const pct = Math.round(p.fraction * 100);
  const left = Math.max(0, p.totalMs - p.fraction * p.totalMs);
  return `Recording ${pct}% · about ${formatSeconds(left)} left`;
}

function canShareFiles(): boolean {
  if (typeof navigator === "undefined") return false;
  const nav = navigator as Navigator & {
    canShare?: (data: { files: File[] }) => boolean;
  };
  if (!nav.canShare) return false;
  try {
    const f = new File([new Uint8Array([137, 80])], "probe.png", {
      type: "image/png",
    });
    return nav.canShare({ files: [f] });
  } catch {
    return false;
  }
}

export function CardExportPanel({ row }: { row: CardExportRow }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [omitWatermark, setOmitWatermark] = useState(false);
  const [resolution, setResolution] = useState<ExportResolution>(
    DEFAULT_EXPORT_RESOLUTION,
  );
  const [note, setNote] = useState<string | null>(null);
  const compositedOpts = useMemo<CardExportOptions | undefined>(() => {
    const opts: CardExportOptions = {
      pixelRatio: EXPORT_RESOLUTIONS[resolution].ratio,
    };
    if (omitWatermark) opts.omitWatermark = true;
    return opts;
  }, [omitWatermark, resolution]);
  const [webpOk, setWebpOk] = useState(false);
  // Read from localStorage on open rather than during render, so the first
  // paint cannot disagree with the server-rendered markup.
  const [watermarkBase, setWatermarkBase] = useState("");
  const [gifBusy, setGifBusy] = useState(false);
  const [gifVideoOk, setGifVideoOk] = useState(false);
  const [videoProgress, setVideoProgress] = useState<CardVideoProgress | null>(
    null,
  );
  const videoAbortRef = useRef<AbortController | null>(null);
  const [videoFmt, setVideoFmt] = useState<{ ext: "mp4" | "webm" } | null>(
    null,
  );
  const kind = row.instance.mediaKind;
  const shareOk = typeof navigator !== "undefined" && canShareFiles();
  const artIsVideo = cardMediaMode(row.instance) === "video";
  /** A GIF encode running in the section still blocks the other exports. */
  const anyBusy = busy || gifBusy;
  const panelRef = useRef<HTMLDivElement>(null);
  useModalA11y(open, () => setOpen(false), panelRef);

  useEffect(() => {
    setWebpOk(canvasSupportsWebpExport());
    setVideoFmt(getCompositedCardVideoExportFormat());
    let cancelled = false;
    void canExportGifCardVideo(row).then((ok) => {
      if (!cancelled) setGifVideoOk(ok);
    });
    return () => {
      cancelled = true;
    };
  }, [row]);

  useEffect(() => {
    if (!open) return;
    void hydrateExportDirHandleFromStorage();
    setWatermarkBase(getExportWatermarkText());
  }, [open]);

  const showOriginalDownload =
    kind === "gif" ||
    kind === "video" ||
    kind === "image" ||
    kind === "video_frame";
  const showOriginalShare = shareOk && showOriginalDownload;

  async function run(label: string, fn: () => Promise<void>) {
    primeExportFolderWriteFromUserGesture();
    setBusy(true);
    setNote(null);
    try {
      await fn();
      setNote(`${label} started.`);
    } catch (e) {
      setNote(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function runVideo(
    download: (opts: CardExportOptions) => Promise<void> = (o) =>
      downloadCompositedCardVideo(row, o),
  ) {
    primeExportFolderWriteFromUserGesture();
    const controller = new AbortController();
    videoAbortRef.current = controller;
    setBusy(true);
    setNote(null);
    setVideoProgress({ fraction: 0, elapsedMs: 0, totalMs: null });
    try {
      await download({
        ...compositedOpts,
        onVideoProgress: setVideoProgress,
        signal: controller.signal,
      });
      setNote("Video download started.");
    } catch (e) {
      setNote(
        e instanceof CardVideoExportAborted
          ? "Video export cancelled."
          : e instanceof Error
            ? e.message
            : String(e),
      );
    } finally {
      videoAbortRef.current = null;
      setVideoProgress(null);
      setBusy(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        disabled={anyBusy}
        className="w-full"
        size="lg"
        onClick={() => {
          setOpen(true);
          setNote(null);
          setOmitWatermark(false);
          setResolution(DEFAULT_EXPORT_RESOLUTION);
        }}
      >
        Export / share…
      </Button>
      {open && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <Card
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="card-export-dialog-title"
            className="max-h-[90vh] w-full max-w-md overflow-y-auto border-border shadow-xl outline-none"
            tabIndex={-1}
          >
            <CardHeader>
              <CardTitle
                id="card-export-dialog-title"
                className="font-[family-name:var(--font-display)] text-xl"
              >
                Export card
              </CardTitle>
              <CardDescription>
                Full card at 1680&thinsp;px wide — sharp on screens and
                print-ready at 2.5&Prime;&nbsp;×&nbsp;3.5&Prime;.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3 rounded-lg border border-border/80 bg-muted/20 p-3">
                <Checkbox
                  id="card-export-no-watermark"
                  className="mt-0.5"
                  checked={omitWatermark}
                  disabled={anyBusy}
                  onCheckedChange={(v) => setOmitWatermark(v === true)}
                />
                <div className="min-w-0 space-y-1">
                  <Label
                    htmlFor="card-export-no-watermark"
                    className="cursor-pointer text-sm font-medium leading-snug"
                  >
                    Export without watermark
                  </Label>
                  <p className="text-xs leading-snug text-muted-foreground">
                    Applies to full-card stills, GIF, video, and shared PNG from
                    this dialog. Source-only downloads are unchanged.
                  </p>
                </div>
              </div>

              <div className="space-y-1.5">
                <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                  Resolution
                </p>
                <div className="grid grid-cols-3 gap-2" role="group" aria-label="Export resolution">
                  {(Object.keys(EXPORT_RESOLUTIONS) as ExportResolution[]).map(
                    (key) => {
                      const p = EXPORT_RESOLUTIONS[key];
                      const active = resolution === key;
                      return (
                        <button
                          key={key}
                          type="button"
                          aria-pressed={active}
                          disabled={anyBusy}
                          onClick={() => setResolution(key)}
                          className={`flex flex-col items-center gap-0.5 rounded-lg border px-2 py-2 text-xs font-medium transition-colors disabled:opacity-50 ${
                            active
                              ? "border-primary bg-primary/12 text-foreground"
                              : "border-border bg-muted/20 text-muted-foreground hover:bg-muted/40"
                          }`}
                        >
                          <span>{p.label}</span>
                          <span className="text-[10px] tabular-nums opacity-70">
                            {p.width}×{p.height}
                          </span>
                        </button>
                      );
                    },
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Applies to still images (PNG/JPEG/WebP). Higher = sharper &
                  larger files; Web is best for quick sharing.
                </p>
              </div>

              <div className="flex flex-col gap-2">
                <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                  Full card · frame + text + art
                </p>
                <Button
                  type="button"
                  className="w-full"
                  size="lg"
                  disabled={anyBusy}
                  onClick={() =>
                    void run("PNG download", () =>
                      downloadCompositedCardPng(row, compositedOpts),
                    )
                  }
                >
                  Download PNG
                </Button>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={anyBusy}
                    onClick={() =>
                      void run("JPEG download", () =>
                        downloadCompositedCardJpeg(row, compositedOpts),
                      )
                    }
                  >
                    JPEG
                  </Button>
                  {webpOk ? (
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={anyBusy}
                      onClick={() =>
                        void run("WebP download", () =>
                          downloadCompositedCardWebp(row, compositedOpts),
                        )
                      }
                    >
                      WebP
                    </Button>
                  ) : null}
                </div>
                <CardGifExportSection
                  row={row}
                  watermarkText={omitWatermark ? "" : watermarkBase}
                  animated={kind === "gif"}
                  // Its own encode must not disable its own controls.
                  disabled={busy}
                  onBusyChange={setGifBusy}
                />
                {kind === "gif" && gifVideoOk ? (
                  <div className="space-y-1.5 rounded-lg border border-border/80 bg-muted/15 p-3">
                    <Button
                      type="button"
                      variant="secondary"
                      className="w-full"
                      disabled={anyBusy}
                      onClick={() =>
                        void runVideo((o) =>
                          downloadCompositedGifCardVideo(row, o),
                        )
                      }
                    >
                      Record as video — best for X
                    </Button>
                    <p className="text-[11px] leading-snug text-muted-foreground">
                      X converts uploaded GIFs to silent video anyway, and allows
                      far larger videos than GIFs — so this looks better there
                      and is easier to fit. Discord is the opposite: it autoplays
                      and loops GIFs inline but shows a play button for video, so
                      send the GIF there.
                    </p>
                  </div>
                ) : null}
                {artIsVideo && videoFmt ? (
                  <Button
                    type="button"
                    variant="secondary"
                    className="w-full"
                    disabled={anyBusy}
                    onClick={() => void runVideo()}
                  >
                    {videoFmt.ext === "mp4"
                      ? "MP4 video (card + motion — iPhone-friendly)"
                      : "WebM video (card + motion)"}
                  </Button>
                ) : null}
                {videoProgress ? (
                  <div className="space-y-2 rounded-md border border-border/80 bg-muted/20 px-3 py-2.5">
                    <div
                      className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
                      role="progressbar"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={
                        videoProgress.fraction == null
                          ? undefined
                          : Math.round(videoProgress.fraction * 100)
                      }
                      aria-label="Video export progress"
                    >
                      <div
                        className="h-full rounded-full bg-[var(--tc-accent)] transition-[width] duration-200"
                        style={{
                          width: `${Math.round((videoProgress.fraction ?? 0) * 100)}%`,
                        }}
                      />
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <p
                        className="text-[11px] leading-snug text-muted-foreground"
                        role="status"
                        aria-live="polite"
                      >
                        {videoProgressLabel(videoProgress)}
                      </p>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 shrink-0 px-2 text-[11px]"
                        onClick={() => videoAbortRef.current?.abort()}
                      >
                        Cancel
                      </Button>
                    </div>
                    <p className="text-[11px] leading-snug text-muted-foreground">
                      Keep this screen open until the export finishes.
                    </p>
                  </div>
                ) : null}
                {artIsVideo && !videoFmt ? (
                  <p className="rounded-md border border-amber-900/40 bg-amber-950/20 px-3 py-2 text-center text-[11px] text-amber-200/90">
                    This browser cannot record MP4 or WebM from the canvas, so
                    animated card export is unavailable here.
                  </p>
                ) : null}
                <p className="text-center text-[11px] text-muted-foreground">
                  Stills use one frame for video/GIF art. GIF export replays GIF
                  art inside the card; video export keeps motion and includes the
                  source clip&apos;s audio when present (MP4 on Safari/iPhone when
                  supported, WebM on many desktops).
                </p>

                <p className="pt-2 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                  Original media
                </p>
                {showOriginalDownload && (
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    disabled={anyBusy}
                    onClick={() =>
                      void run("Original download", () =>
                        downloadOriginalMedia(row),
                      )
                    }
                  >
                    {kind === "gif"
                      ? "Download source GIF only (no card frame)"
                      : kind === "video"
                        ? "Download source video only (no card frame)"
                        : "Download source image only (no card frame)"}
                  </Button>
                )}

                {shareOk && (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full border-[var(--tc-accent)]/40 text-[var(--tc-accent-hover)] hover:bg-[color-mix(in_srgb,var(--tc-accent)_12%,transparent)] hover:text-[var(--tc-accent-hover)]"
                      disabled={anyBusy}
                      onClick={() =>
                        void (async () => {
                          primeExportFolderWriteFromUserGesture();
                          setBusy(true);
                          setNote(null);
                          try {
                            const ok = await shareCompositedPng(
                              row,
                              compositedOpts,
                            );
                            setNote(
                              ok
                                ? "Share completed."
                                : "Sharing PNG is not available here.",
                            );
                          } catch (e) {
                            setNote(
                              e instanceof Error ? e.message : String(e),
                            );
                          } finally {
                            setBusy(false);
                          }
                        })
                      }
                    >
                      Share card PNG…
                    </Button>
                    {showOriginalShare && (
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full border-[var(--tc-accent)]/40 text-[var(--tc-accent-hover)] hover:bg-[color-mix(in_srgb,var(--tc-accent)_12%,transparent)] hover:text-[var(--tc-accent-hover)]"
                        disabled={anyBusy}
                        onClick={() =>
                          void (async () => {
                            setBusy(true);
                            setNote(null);
                            try {
                              const ok = await shareOriginalMedia(row);
                              setNote(
                                ok
                                  ? "Share completed."
                                  : "Sharing this file type is not supported.",
                              );
                            } catch (e) {
                              setNote(
                                e instanceof Error ? e.message : String(e),
                              );
                            } finally {
                              setBusy(false);
                            }
                          })
                        }
                      >
                        {kind === "gif"
                          ? "Share original GIF…"
                          : kind === "video"
                            ? "Share original video…"
                            : "Share original file…"}
                      </Button>
                    )}
                  </>
                )}

                {!shareOk && (
                  <p className="text-center text-xs text-muted-foreground">
                    Web Share (files) is not available in this browser — use
                    downloads.
                  </p>
                )}
              </div>

              {note ? (
                <p
                  className="text-center text-xs text-primary"
                  role="status"
                  aria-live="polite"
                >
                  {note}
                </p>
              ) : null}
            </CardContent>
            <CardFooter className="items-center justify-between gap-3 border-t border-border/60 pt-6">
              <p className="text-[11px] leading-snug text-muted-foreground">
                Exports leave this device. Your host never sees them; apps you
                share to might.
              </p>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setOpen(false)}
              >
                Close
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}
    </>
  );
}
