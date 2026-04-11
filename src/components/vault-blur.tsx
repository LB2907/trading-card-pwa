"use client";

import { useEffect, useState } from "react";
import { isBlurBackground } from "@/lib/vault";

export function VaultBlur({ children }: { children: React.ReactNode }) {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const onVis = () => {
      if (!isBlurBackground()) {
        setHidden(false);
        return;
      }
      setHidden(document.visibilityState !== "visible");
    };
    onVis();
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  return (
    <div className="relative min-h-0 flex-1">
      {children}
      {hidden && (
        <div
          className="pointer-events-none fixed inset-0 z-40 backdrop-blur-2xl bg-black/40"
          aria-hidden
        />
      )}
    </div>
  );
}
