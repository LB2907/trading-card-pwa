"use client";

import { useEffect, useMemo, useState } from "react";
import { parseLayout } from "@/lib/card-layout";
import { rarityVisual } from "@/lib/card-visual";
import { rarityGemShort } from "@/lib/rarity";
import {
  abilityPanelStyle,
  abilityTextColor,
  domPreviewArtRoundedClass,
  domPreviewOuterRingClass,
  domPreviewRarityExtraShadow,
  domPreviewRoundedClass,
  domPreviewShellBackground,
  formatCostStat,
  formatDefenseStat,
  formatHealthStat,
  formatPowerStat,
  showHpInNameRow,
} from "@/lib/compositor/card-theme";
import type { CardInstance } from "@/lib/db/schema";
import { withPlaybackMime } from "@/lib/media/card-media-mode";
import { loadUserBlob } from "@/lib/media/storage";
import { CARD_TEXT_BAND_FLEX_WEIGHT } from "@/lib/compositor/layout-metrics";
import { ThemedMotifOverlay } from "@/components/themed-motif-overlay";
import { normalizeTcgTheme } from "@/lib/tcg-theme-base";

const ASPECT = 2.5 / 3.5;

type Props = {
  instance: CardInstance;
  layoutJson: string;
  presentation: "gif" | "video";
};

function StatChip({
  label,
  color,
  fontSize,
}: {
  label: string;
  color: string;
  fontSize: number;
}) {
  return (
    <span
      className="rounded-full bg-gradient-to-b from-white/[0.11] to-white/[0.03] px-2.5 py-0.5 font-semibold tabular-nums text-zinc-100"
      style={{
        fontSize,
        boxShadow: `inset 0 1px 0 rgba(255,255,255,0.14), inset 0 0 0 1px color-mix(in srgb, ${color} 45%, transparent), 0 1px 2px rgba(0,0,0,0.35)`,
      }}
    >
      {label}
    </span>
  );
}

/**
 * Animated GIF / native video. MIME is normalized so playback works from OPFS/IDB.
 */
