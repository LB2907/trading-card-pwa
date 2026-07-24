"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useReducer,
  useState,
  useSyncExternalStore,
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
import { requestPersistentStorage } from "@/lib/storage-persistence";

const DbCtx = createContext<TradingCardDb | null>(null);

const emptySubscribe = () => () => {};

function vaultIsLocked(): boolean {
  return isEncryptionEnabled() && getSessionKeyBytes() === null;
}

export function AppProviders({ children }: { children: React.ReactNode }) {
  const [db, setDb] = useState<TradingCardDb | null>(null);
  const [err, setErr] = useState<string | null>(null);
  // Re-render trigger after a successful unlock (session key appears in
  // sessionStorage, which useSyncExternalStore then re-reads).
  const [, rerender] = useReducer((x: number) => x + 1, 0);
  const locked = useSyncExternalStore(emptySubscribe, vaultIsLocked, () => false);

  useEffect(() => {
    // Fresh read, not the render value: during hydration the first effect run
    // can still see the server snapshot (unlocked) while the vault is locked.
    if (locked || vaultIsLocked()) return;
    initDatabase()
      .then((database) => {
        setDb(database);
        // Ask the browser to keep this origin's storage — iOS evicts
        // un-persisted origins, which for this app means losing the vault.
        void requestPersistentStorage();
      })
      .catch((e) => setErr(e instanceof Error ? e.message : String(e)));
  }, [locked]);

  if (locked) {
    return <VaultUnlockScreen onUnlocked={rerender} />;
  }

  // A loaded database always wins — err may be a stale artifact of an
  // init attempt that ran before the vault was unlocked.
  if (!db) {
    if (err) {
      return (
        <div className="flex min-h-screen items-center justify-center p-6 text-red-400">
          {err}
        </div>
      );
    }
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
