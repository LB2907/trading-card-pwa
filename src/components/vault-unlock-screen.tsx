"use client";

import { useState } from "react";
import { unlockWithPin } from "@/lib/vault/keyring";

/**
 * Blocking unlock screen for encrypted vaults. The database cannot load
 * until the PIN-derived key is available, so this renders before app init.
 */
export function VaultUnlockScreen({ onUnlocked }: { onUnlocked: () => void }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function tryUnlock() {
    if (!pin || busy) return;
    setBusy(true);
    setError(null);
    try {
      const ok = await unlockWithPin(pin);
      if (ok) {
        onUnlocked();
      } else {
        setError("Incorrect PIN — the vault stays encrypted.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-zinc-950 px-6 text-center text-zinc-100">
      <p className="text-lg font-semibold">Vault locked</p>
      <p className="max-w-sm text-sm text-zinc-400">
        This vault is encrypted. Enter your PIN to decrypt it on this device.
      </p>
      <input
        type="password"
        inputMode="numeric"
        autoComplete="one-time-code"
        placeholder="PIN"
        value={pin}
        disabled={busy}
        onChange={(e) => setPin(e.target.value)}
        className="w-48 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-center"
        onKeyDown={(e) => {
          if (e.key === "Enter") void tryUnlock();
        }}
      />
      {error && <p className="text-sm text-red-400">{error}</p>}
      <button
        type="button"
        disabled={busy}
        className="rounded-lg bg-[var(--tc-btn-primary-bg)] px-4 py-2 text-sm font-medium text-[#14100b] hover:bg-[var(--tc-btn-primary-hover)] disabled:opacity-60"
        onClick={() => void tryUnlock()}
      >
        {busy ? "Unlocking…" : "Unlock"}
      </button>
      <p className="max-w-sm text-xs text-zinc-600">
        Forgot the PIN? The vault cannot be recovered without it.
      </p>
    </div>
  );
}