export function CardDomPreview({
  instance,
  layoutJson,
  presentation,
}: Props) {
  const layout = parseLayout(layoutJson);
  const theme = normalizeTcgTheme(layout.tcgTheme);
  const [url, setUrl] = useState<string | null>(null);

  const rv = useMemo(() => rarityVisual(instance.rarity), [instance.rarity]);
  const shellBg = domPreviewShellBackground(layout);
  const outerRing = domPreviewOuterRingClass(layout);
  const roundOuter = domPreviewRoundedClass(layout);
  const roundArt = domPreviewArtRoundedClass(layout);
  const apStyle = abilityPanelStyle(theme);
  const extraShadow = domPreviewRarityExtraShadow(instance.rarity);
  const shellShadow = extraShadow
    ? `0 22px 48px rgba(0,0,0,0.52), 0 0 0 1px rgba(255,255,255,0.04), ${extraShadow}`
    : "0 22px 48px rgba(0,0,0,0.52), 0 0 0 1px rgba(255,255,255,0.04)";

  useEffect(() => {
    let objectUrl: string | null = null;
    void (async () => {
      const blob = await loadUserBlob(instance.mediaPath);
      if (!blob) return;
      const typed = withPlaybackMime(blob, instance.mediaPath);
      objectUrl = URL.createObjectURL(typed);
      setUrl(objectUrl);
    })();
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [instance.mediaPath]);

  const mat = layout.artMatColor ?? "#08080a";
  const name = instance.name.trim() || "Untitled";
  const gemShort = rarityGemShort(instance.rarity);
  const gemFontPx =
    gemShort.length >= 3 ? 6.5 : gemShort.length >= 2 ? 7.5 : 9;

  if (!url) {
    return (
      <div
        className="w-full animate-pulse rounded-xl bg-zinc-800/80"
        style={{ aspectRatio: `${ASPECT}` }}
      />
    );
  }

  return (
    <div
      className={`font-sans relative flex w-full min-h-0 flex-col overflow-hidden shadow-xl ${outerRing} ${roundOuter}`}
      style={{
        aspectRatio: `${ASPECT}`,
        boxShadow: shellShadow,
        background: shellBg,
      }}
    >
      <ThemedMotifOverlay theme={theme} />
      <div
        className={`relative mx-2 mt-2 flex min-h-0 items-center justify-center overflow-hidden ring-1 ring-white/15 ${roundArt}`}
        style={{
          flexGrow: layout.artFlex,
          flexShrink: 1,
          flexBasis: 0,
          backgroundColor: mat,
          boxShadow:
            "inset 0 1px 0 rgba(255,255,255,0.14), inset 0 -12px 24px rgba(0,0,0,0.42), 0 0 0 1px rgba(0,0,0,0.35)",
        }}
      >
        {presentation === "gif" ? (
          // eslint-disable-next-line @next/next/no-img-element -- blob URL animated GIF
          <img
            key={url}
            src={url}
            alt=""
            decoding="async"
            className="max-h-full max-w-full object-contain"
          />
        ) : (
          <video
            key={url}
            src={url}
            controls
            playsInline
            preload="metadata"
            className="max-h-full max-w-full object-contain outline-none"
          />
        )}
      </div>

      <div
        className="flex min-h-0 flex-col gap-2 overflow-y-auto overflow-x-hidden px-3 pb-4 pt-2.5 text-zinc-100 [scrollbar-width:thin]"
        style={{
          flexGrow: CARD_TEXT_BAND_FLEX_WEIGHT,
          flexShrink: 1,
          flexBasis: 0,
        }}
      >
        <div
          className={`flex items-center gap-2 rounded-xl px-2 py-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] ${
            theme === "planeswalker"
              ? "bg-gradient-to-b from-black/55 to-black/40 ring-1 ring-amber-200/30"
              : theme === "trainer"
                ? "bg-gradient-to-b from-[#274a78]/95 to-[#1a3050]/90 ring-1 ring-white/10"
                : theme === "duelist"
                  ? "bg-gradient-to-b from-[#1a0f2e]/95 to-[#10081c]/90 ring-1 ring-violet-400/25"
                  : theme === "boudoir"
                    ? "bg-gradient-to-b from-[#33192a]/95 to-[#1d0e18]/90 ring-1 ring-rose-300/25"
                  : theme === "floral"
                    ? "bg-gradient-to-b from-[#3d2230]/95 to-[#26141c]/90 ring-1 ring-rose-300/25"
                    : theme === "celestial"
                      ? "bg-gradient-to-b from-[#1a2438]/95 to-[#0f1424]/90 ring-1 ring-sky-300/22"
                      : theme === "autumn"
                        ? "bg-gradient-to-b from-[#3d2010]/95 to-[#261208]/90 ring-1 ring-amber-400/22"
                        : theme === "tide"
                          ? "bg-gradient-to-b from-[#0f2838]/95 to-[#081820]/90 ring-1 ring-cyan-300/22"
                          : theme === "celestial_clock"
                            ? "bg-gradient-to-b from-[#2a2234]/95 to-[#16101c]/90 ring-1 ring-amber-200/22"
                            : theme === "neon_city"
                              ? "bg-gradient-to-b from-[#0c1420]/95 to-[#060a10]/90 ring-1 ring-teal-400/20"
                              : theme === "monoline_ink"
                                ? "bg-gradient-to-b from-[#242018]/95 to-[#14100c]/90 ring-1 ring-stone-400/18"
                                : "bg-gradient-to-b from-white/[0.07] to-white/[0.02] ring-1 ring-white/10"
          }`}
        >
          {theme === "skirmish" ||
          theme === "floral" ||
          theme === "celestial" ||
          theme === "autumn" ||
          theme === "tide" ||
          theme === "celestial_clock" ||
          theme === "neon_city" ||
          theme === "monoline_ink" ||
          theme === "boudoir" ? (
            <div
              className="h-px w-3 shrink-0 rounded-full"
              style={{ backgroundColor: rv.primary, opacity: 0.85 }}
              aria-hidden
            />
          ) : null}
          <h2
            className="min-w-0 flex-1 break-words py-0.5 text-left font-bold leading-snug text-zinc-50 [overflow-wrap:anywhere] line-clamp-4"
            style={{
              fontSize: layout.nameFontSize,
              fontFamily: "var(--font-display)",
              letterSpacing: "0.01em",
            }}
          >
            {name}
          </h2>
          {showHpInNameRow(theme) ? (
            <span
              className="shrink-0 rounded-lg bg-gradient-to-b from-amber-200 to-amber-600 px-2.5 py-0.5 text-xs font-extrabold tabular-nums text-amber-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.35)] ring-1 ring-amber-950/25"
              style={{ fontSize: layout.statFontSize + 2 }}
            >
              HP {instance.statHealth}
            </span>
          ) : null}
          <div
            className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-0.5 font-bold uppercase leading-none text-zinc-950 shadow-[inset_0_-2px_4px_rgba(0,0,0,0.25),0_0_0_1px_rgba(255,255,255,0.25)] ring-1 ring-black/20"
            style={{
              fontSize: gemFontPx,
              background: `linear-gradient(155deg, ${rv.highlight}, ${rv.primary} 55%, color-mix(in srgb, ${rv.primary} 75%, black))`,
            }}
            aria-hidden
          >
            {gemShort}
          </div>
        </div>

        {instance.typeLine ? (
          <p
            className={`line-clamp-2 border-t border-white/[0.06] pl-6 pt-2 ${
              theme === "trainer" ? "text-slate-100" : "text-zinc-300"
            } ${theme === "trainer" ? "font-semibold italic" : "italic"}`}
            style={{
              fontSize: layout.typeFontSize,
              lineHeight: 1.35,
              fontFamily:
                theme === "trainer"
                  ? "ui-sans-serif, system-ui, sans-serif"
                  : "ui-serif, Georgia, serif",
            }}
          >
            {instance.typeLine}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-1.5 pl-6 pt-0.5">
          <StatChip
            label={formatCostStat(theme, instance.statCost)}
            color={rv.primary}
            fontSize={layout.statFontSize}
          />
          <StatChip
            label={formatPowerStat(theme, instance.statPower)}
            color={rv.primary}
            fontSize={layout.statFontSize}
          />
          <StatChip
            label={formatDefenseStat(theme, instance.statDefense)}
            color={rv.primary}
            fontSize={layout.statFontSize}
          />
          <StatChip
            label={`S${instance.statSpeed}`}
            color={rv.primary}
            fontSize={layout.statFontSize}
          />
          {!showHpInNameRow(theme) ? (
            <StatChip
              label={formatHealthStat(theme, instance.statHealth)}
              color={rv.primary}
              fontSize={layout.statFontSize}
            />
          ) : null}
          <StatChip
            label={`M${instance.statMind}`}
            color={rv.primary}
            fontSize={layout.statFontSize}
          />
        </div>

        {instance.abilityText?.trim() ? (
          <div
            className="mt-0.5 rounded-xl px-3 py-2.5 backdrop-blur-[2px]"
            style={{
              fontSize: layout.bodyFontSize,
              lineHeight: 1.45,
              background: `linear-gradient(180deg, ${apStyle.fillTop} 0%, ${apStyle.fill} 45%, ${apStyle.fillBottom} 100%)`,
              border: `1px solid ${apStyle.stroke}`,
              boxShadow: `inset 0 1px 0 ${apStyle.innerHighlight}`,
            }}
          >
            <p
              className="line-clamp-6 whitespace-pre-line [overflow-wrap:anywhere]"
              style={{ color: abilityTextColor(theme) }}
            >
              {instance.abilityText}
            </p>
          </div>
        ) : null}

        {instance.flavorText ? (
          <p
            className="line-clamp-5 whitespace-pre-line font-serif text-zinc-500/90 [overflow-wrap:anywhere]"
            style={{
              fontSize: layout.flavorFontSize,
              lineHeight: 1.35,
              fontStyle: "italic",
            }}
          >
            {instance.flavorText}
          </p>
        ) : null}
      </div>
    </div>
  );
}
