import { cardMediaMode, withPlaybackMime } from "@/lib/media/card-media-mode";
import { openVideoForCompositor } from "@/lib/media/import";

/** Bitmap or decoded video element for one-shot canvas compositing. */
export async function loadArtForCompositor(
  blob: Blob,
  instance: { mediaPath: string; mediaKind: string },
): Promise<{ source: CanvasImageSource; dispose: () => void }> {
  const typed = withPlaybackMime(blob, instance.mediaPath);
  if (cardMediaMode(instance) === "video") {
    const { video, dispose } = await openVideoForCompositor(typed);
    return { source: video, dispose };
  }
  const bmp = await createImageBitmap(typed);
  return {
    source: bmp,
    dispose: () => {
      bmp.close();
    },
  };
}
