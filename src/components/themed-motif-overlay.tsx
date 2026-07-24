import { AutumnDomMotifOverlay } from "@/components/autumn-dom-overlay";
import { BoudoirDomMotifOverlay } from "@/components/boudoir-dom-overlay";
import { CelestialClockDomMotifOverlay } from "@/components/celestial-clock-dom-overlay";
import { CelestialDomMotifOverlay } from "@/components/celestial-dom-overlay";
import { FloralDomMotifOverlay } from "@/components/floral-dom-overlay";
import { MonolineInkDomMotifOverlay } from "@/components/monoline-ink-dom-overlay";
import { NeonCityDomMotifOverlay } from "@/components/neon-city-dom-overlay";
import { TideDomMotifOverlay } from "@/components/tide-dom-overlay";
import type { TcgTheme } from "@/lib/tcg-theme-base";

/** Decorative SVG shell for ornate `tcgTheme`s (matches canvas motif layers). */
export function ThemedMotifOverlay({ theme }: { theme: TcgTheme }) {
  switch (theme) {
    case "floral":
      return <FloralDomMotifOverlay />;
    case "celestial":
      return <CelestialDomMotifOverlay />;
    case "autumn":
      return <AutumnDomMotifOverlay />;
    case "tide":
      return <TideDomMotifOverlay />;
    case "celestial_clock":
      return <CelestialClockDomMotifOverlay />;
    case "neon_city":
      return <NeonCityDomMotifOverlay />;
    case "monoline_ink":
      return <MonolineInkDomMotifOverlay />;
    case "boudoir":
      return <BoudoirDomMotifOverlay />;
    default:
      return null;
  }
}
