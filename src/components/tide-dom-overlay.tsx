/** SVG coastal overlay for Tide theme (see `tide-motifs.ts`). */
export function TideDomMotifOverlay() {
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox="0 0 250 350"
      preserveAspectRatio="none"
      aria-hidden
    >
      <g opacity="0.9">
        <path
          d="M0 285 Q62 275 125 288 T250 282"
          fill="none"
          stroke="rgba(120,190,210,0.4)"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
        <path
          d="M0 298 Q70 288 125 302 T250 295"
          fill="none"
          stroke="rgba(90,160,185,0.32)"
          strokeWidth="1.2"
          strokeLinecap="round"
        />
        <path
          d="M0 310 Q55 302 125 314 T250 308"
          fill="none"
          stroke="rgba(70,130,155,0.26)"
          strokeWidth="1"
          strokeLinecap="round"
        />
        <path
          d="M22 308 L22 295 Q38 268 52 278 Q38 288 22 308"
          fill="rgba(230,248,255,0.5)"
          stroke="rgba(60,110,130,0.38)"
          strokeWidth="0.65"
        />
        <path
          d="M228 302 L228 290 Q212 265 198 275 Q212 285 228 302"
          fill="rgba(210,240,250,0.48)"
          stroke="rgba(60,110,130,0.36)"
          strokeWidth="0.65"
        />
        {[40, 88, 140, 188].map((x, i) => (
          <circle
            key={i}
            cx={x}
            cy={278 + (i % 3) * 4}
            r="1.3"
            fill="rgba(240,255,255,0.35)"
          />
        ))}
        <path
          d="M210 38 Q225 32 235 42 Q225 48 210 38"
          fill="rgba(200,235,255,0.3)"
        />
      </g>
    </svg>
  );
}
