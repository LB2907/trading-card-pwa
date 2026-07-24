"use client";

import { useRef, useState } from "react";
import initSqlJs from "sql.js";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { getPersistence } from "@/lib/db/client";
import { saveMediaBytes, saveSqliteBlob } from "@/lib/db/idb";
import { opfsWrite } from "@/lib/opfs";
import {
  applyVaultBackup,
  parseVaultBackupZip,
  validateVaultSqlite,
  type ParsedVaultBackup,
} from "@/lib/vault/restore-backup-zip";

async function writeMediaBlob(id: string, data: Uint8Array): Promise<void> {
  try {
    await opfsWrite(id, new Blob([new Uint8Array(data)]));
  } catch {
    await saveMediaBytes(id, data);
  }
}

/**
 * Guided restore from a vault backup ZIP: validate first, confirm, then
 * replace the stored database + media and reload.
 */
export function VaultRestorePanel({
  onMessage,
}: {
  onMessage: (m: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [pending, setPending] = useState<{
    parsed: ParsedVaultBackup;
    fileName: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);

  async function onPick(file: File) {
    setBusy(true);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const parsed = parseVaultBackupZip(bytes);
      await validateVaultSqlite(parsed.sqlite, () =>
        initSqlJs({ locateFile: (f) => `/sqljs/${f}` }),
      );
      setPending({ parsed, fileName: file.name });
    } catch (e) {
      onMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function restoreConfirmed() {
    if (!pending) return;
    setBusy(true);
    try {
      // Suspend auto-saves so the current DB can't overwrite the restored
      // blob between the write below and the reload.
      getPersistence()?.suspend();
      await applyVaultBackup(pending.parsed, {
        writeMedia: writeMediaBlob,
        writeSqlite: saveSqliteBlob,
      });
      window.location.reload();
    } catch (e) {
      getPersistence()?.resume();
      onMessage(e instanceof Error ? e.message : String(e));
      setBusy(false);
      setPending(null);
    }
  }

  return (
    <div className="space-y-3">
      <input
        ref={fileRef}
        type="file"
        accept=".zip,application/zip"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void onPick(f);
        }}
      />
      <Button
        type="button"
        variant="outline"
        disabled={busy}
        onClick={() => fileRef.current?.click()}
      >
        {busy ? "Checking backup…" : "Restore from backup (ZIP)"}
      </Button>
      <p className="text-xs text-muted-foreground">
        Restoring replaces every card, set, pack, and media file on this device
        with the backup&apos;s contents.
      </p>
      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open && !busy) setPending(null);
        }}
        title="Restore this backup?"
        description={`Everything currently in this vault will be replaced with the contents of ${pending?.fileName ?? "the backup"} (${pending?.parsed.media.size ?? 0} media files). This cannot be undone.`}
        confirmLabel="Replace my vault"
        cancelLabel="Cancel"
        variant="danger"
        busy={busy}
        onConfirm={() => void restoreConfirmed()}
      />
    </div>
  );
}
