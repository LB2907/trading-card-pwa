"use client";

import { useEffect, useState } from "react";
import { parseLayout } from "@/lib/card-layout";
import {
  CARD_LAYOUT_WIDTH,
  previewPixelRatio,
} from "@/lib/compositor/card-resolution";
import { domPreviewRarityExtraShadow } from "@/lib/compositor/card-theme";
import { cardCanvasSize, drawTradingCard } from "@/lib/compositor/draw-card";
import type { CardInstance } from "@/lib/db/schema";
import { loadArtForCompositor } from "@/lib/media/compositor-source";
import { loadUserBlob } from "@/lib/media/storage";

export function CardCanvasPreview({
  instance,
  layoutJson,
}: {
  instance: CardInstance;
  layoutJson: string;
}) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const blob = await loadUserBlob(instance.mediaPath);
      if (!blob || cancelled) return;
      const { source, dispose } = await loadArtForCompositor(blob, instance);
      try {
        const layout = parseLayout(layoutJson);
        const canvas = document.createElement("canvas");
        const w = CARD_LAYOUT_WIDTH;
        const pr = previewPixelRatio();
        const { bufW, bufH, cssW } = cardCanvasSize(w, pr);
        canvas.width = bufW;
        canvas.height = bufH;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        drawTradingCard(ctx, {
          instance,
          layout,
          artImage: source,
          width: cssW,
          pixelRatio: pr,
        });
        setDataUrl(canvas.toDataURL("image/png"));
      } finally {
        dispose();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [instance, layoutJson]);

  const extra = domPreviewRarityExtraShadow(instance.rarity);
  const imgShadow = extra
    ? `0 22px 48px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05), ${extra}`
    : "0 22px 48px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05)";

  if (!dataUrl) {
    return (
      <div className="aspect-[5/7] animate-pulse rounded-2xl bg-gradient-to-b from-zinc-800/80 to-zinc-900/60 ring-1 ring-white/5" />
    );
  }
  return (
    <div
      className="rounded-2xl bg-gradient-to-br from-white/[0.12] via-white/[0.04] to-transparent p-px ring-1 ring-black/40"
      style={{ boxShadow: imgShadow }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- local data URL from canvas */}
      <img
        src={dataUrl}
        alt=""
        className="block w-full rounded-[15px] bg-zinc-950"
      />
    </div>
  );
}
