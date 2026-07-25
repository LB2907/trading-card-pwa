"use client";

import { FolderOpen, Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useModalA11y } from "@/hooks/use-modal-a11y";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  downloadBlobLocally,
  getCompositedCardGifBlob,
  getCompositedCardJpegBlob,
  getCompositedCardPngBlob,
  getCompositedCardVideoBlob,
  getCompositedCardWebpBlob,
  getOriginalMediaBlob,
} from "@/lib/export-card-download";
import type { CardExportRow } from "@/lib/export/types";
import {
  buildBulkExportZip,
  type BulkExportKind,
} from "@/lib/export/bulk-export-zip";
import {
  canvasSupportsWebpExport,
  getCompositedCardVideoExportFormat,
} from "@/lib/export/card-rendered-media";
import {
  estimateCompositedVideoSeconds,
  formatEstimatedDuration,
} from "@/lib/export/video-export-estimate";
import {
  clearExportDirectory,
  getExportDirectoryLabel,
  hydrateExportDirHandleFromStorage,
  isFolderExportSupported,
  pickExportDirectory,
  primeExportFolderWriteFromUserGesture,
} from "@/lib/export-preferences";
import { cardMediaMode } from "@/lib/media/card-media-mode";
import {
  extensionFromMediaPath,
  safeFileStem,
} from "@/lib/media/media-path";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rows: CardExportRow[];
};

async function blobForKind(
  row: CardExportRow,
  k: BulkExportKind,
): Promise<{ blob: Blob; filename: string }> {
  const stem = safeFileStem(row.instance.name || "card").slice(0, 80);
  const shortId = row.instance.id.replace(/-/g, "").slice(0, 10);
  switch (k) {
    case "png": {
      const blob = await getCompositedCardPngBlob(row);
      return { blob, filename: `${stem}_${shortId}_card.png` };
    }
    case "jpeg": {
      const blob = await getCompositedCardJpegBlob(row);
      return { blob, filename: `${stem}_${shortId}_card.jpg` };
    }
    case "webp": {
      const blob = await getCompositedCardWebpBlob(row);
      return { blob, filename: `${stem}_${shortId}_card.webp` };
    }
    case "gif": {
      const blob = await getCompositedCardGifBlob(row);
      return { blob, filename: `${stem}_${shortId}_card.gif` };
    }
    case "video": {
      const blob = await getCompositedCardVideoBlob(row);
      const ext = blob.type.toLowerCase().includes("mp4") ? "mp4" : "webm";
      return { blob, filename: `${stem}_${shortId}_card.${ext}` };
    }
    case "original": {
      const blob = await getOriginalMediaBlob(row);
      const ext = extensionFromMediaPath(row.instance.mediaPath) || ".bin";
      return { blob, filename: `${stem}_${shortId}_original${ext}` };
    }
    default:
      throw new Error("Unknown export kind");
  }
}

