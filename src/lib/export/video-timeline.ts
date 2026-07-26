/**
 * Mapping a source clip's timeline onto the one the muxer will accept.
 *
 * A track's first packet is often near zero but is not required to be: MP4 edit
 * lists and signed composition offsets routinely put the first frame slightly
 * before zero, and container-level offsets can put it well after. mediabunny
 * reports those timestamps faithfully — "a negative starting timestamp means the
 * track's timing has been offset. Samples with a negative timestamp should not
 * be presented" — while its *output* side rejects them outright, with
 * `CanvasSource.add` throwing `timestamp must be a non-negative number` and the
 * MP4 muxer throwing `Timestamps must be non-negative`. Passing source
 * timestamps straight through therefore fails the whole export on a clip that
 * plays perfectly well everywhere else.
 *
 * So every muxed track is shifted onto a shared origin: the earliest start among
 * the tracks being written, floored at zero. One origin for video and audio
 * together, because rebasing them by different amounts would slide them out of
 * sync. Pure, so the arithmetic is testable without an encoder.
 */

/**
 * The zero point to shift a clip's timestamps onto, given the earliest start
 * among its tracks. Negative starts collapse to zero, which drops the
 * not-to-be-presented lead-in rather than trying to preserve it.
 */
export function exportTimelineOrigin(firstTimestamp: number): number {
  if (!Number.isFinite(firstTimestamp)) return 0;
  return Math.max(firstTimestamp, 0);
}

/**
 * A source timestamp expressed against the output timeline. Clamped, because the
 * sample sink deliberately yields the one frame straddling the origin so no
 * partially visible frame is lost, and that frame starts before it.
 */
export function rebaseToOrigin(timestamp: number, origin: number): number {
  return Math.max(timestamp - origin, 0);
}

/**
 * How long the exported clip will be. `computeDuration` reports an end
 * timestamp rather than a length, so an offset clip is shorter than that value
 * by the origin — without this, progress on such a clip stops short of 100 %.
 * Zero means "unknown", which callers should report as indeterminate rather than
 * dividing by.
 */
export function exportedDuration(
  sourceEndSeconds: number,
  origin: number,
): number {
  if (!Number.isFinite(sourceEndSeconds)) return 0;
  return Math.max(sourceEndSeconds - origin, 0);
}
