/** Stars + moon + zodiac arc + gears (Celestial clock). */
export function CelestialClockDomMotifOverlay() {
  const sparks = Array.from({ length: 40 }, (_, i) => {
    const x = 15 + ((i * 37) % 220);
    const y = 12 + ((i * 53) % 200);
    return <circle key={i} cx={x} cy={y} r="0.55" fill="rgba(230,240,255,0.35)" />;
  });
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox="0 0 250 350"
      preserveAspectRatio="none"
      aria-hidden
    >
      <g>{sparks}</g>
      <path
        d="M208 38 C218 34 222 44 215 48 C208 52 200 44 208 38"
        fill="rgba(255,252,235,0.75)"
        stroke="rgba(200,215,255,0.3)"
        strokeWidth="0.45"
      />
      <g fill="none" stroke="rgba(180,200,255,0.45)" strokeWidth="0.75" strokeDasharray="2 3">
        <polyline points="48,72 78,58 108,68" />
      </g>
      <circle cx="48" cy="72" r="1.3" fill="rgba(230,238,255,0.85)" />
      <circle cx="78" cy="58" r="1.3" fill="rgba(230,238,255,0.85)" />
      <circle cx="108" cy="68" r="1.3" fill="rgba(230,238,255,0.85)" />
      <path
        d="M 78 288 A 72 72 0 0 1 172 288"
        fill="none"
        stroke="rgba(190,170,115,0.3)"
        strokeWidth="0.9"
      />
      {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((i) => {
        const a = Math.PI * 1.08 + (i / 12) * Math.PI * 0.84;
        const cx = 125 + Math.cos(a) * 72;
        const cy = 288 + Math.sin(a) * 72;
        return <circle key={i} cx={cx} cy={cy} r="1.2" fill="rgba(210,195,150,0.65)" />;
      })}
      <g fill="none" stroke="rgba(195,170,110,0.42)" strokeWidth="1">
        <path d="M22 318 L26 310 L34 310 L30 302 L36 296 L28 294 L26 286 L20 292 L12 290 L16 298 L10 304 L18 306 Z" />
        <path d="M228 312 L224 304 L216 304 L220 296 L214 290 L222 288 L224 280 L230 286 L238 284 L234 292 L240 298 L232 300 Z" />
      </g>
    </svg>
  );
}
