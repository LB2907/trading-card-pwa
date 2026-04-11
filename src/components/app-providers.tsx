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

const DbCtx = createContext<TradingCardDb | null>(null);

export function AppProviders({ children }: { children: React.ReactNode }) {
  const [db, setDb] = useState<TradingCardDb | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    initDatabase()
      .then(setDb)
      .catch((e) => setErr(e instanceof Error ? e.message : String(e)));
  }, []);

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
