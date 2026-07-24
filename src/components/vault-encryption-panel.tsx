"use client";

import { useState, useSyncExternalStore } from "react";
import { useDb } from "@/components/app-providers";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getPersistence, getSqlDb } from "@/lib/db/client";
import { saveVaultSqlite } from "@/lib/db/secure-blob";
import {
  readUserBlobStoredBytes,
  writeUserBlobStoredBytes,
} from "@/lib/media/storage";
import {
  decryptAllMedia,
  encryptAllMedia,
  type BlobStore,
} from "@/lib/vault/migrate-encryption";
import {
  disableEncryptionConfig,
  enableEncryption,
  getSessionKeyBytes,
  isEncryptionEnabled,
  lockVaultSession,
  unlockWithPin,
} from "@/lib/vault/keyring";
import { hasPinConfigured, verifyPin } from "@/lib/vault";

const emptySubscribe = () => () => {};

const browserBlobStore: BlobStore = {
  read: readUserBlobStoredBytes,
  write: writeUserBlobStoredBytes,
};

/**
 * Enable/disable at-rest encryption for the whole vault (SQLite + media).
 * Honest about what it does and does not protect.
 */
export function VaultEncryptionPanel({
  onMessage,
}: {
  onMessage: (m: string) => void;
}) {
  const db = useDb();
  const enabled = useSyncExternalStore(
    emptySubscribe,
    isEncryptionEnabled,
    () => false,
  );
  const [pin1, setPin1] = useState("");
  const [pin2, setPin2] = useState("");
  const [disablePin, setDisablePin] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [confirmEnable, setConfirmEnable] = useState(false);
  const [confirmDisable, setConfirmDisable] = useState(false);

  /** Write the current DB with whatever at-rest mode is now active. */
  async function flushDb() {
    const raw = getSqlDb();
    if (!raw) throw new Error("Database is not loaded.");
    await saveVaultSqlite(raw.export());
  }

  async function enableConfirmed() {
    setBusy(true);
    setProgress(null);
    try {
      // Legacy screen-lock PIN (if any) must match before it is replaced.
      if (hasPinConfigured() && !(await verifyPin(pin1))) {
        onMessage(
          "The PIN must match your existing screen-lock PIN. It becomes the encryption PIN.",
        );
        return;
      }
      const persistence = getPersistence();
      persistence?.suspend();
      try {
        const key = await enableEncryption(pin1);
        await encryptAllMedia(db, key, browserBlobStore, (done, total) => {
          setProgress(`Encrypting media ${done}/${total}…`);
        });
        setProgress("Encrypting database…");
        await flushDb();
      } finally {
        persistence?.resume();
      }
      setPin1("");
      setPin2("");
      onMessage(
        "Vault encrypted. You will need this PIN every time the app starts — it cannot be recovered.",
      );
    } catch (e) {
      onMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
      setProgress(null);
      setConfirmEnable(false);
    }
  }

  async function disableConfirmed() {
    setBusy(true);
    setProgress(null);
    try {
      const ok = await unlockWithPin(disablePin);
      if (!ok) {
        onMessage("Incorrect PIN — encryption stays on.");
        return;
      }
      const key = getSessionKeyBytes();
      if (!key) throw new Error("Vault key unavailable.");
      const persistence = getPersistence();
      persistence?.suspend();
      try {
        await decryptAllMedia(db, key, browserBlobStore, (done, total) => {
          setProgress(`Decrypting media ${done}/${total}…`);
        });
        setProgress("Decrypting database…");
        disableEncryptionConfig();
        await flushDb(); // encryption disabled → writes plaintext
      } finally {
        persistence?.resume();
      }
      setDisablePin("");
      onMessage("Encryption turned off — vault data is stored unencrypted again.");
    } catch (e) {
      onMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
      setProgress(null);
      setConfirmDisable(false);
    }
  }

  if (enabled) {
    return (
      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-medium">Vault encryption — on</h3>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Database and media are encrypted at rest with AES-256-GCM; the key is
            derived from your PIN (PBKDF2, 310,000 iterations) and kept only for
            this session. If you forget the PIN, this vault{" "}
            <strong className="text-foreground">cannot be recovered</strong>.
            Backup ZIPs are exported unencrypted so they can be restored anywhere.
          </p>
        </div>
        {progress ? <p className="text-xs text-muted-foreground">{progress}</p> : null}
        <div className="flex flex-wrap items-end gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => {
              lockVaultSession();
              window.location.reload();
            }}
          >
            Lock now
          </Button>
          <div className="space-y-2">
            <Label htmlFor="vault-disable-pin">PIN</Label>
            <Input
              id="vault-disable-pin"
              type="password"
              inputMode="numeric"
              placeholder="Current PIN"
              value={disablePin}
              disabled={busy}
              onChange={(e) => setDisablePin(e.target.value)}
            />
          </div>
          <Button
            type="button"
            variant="destructive"
            disabled={busy || !disablePin}
            onClick={() => setConfirmDisable(true)}
          >
            Decrypt & turn off
          </Button>
        </div>
        <ConfirmDialog
          open={confirmDisable}
          onOpenChange={(open) => {
            if (!open && !busy) setConfirmDisable(false);
          }}
          title="Turn off vault encryption?"
          description="Your database and media will be decrypted and stored readable on this device again."
          confirmLabel="Decrypt vault"
          cancelLabel="Cancel"
          variant="danger"
          busy={busy}
          onConfirm={() => void disableConfirmed()}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium">Vault encryption — off</h3>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          Encrypt the database and all media at rest with a PIN-derived key
          (AES-256-GCM). Without the PIN the data on this device is unreadable.
          There is <strong className="text-foreground">no recovery</strong> for a
          forgotten PIN.
          {hasPinConfigured()
            ? " Your existing screen-lock PIN becomes the encryption PIN — enter it below."
            : ""}
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="vault-enc-pin">PIN (min 6 characters)</Label>
          <Input
            id="vault-enc-pin"
            type="password"
            inputMode="numeric"
            placeholder="PIN"
            value={pin1}
            disabled={busy}
            onChange={(e) => setPin1(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="vault-enc-pin2">Confirm</Label>
          <Input
            id="vault-enc-pin2"
            type="password"
            inputMode="numeric"
            placeholder="Confirm PIN"
            value={pin2}
            disabled={busy}
            onChange={(e) => setPin2(e.target.value)}
          />
        </div>
      </div>
      {progress ? <p className="text-xs text-muted-foreground">{progress}</p> : null}
      <Button
        type="button"
        disabled={busy}
        onClick={() => {
          if (pin1.length < 6) {
            onMessage("Encryption PIN must be at least 6 characters.");
            return;
          }
          if (pin1 !== pin2) {
            onMessage("PINs do not match.");
            return;
          }
          setConfirmEnable(true);
        }}
      >
        {busy ? "Encrypting…" : "Encrypt vault"}
      </Button>
      <ConfirmDialog
        open={confirmEnable}
        onOpenChange={(open) => {
          if (!open && !busy) setConfirmEnable(false);
        }}
        title="Encrypt this vault?"
        description="All media and the database will be encrypted with your PIN. Every app start will require it. A forgotten PIN cannot be recovered — download a backup ZIP first if you want a plaintext copy."
        confirmLabel="Encrypt with this PIN"
        cancelLabel="Cancel"
        busy={busy}
        onConfirm={() => void enableConfirmed()}
      />
    </div>
  );
}
