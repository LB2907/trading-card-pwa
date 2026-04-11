"use client";

import type { CardInstance } from "@/lib/db/schema";
import { CardCanvasPreview } from "@/components/card-canvas-preview";
import { CardDomPreview } from "@/components/card-dom-preview";
import { cardMediaMode } from "@/lib/media/card-media-mode";

export function CardDetailPreview({
  instance,
  layoutJson,
}: {
  instance: CardInstance;
  layoutJson: string;
}) {
  const mode = cardMediaMode(instance);
  if (mode === "gif") {
    return (
      <CardDomPreview
        instance={instance}
        layoutJson={layoutJson}
        presentation="gif"
      />
    );
  }
  if (mode === "video") {
    return (
      <CardDomPreview
        instance={instance}
        layoutJson={layoutJson}
        presentation="video"
      />
    );
  }
  return (
    <CardCanvasPreview instance={instance} layoutJson={layoutJson} />
  );
}
