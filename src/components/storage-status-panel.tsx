"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  formatBytes,
  getStorageStatus,
  requestPersistentStorage,
  usagePercent,
  type StorageStatus,
} from "@/lib/storage-persistence";

export function StorageStatusPanel() {
  const [status, setStatus] = useState<StorageStatus | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setStatus(await getStorageStatus());
  }, []);

  useEffect(() => {
    // Fetch from the storage API (an external system) and set state in the
    // async callback — not synchronously in the effect body.
    let alive = true;
    getStorageStatus().then((s) => {
      if (alive) setStatus(s);
    });
    return () => {
      alive = false;
    };
  }, []);

  const pct = status ? usagePercent(status) : null;

  return (
    <div className="space-y-3">
      {status === null ? (
        <p className="text-xs text-muted-foreground">Checking storage…</p>
      ) : (
        <>
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium">Durability</span>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                status.persisted
                  ? "bg-emerald-500/15 text-emerald-300"
                  : "bg-amber-500/15 text-amber-300"
              }`}
            >
              {status.persisted ? "Persistent" : "Not persistent"}
            </span>
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {status.persisted
              ? "This browser will keep your vault even under storage pressure."
              : "Your vault could be evicted if this device runs low on storage. Install the app to your home screen and request persistence to protect it."}
          </p>

          {status.usage != null ? (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {formatBytes(status.usage)}
                  {status.quota != null ? ` of ${formatBytes(status.quota)}` : ""} used
                </span>
                {pct != null ? <span className="tabular-nums">{pct}%</span> : null}
              </div>
              {pct != null ? (
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${Math.max(2, pct)}%` }}
                  />
                </div>
              ) : null}
            </div>
          ) : null}

          {!status.persisted ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={busy}
              onClick={() => {
                setBusy(true);
                void (async () => {
                  await requestPersistentStorage();
                  await refresh();
                  setBusy(false);
                })();
              }}
            >
              {busy ? "Requesting…" : "Request persistent storage"}
            </Button>
          ) : null}
        </>
      )}
    </div>
  );
}
