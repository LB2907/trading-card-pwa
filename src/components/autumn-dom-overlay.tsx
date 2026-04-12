/** SVG harvest overlay for Autumn theme (see `autumn-motifs.ts`). */
export function AutumnDomMotifOverlay() {
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox="0 0 250 350"
      preserveAspectRatio="none"
      aria-hidden
    >
      <g opacity="0.9">
        <path
          d="M28 308 C36 290 48 288 52 302 C48 312 40 318 28 308"
          fill="rgba(220,90,35,0.5)"
          stroke="rgba(60,20,8,0.35)"
          strokeWidth="0.5"
        />
        <path
          d="M28 308 L28 325"
          stroke="rgba(80,30,12,0.35)"
          strokeWidth="0.45"
        />
        <path
          d="M218 302 C210 285 198 288 194 302 C198 312 208 318 218 302"
          fill="rgba(200,70,28,0.48)"
          stroke="rgba(50,25,8,0.32)"
          strokeWidth="0.5"
        />
        <path
          d="M218 302 L218 322"
          stroke="rgba(60,20,8,0.3)"
          strokeWidth="0.45"
        />
        <path
          d="M105 248 C112 232 128 232 132 246 C128 258 118 262 105 248"
          fill="rgba(255,140,50,0.42)"
          stroke="rgba(80,30,10,0.28)"
          strokeWidth="0.45"
        />
        <path
          d="M18 42 C22 28 38 30 40 44 C34 52 24 50 18 42"
          fill="rgba(200,120,40,0.48)"
          stroke="rgba(50,25,8,0.3)"
          strokeWidth="0.45"
        />
        <path
          d="M232 38 C228 26 214 28 212 40 C218 50 228 48 232 38"
          fill="rgba(180,100,35,0.42)"
          stroke="rgba(45,22,8,0.28)"
          strokeWidth="0.45"
        />
        <g transform="translate(20,318)">
          <path
            d="M-6 -8 L6 -8 L4 2 L-4 2 Z"
            fill="rgba(90,55,30,0.85)"
            stroke="rgba(30,15,8,0.4)"
            strokeWidth="0.4"
          />
          <ellipse cy="12" rx="6" ry="9" fill="rgba(170,100,45,0.88)" stroke="rgba(50,25,10,0.35)" strokeWidth="0.4" />
        </g>
        <g transform="translate(230,312)">
          <path
            d="M-6 -8 L6 -8 L4 2 L-4 2 Z"
            fill="rgba(75,45,25,0.88)"
            stroke="rgba(30,15,8,0.4)"
            strokeWidth="0.4"
          />
          <ellipse cy="12" rx="5.5" ry="8.5" fill="rgba(150,85,38,0.85)" stroke="rgba(40,20,10,0.35)" strokeWidth="0.4" />
        </g>
      </g>
    </svg>
  );
}
