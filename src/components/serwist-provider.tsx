"use client";

import { SerwistProvider as SerwistProviderBase } from "@serwist/turbopack/react";

export function SerwistProvider({ children }: { children: React.ReactNode }) {
  return (
    <SerwistProviderBase swUrl="/serwist/sw.js">{children}</SerwistProviderBase>
  );
}
