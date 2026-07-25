"use client";

import { withPlaybackMime } from "@/lib/media/card-media-mode";
import { waitLoadedMetadata } from "@/lib/media/import";
import { loadUserBlob } from "@/lib/media/storage";

/**
 * Composited video export records through `MediaRecorder` on the wall clock,
 * so a batch costs the sum of the clips' own lengths. That is knowable before
 * the user commits to it, and "this will take 11 minutes" is a far more useful
 * warning than "video export is heavy".
 */

/** Reading metadata means loading each blob, so stop after a representative sample. */
const MAX_DURATION_PROBES = 30;

async function videoDurationSeconds(mediaPath: string): Promise<number | null> {
  const blob = await loadUserBlob(mediaPath);
  if (!blob) return null;
  const url = URL.createObjectURL(withPlaybackMime(blob, mediaPath));
  const video = document.createElement("video");
  video.preload = "metadata";
  video.muted = true;
  video.src = url;
  try {
    await waitLoadedMetadata(video);
    const d = video.duration;
    return Number.isFinite(d) && d > 0 ? d : null;
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
    video.removeAttribute("src");
    video.load();
  }
}

/**
 * Rough wall-clock seconds to composite video for every given clip. Probes a
 * sample and scales by the mean, so an unreadable file or a huge collection
 * degrades the estimate rather than the dialog. Null when nothing was readable.
 */
export async function estimateCompositedVideoSeconds(
  mediaPaths: string[],
): Promise<number | null> {
  if (!mediaPaths.length) return null;
  let sum = 0;
  let measured = 0;
  for (const path of mediaPaths.slice(0, MAX_DURATION_PROBES)) {
    const seconds = await videoDurationSeconds(path);
    if (seconds != null) {
      sum += seconds;
      measured++;
    }
  }
  if (!measured) return null;
  return (sum / measured) * mediaPaths.length;
}

/** "about 3m 20s" / "about 45s" — deliberately vague, since it is an estimate. */
export function formatEstimatedDuration(seconds: number): string {
  const total = Math.max(1, Math.round(seconds));
  if (total < 60) return `about ${total}s`;
  const m = Math.floor(total / 60);
  const s = total % 60;
  return s === 0 ? `about ${m}m` : `about ${m}m ${s}s`;
}
