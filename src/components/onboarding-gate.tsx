"use client";

import { useState, useSyncExternalStore } from "react";
import { isOnboardingDone, setOnboardingDone } from "@/lib/vault";

const emptySubscribe = () => () => {};

export function OnboardingGate({ children }: { children: React.ReactNode }) {
  const [accepted, setAccepted] = useState(false);
  // useSyncExternalStore instead of an effect: renders correctly on the very
  // first client frame (no rAF/effect delay, no blank app in background tabs)
  // while staying hydration-safe against the server-rendered HTML.
  const storedDone = useSyncExternalStore(
    emptySubscribe,
    isOnboardingDone,
    () => true,
  );
  const done = accepted || storedDone;

  if (!done) {
    return (
      <div className="flex min-h-screen flex-col justify-center gap-6 bg-zinc-950 px-6 py-12 text-zinc-100">
        <h1 className="text-2xl font-bold tracking-tight">
          Trading Card Studio
        </h1>
        <p className="max-w-lg text-zinc-300">
          This app is for adults (18+). Use only media you own or have
          permission to use. Cards, images, and edits stay in this browser
          unless you explicitly export or share.
        </p>
        <p className="max-w-lg text-sm text-zinc-500">
          By continuing you confirm you meet the age requirement and understand
          your responsibility for copyright and consent.
        </p>
        <button
          type="button"
          className="w-fit rounded-xl bg-violet-600 px-5 py-3 text-sm font-semibold text-white hover:bg-violet-500"
          onClick={() => {
            setOnboardingDone();
            setAccepted(true);
          }}
        >
          I understand — continue
        </button>
      </div>
    );
  }

  return <>{children}</>;
}