export function CollectionBulkExportDialog({ open, onOpenChange, rows }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  useModalA11y(open, () => onOpenChange(false), panelRef);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [webpOk, setWebpOk] = useState(false);
  const [videoFmt, setVideoFmt] = useState<{ ext: "mp4" | "webm" } | null>(
    null,
  );
  const [videoEta, setVideoEta] = useState<number | null>(null);
  const [kinds, setKinds] = useState<Record<BulkExportKind, boolean>>({
    png: true,
    jpeg: false,
    webp: false,
    gif: false,
    video: false,
    original: false,
  });
  const [exportDirLabel, setExportDirLabel] = useState("");
  const folderExportSupported = isFolderExportSupported();

  const refreshDirLabel = useCallback(() => {
    setExportDirLabel(getExportDirectoryLabel());
  }, []);

  useEffect(() => {
    setWebpOk(canvasSupportsWebpExport());
    setVideoFmt(getCompositedCardVideoExportFormat());
  }, []);

  useEffect(() => {
    if (!open) return;
    refreshDirLabel();
    if (getExportDirectoryLabel()) {
      void hydrateExportDirHandleFromStorage();
    }
  }, [open, refreshDirLabel]);

  const videoArtPaths = useMemo(
    () =>
      rows
        .filter((r) => cardMediaMode(r.instance) === "video")
        .map((r) => r.instance.mediaPath),
    [rows],
  );
  const videoArtCount = videoArtPaths.length;

  // Recording is real-time, so the cost of this batch is the sum of the clips.
  // Measured only once the user actually asks for video.
  useEffect(() => {
    if (!open || !kinds.video || !videoArtCount) {
      setVideoEta(null);
      return;
    }
    let cancelled = false;
    void estimateCompositedVideoSeconds(videoArtPaths).then((seconds) => {
      if (!cancelled) setVideoEta(seconds);
    });
    return () => {
      cancelled = true;
    };
  }, [open, kinds.video, videoArtCount, videoArtPaths]);

  const selectedKinds = (Object.keys(kinds) as BulkExportKind[]).filter(
    (k) => kinds[k],
  );

  function toggle(k: BulkExportKind) {
    setKinds((prev) => ({ ...prev, [k]: !prev[k] }));
  }

  async function runZip() {
    if (!selectedKinds.length) {
      setNote("Choose at least one format.");
      return;
    }
    await hydrateExportDirHandleFromStorage();
    setBusy(true);
    setNote(null);
    setProgress("Building ZIP…");
    try {
      const { blob: zipBlob, entryCount } = await buildBulkExportZip(
        rows,
        selectedKinds,
        {
          onProgress: (d, t) => setProgress(`Packaging ${d} / ${t}…`),
        },
      );
      if (entryCount === 0) {
        setNote("Nothing was added to the ZIP (all exports failed).");
        setProgress(null);
        return;
      }
      await downloadBlobLocally(
        zipBlob,
        `cards_export_${new Date().toISOString().slice(0, 10)}.zip`,
      );
      setNote("ZIP saved (to your export folder if set, otherwise downloaded).");
    } catch (e) {
      setNote(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  async function runSequential() {
    if (!selectedKinds.length) {
      setNote("Choose at least one format.");
      return;
    }
    await hydrateExportDirHandleFromStorage();
    setBusy(true);
    setNote(null);
    const total = rows.length * selectedKinds.length;
    let ok = 0;
    let fail = 0;
    let step = 0;
    try {
      for (const row of rows) {
        for (const k of selectedKinds) {
          step++;
          setProgress(`Saving ${step} / ${total}…`);
          try {
            const { blob, filename } = await blobForKind(row, k);
            await downloadBlobLocally(blob, filename);
            ok++;
          } catch {
            fail++;
          }
          await new Promise((r) => window.setTimeout(r, 450));
        }
      }
      setNote(
        fail
          ? `Finished: ${ok} saved, ${fail} failed.`
          : `Finished: ${ok} file(s) saved to your export folder or downloaded.`,
      );
    } catch (e) {
      setNote(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  /** Must call `pickExportDirectory` synchronously from onClick (not inside `async () => {}()`). */
  function chooseExportFolder() {
    if (!folderExportSupported) return;
    setNote(null);
    void pickExportDirectory()
      .then((label) => {
        setExportDirLabel(label);
        setNote(`Export folder set to “${label}”.`);
      })
      .catch((e) => {
        setNote(e instanceof Error ? e.message : String(e));
      });
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-[2px]"
      onClick={(e) => {
        if (e.target === e.currentTarget) onOpenChange(false);
      }}
    >
      <Card
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="bulk-export-dialog-title"
        className="max-h-[90vh] w-full max-w-md overflow-y-auto border-border/80 shadow-2xl outline-none"
        tabIndex={-1}
      >
        <CardHeader className="space-y-1">
          <CardTitle id="bulk-export-dialog-title">Bulk export</CardTitle>
          <CardDescription>
            {rows.length} card{rows.length === 1 ? "" : "s"} selected. Exports
            leave this page; a chosen folder (supported browsers) receives files
            directly when permission is granted.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="rounded-lg border border-border bg-muted/30 p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-background">
                <FolderOpen className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="min-w-0 flex-1 space-y-2">
                <p className="text-sm font-medium leading-none">Export folder</p>
                <p className="text-xs text-muted-foreground">
                  {exportDirLabel
                    ? `Currently: ${exportDirLabel}`
                    : "Not set — files use the browser download bar."}
                </p>
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={!folderExportSupported || busy}
                    onClick={chooseExportFolder}
                  >
                    Choose folder…
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!exportDirLabel || busy}
                    onClick={() => {
                      clearExportDirectory();
                      refreshDirLabel();
                      setNote("Export folder cleared.");
                    }}
                  >
                    Clear
                  </Button>
                </div>
                {!folderExportSupported ? (
                  <p className="text-xs text-amber-200/90">
                    Choosing a folder needs a secure page (https) and a
                    Chromium-based browser (Chrome, Edge, Arc). Otherwise use
                    downloads, or install the PWA and try again.
                  </p>
                ) : null}
              </div>
            </div>
          </div>

          {videoArtCount > 0 && kinds.video ? (
            <p className="rounded-md border border-amber-900/40 bg-amber-950/25 px-3 py-2 text-[11px] text-amber-100/90">
              {videoArtCount} card{videoArtCount === 1 ? "" : "s"} use video art.
              Recording runs in real time, so this will take{" "}
              {videoEta == null
                ? "roughly as long as the clips themselves"
                : `${formatEstimatedDuration(videoEta)} of it`}
              {" "}with this screen open — PNG/JPEG or originals are instant.
            </p>
          ) : null}

          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Formats
            </p>
            {(
              [
                ["png", "PNG (still)"] as const,
                ["jpeg", "JPEG (still)"] as const,
                ["webp", "WebP (still)"] as const,
                ["gif", "GIF (card frame)"] as const,
                ["video", "Video (motion + frame)"] as const,
                ["original", "Original source file"] as const,
              ] as const
            ).map(([k, label]) => {
              const disabled =
                (k === "webp" && !webpOk) || (k === "video" && !videoFmt);
              return (
                <label
                  key={k}
                  className={`flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2.5 transition-colors hover:bg-muted/40 ${disabled ? "pointer-events-none opacity-45" : ""}`}
                >
                  <span className="text-sm">{label}</span>
                  <input
                    type="checkbox"
                    className="size-4 rounded border-input accent-primary"
                    checked={kinds[k]}
                    disabled={disabled || busy}
                    onChange={() => toggle(k)}
                  />
                </label>
              );
            })}
          </div>

          {progress ? (
            <p className="flex items-center justify-center gap-2 text-center text-xs text-primary">
              <Loader2 className="size-3.5 shrink-0 animate-spin" />
              {progress}
            </p>
          ) : null}
          {note ? (
            <p
              className="rounded-md border border-primary/25 bg-primary/10 px-3 py-2 text-center text-xs text-primary"
              role="status"
              aria-live="polite"
            >
              {note}
            </p>
          ) : null}
        </CardContent>
        <Separator />
        <CardFooter className="flex flex-col gap-2 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            className="w-full sm:w-auto"
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="secondary"
              className="w-full sm:w-auto"
              disabled={busy || !selectedKinds.length}
              onClick={() => {
                primeExportFolderWriteFromUserGesture();
                void runSequential();
              }}
            >
              Save each file
            </Button>
            <Button
              type="button"
              className="w-full sm:w-auto"
              disabled={busy || !selectedKinds.length}
              onClick={() => {
                primeExportFolderWriteFromUserGesture();
                void runZip();
              }}
            >
              Download ZIP
            </Button>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
