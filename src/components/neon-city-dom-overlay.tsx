/** Soft skyline glow + narrow vertical accents (Neon city). */
export function NeonCityDomMotifOverlay() {
  const cols = [55, 105, 155, 195];
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox="0 0 250 350"
      preserveAspectRatio="none"
      aria-hidden
    >
      <defs>
        <radialGradient id="neonFloor" cx="50%" cy="98%" r="55%">
          <stop offset="0%" stopColor="rgba(78,205,196,0.2)" />
          <stop offset="55%" stopColor="rgba(20,40,45,0.08)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0)" />
        </radialGradient>
        <filter id="neonSoftGlow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="1.8" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <rect x="0" y="200" width="250" height="150" fill="url(#neonFloor)" opacity="0.9" />
      {cols.map((x) => (
        <line
          key={x}
          x1={x}
          y1="200"
          x2={x}
          y2="338"
          stroke="rgba(78,205,196,0.2)"
          strokeWidth="1.2"
          filter="url(#neonSoftGlow)"
        />
      ))}
      <line
        x1="20"
        y1="315"
        x2="230"
        y2="315"
        stroke="rgba(255,255,255,0.04)"
        strokeWidth="0.8"
      />
    </svg>
  );
}
