/** SVG night-sky overlay for Celestial theme (see `celestial-motifs.ts`). */
export function CelestialDomMotifOverlay() {
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox="0 0 250 350"
      preserveAspectRatio="none"
      aria-hidden
    >
      <g opacity="0.92">
        <path
          d="M218 32 C228 28 232 38 225 42 C218 46 210 38 218 32"
          fill="rgba(255,252,235,0.85)"
          stroke="rgba(200,215,255,0.35)"
          strokeWidth="0.5"
        />
        <path
          d="M32 48 L36 56 L44 56 L38 62 L40 70 L32 65 L24 70 L26 62 L20 56 L28 56 Z"
          fill="rgba(255,248,220,0.5)"
          stroke="rgba(255,255,255,0.2)"
          strokeWidth="0.4"
        />
        <path
          d="M175 70 L178 76 L184 76 L179 80 L181 86 L175 82 L169 86 L171 80 L166 76 L172 76 Z"
          fill="rgba(220,235,255,0.45)"
        />
        <g stroke="rgba(180,200,255,0.55)" strokeWidth="0.9" fill="rgba(230,238,255,0.9)">
          <line x1="45" y1="255" x2="70" y2="235" strokeDasharray="2 3" />
          <line x1="70" y1="235" x2="95" y2="248" strokeDasharray="2 3" />
          <line x1="95" y1="248" x2="120" y2="238" strokeDasharray="2 3" />
          <circle cx="45" cy="255" r="1.6" />
          <circle cx="70" cy="235" r="1.6" />
          <circle cx="95" cy="248" r="1.6" />
          <circle cx="120" cy="238" r="1.6" />
        </g>
        <g stroke="rgba(160,190,255,0.5)" strokeWidth="0.85" fill="rgba(230,238,255,0.85)">
          <line x1="145" y1="262" x2="165" y2="248" strokeDasharray="2 3" />
          <line x1="165" y1="248" x2="190" y2="258" strokeDasharray="2 3" />
          <circle cx="145" cy="262" r="1.5" />
          <circle cx="165" cy="248" r="1.5" />
          <circle cx="190" cy="258" r="1.5" />
        </g>
        <path
          d="M22 310 L26 318 L34 318 L28 324 L30 332 L22 327 L14 332 L16 324 L10 318 L18 318 Z"
          fill="rgba(255,250,230,0.38)"
        />
        <path
          d="M228 305 L232 312 L239 312 L234 317 L236 324 L228 320 L220 324 L222 317 L217 312 L224 312 Z"
          fill="rgba(230,240,255,0.35)"
        />
      </g>
    </svg>
  );
}
