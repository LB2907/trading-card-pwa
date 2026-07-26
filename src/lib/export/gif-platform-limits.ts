/**
 * Upload size limits for the places card GIFs actually get posted.
 *
 * Every platform here is tiered — X accepts a bigger file from desktop web than
 * from its own mobile app, Discord's ceiling depends on Nitro and server boost
 * level — so a single "fits / doesn't fit" light would be a lie. Callers get a
 * tri-state answer instead.
 *
 * Thresholds are decimal MB (10^6). Where a platform's published number is
 * ambiguous between MB and MiB, the decimal reading is the smaller one, so this
 * under-promises rather than telling someone a file will upload when it won't.
 *
 * Confirmed 2026-07-26. These drift; this table is the only place to edit.
 */

const MB = 1_000_000;

export type GifPlatformId = "x" | "discord";

export type GifPlatformTier = {
  /** Names the context this ceiling applies to, e.g. "free" or "desktop web". */
  label: string;
  maxBytes: number;
};

export type GifPlatformLimit = {
  id: GifPlatformId;
  name: string;
  /** Ascending by `maxBytes`. The first entry is the safe-anywhere ceiling. */
  tiers: GifPlatformTier[];
  /** Shown alongside the badge when it matters to the decision. */
  note?: string;
};

export const GIF_PLATFORM_LIMITS: readonly GifPlatformLimit[] = [
  {
    id: "x",
    name: "X",
    tiers: [
      { label: "mobile app", maxBytes: 5 * MB },
      { label: "desktop web", maxBytes: 15 * MB },
    ],
    note: "X re-encodes GIFs to silent MP4 on upload, so quality spent getting under this limit is partly discarded anyway.",
  },
  {
    id: "discord",
    name: "Discord",
    tiers: [
      { label: "free", maxBytes: 10 * MB },
      { label: "Nitro Basic / Boost L2", maxBytes: 50 * MB },
      { label: "Nitro", maxBytes: 500 * MB },
    ],
  },
] as const;

export type GifPlatformFitLevel =
  /** Under the strictest tier — uploads anywhere on this platform. */
  | "fits"
  /** Only a higher tier accepts it; `tierLabel` names which. */
  | "partial"
  /** Over every tier. */
  | "over";

export type GifPlatformFit = {
  id: GifPlatformId;
  name: string;
  level: GifPlatformFitLevel;
  /** The tier this file fits in, or `null` when it fits none. */
  tierLabel: string | null;
  /** Bytes still to shed to reach the next-better state; 0 when already "fits". */
  bytesOver: number;
  note?: string;
};

/** Where `bytes` lands against one platform's tiers. */
export function evaluateGifPlatformFit(
  bytes: number,
  limit: GifPlatformLimit,
): GifPlatformFit {
  const strictest = limit.tiers[0];
  const base = { id: limit.id, name: limit.name, ...(limit.note ? { note: limit.note } : {}) };

  if (bytes <= strictest.maxBytes) {
    return { ...base, level: "fits", tierLabel: strictest.label, bytesOver: 0 };
  }
  const fitting = limit.tiers.find((t) => bytes <= t.maxBytes);
  if (fitting) {
    return {
      ...base,
      level: "partial",
      tierLabel: fitting.label,
      // What it would take to reach "safe anywhere", which is the actionable number.
      bytesOver: bytes - strictest.maxBytes,
    };
  }
  const highest = limit.tiers[limit.tiers.length - 1];
  return {
    ...base,
    level: "over",
    tierLabel: null,
    bytesOver: bytes - highest.maxBytes,
  };
}

export function evaluateGifPlatformFits(bytes: number): GifPlatformFit[] {
  return GIF_PLATFORM_LIMITS.map((l) => evaluateGifPlatformFit(bytes, l));
}

/** Compact size for UI, e.g. "820 KB" / "4.7 MB". Decimal units, matching the limits. */
export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes < 1_000) return `${Math.round(bytes)} B`;
  if (bytes < MB) return `${Math.round(bytes / 1_000)} KB`;
  const mb = bytes / MB;
  return `${mb < 10 ? mb.toFixed(1) : Math.round(mb)} MB`;
}
