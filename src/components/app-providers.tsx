"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  initDatabase,
  persistDatabase,
  type TradingCardDb,
} from "@/lib/db/client";
import { OnboardingGate } from "@/components/onboarding-gate";
import { VaultBlur } from "@/components/vault-blur";
import { VaultLockGate } from "@/components/vault-lock-gate";
import { VaultUnlockScreen } from "@/components/vault-unlock-screen";
import { getSessionKeyBytes, isEncryptionEnabled } from "@/lib/vault/keyring";

const DbCtx = createContext<TradingCardDb | null>(null);

function vaultIsLocked(): boolean {
  if (typeof window === "undefined") return false;
  return isEncryptionEnabled() && getSessionKeyBytes() === null;
}

export function AppProviders({ children }: { children: React.ReactNode }) {
  const [db, setDb] = useState<TradingCardDb | null>(null);
  const [err, setErr] = useState<string | null>(null);
  // Checked once on mount (server renders unlocked=false HTML; the DB init
  // effect below only runs client-side anyway). Bumped after a successful unlock.
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    if (vaultIsLocked()) {
      setLocked(true);
      return;
    }
    initDatabase()
      .then(setDb)
      .catch((e) => setErr(e instanceof Error ? e.message : String(e)));
  }, [locked]);

  if (locked) {
    return <VaultUnlockScreen onUnlocked={() => setLocked(false)} />;
  }

  if (err) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6 text-red-400">
        {err}
      </div>
    );
  }

  if (!db) {
    return (
      <div className="flex min-h-screen items-center justify-center text-zinc-400">
        Loading local database…
      </div>
    );
  }

  return (
    <DbCtx.Provider value={db}>
      <OnboardingGate>
        <VaultLockGate>
          <VaultBlur>{children}</VaultBlur>
        </VaultLockGate>
      </OnboardingGate>
    </DbCtx.Provider>
  );
}

export function useDb() {
  const v = useContext(DbCtx);
  if (!v) throw new Error("useDb must be used inside AppProviders");
  return v;
}

export function usePersistDb() {
  return useCallback(() => persistDatabase(), []);
}
