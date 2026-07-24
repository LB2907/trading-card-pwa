"use client";

/**
 * Origin storage durability. iOS Safari (and other browsers under pressure)
 * evict un-persisted origin storage — for this local-first app that means
 * losing the entire vault (SQLite + media). We request persistent storage and
 * surface the status so the user knows their data is durable.
 */

export type StorageStatus = {
  persisted: boolean;
  /** Bytes used by this origin, or null if the browser won't estimate. */
  usage: number | null;
  /** Total quota in bytes, or null. */
  quota: number | null;
};

function storageManager():
  | (StorageManager & {
      persist?: () => Promise<boolean>;
      persisted?: () => Promise<boolean>;
      estimate?: () => Promise<{ usage?: number; quota?: number }>;
    })
  | null {
  if (typeof navigator === "undefined") return null;
  return navigator.storage ?? null;
}

/** Ask the browser to make this origin's storage persistent. Returns the resulting state. */
export async function requestPersistentStorage(): Promise<boolean> {
  const sm = storageManager();
  if (!sm?.persist) return false;
  try {
    return await sm.persist();
  } catch {
    return false;
  }
}

export async function isStoragePersisted(): Promise<boolean> {
  const sm = storageManager();
  if (!sm?.persisted) return false;
  try {
    return await sm.persisted();
  } catch {
    return false;
  }
}

export async function getStorageStatus(): Promise<StorageStatus> {
  const sm = storageManager();
  const persisted = await isStoragePersisted();
  let usage: number | null = null;
  let quota: number | null = null;
  if (sm?.estimate) {
    try {
      const est = await sm.estimate();
      usage = typeof est.usage === "number" ? est.usage : null;
      quota = typeof est.quota === "number" ? est.quota : null;
    } catch {
      /* estimate unsupported */
    }
  }
  return { persisted, usage, quota };
}

/** Human-readable bytes, e.g. 1536 → "1.5 KB", 1048576 → "1.0 MB". */
export function formatBytes(bytes: number | null): string {
  if (bytes == null || !Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i += 1;
  }
  return `${value.toFixed(1)} ${units[i]}`;
}

/** Percentage of quota used (0–100), or null when it can't be computed. */
export function usagePercent(status: StorageStatus): number | null {
  if (status.usage == null || status.quota == null || status.quota <= 0) {
    return null;
  }
  return Math.min(100, Math.round((status.usage / status.quota) * 100));
}
