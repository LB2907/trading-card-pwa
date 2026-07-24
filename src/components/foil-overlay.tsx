import { foilFinishForTier } from "@/lib/compositor/foil";
import { rarityTier } from "@/lib/rarity";

/**
 * CSS mirror of the canvas `paintFoilFinish` for the DOM (animated GIF/video)
 * card preview, so foil shows there too. Kept static (no hover/tilt) to match
 * what the export bakes in.
 */
export function FoilOverlay({ rarity }: { rarity: string }) {
  const finish = foilFinishForTier(rarityTier(rarity));
  if (finish.kind === "none") return null;

  const s = finish.intensity;
  const holo = finish.kind === "holographic" || finish.kind === "prismatic";

  return (
    <div className="pointer-events-none absolute inset-0 z-[2] overflow-hidden">
      {/* Brushed-metal sheen — every foil tier */}
      <div
        className="absolute inset-0"
        style={{
          mixBlendMode: "soft-light",
          opacity: s,
          background:
            "linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.28) 32%, rgba(0,0,0,0.18) 46%, rgba(255,255,255,0.3) 58%, rgba(0,0,0,0.12) 72%, rgba(255,255,255,0.1) 100%)",
        }}
      />
      {holo ? (
        <div
          className="absolute inset-0"
          style={{
            mixBlendMode: "overlay",
            opacity: 0.85 * s,
            background:
              "linear-gradient(115deg, rgba(255,95,109,0.18), rgba(255,195,113,0.18), rgba(249,248,113,0.18), rgba(119,221,119,0.18), rgba(111,208,255,0.18), rgba(138,123,255,0.18), rgba(255,138,216,0.18))",
          }}
        />
      ) : null}
      {finish.kind === "prismatic" ? (
        <div
          className="absolute inset-0"
          style={{
            mixBlendMode: "color-dodge",
            background:
              "radial-gradient(120% 80% at 70% 22%, rgba(255,255,255,0.22), rgba(180,200,255,0.08) 40%, rgba(0,0,0,0) 70%)",
          }}
        />
      ) : null}
    </div>
  );
}
