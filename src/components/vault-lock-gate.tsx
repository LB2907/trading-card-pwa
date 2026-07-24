"use client";

import { useState } from "react";
import {
  hasPinConfigured,
  isSessionUnlocked,
  isVaultEnabled,
  verifyPin,
} from "@/lib/vault";

export function VaultLockGate({ children }: { children: React.ReactNode }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [bypass, setBypass] = useState(false);

  const enabled = isVaultEnabled();
  const unlocked = bypass || isSessionUnlocked();

  if (!enabled || unlocked) return <>{children}</>;

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-zinc-950 px-6 text-center text-zinc-100">
      <p className="text-lg font-semibold">Vault locked</p>
      <p className="max-w-sm text-sm text-zinc-400">
        Enter your PIN to continue. Everything stays on this device.
      </p>
      {!hasPinConfigured() && (
        <p className="max-w-sm text-sm text-amber-200/90">
          No PIN saved yet — open Settings in another session or clear site
          data, then set a PIN before enabling the vault.
        </p>
      )}
      <input
        type="password"
        inputMode="numeric"
        autoComplete="one-time-code"
        placeholder="PIN"
        value={pin}
        onChange={(e) => setPin(e.target.value)}
        className="w-48 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-center"
        onKeyDown={async (e) => {
          if (e.key === "Enter") {
            setError(null);
            const ok = await verifyPin(pin);
            if (ok) setBypass(true);
            else setError("Incorrect PIN");
          }
        }}
      />
      {error && <p className="text-sm text-red-400">{error}</p>}
      <button
        type="button"
        className="rounded-lg bg-[var(--tc-btn-primary-bg)] px-4 py-2 text-sm font-medium text-[#14100b] hover:bg-[var(--tc-btn-primary-hover)]"
        onClick={async () => {
          setError(null);
          const ok = await verifyPin(pin);
          if (ok) setBypass(true);
          else setError("Incorrect PIN");
        }}
      >
        Unlock
      </button>
    </div>
  );
}
