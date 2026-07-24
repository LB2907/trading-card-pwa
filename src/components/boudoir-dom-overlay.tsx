/** SVG mirror of `boudoir-motifs.ts` for the live DOM preview. */
export function BoudoirDomMotifOverlay() {
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox="0 0 250 350"
      preserveAspectRatio="none"
      aria-hidden
    >
      <g stroke="rgba(201,138,158,0.9)" fill="none">
        <path
          d="M-12 347 C62 300, 175 356, 262 320"
          strokeWidth="1.4"
          opacity="0.3"
        />
        <path
          d="M-12 349 C62 288, 175 358, 262 308"
          strokeWidth="1.1"
          opacity="0.24"
        />
        <path
          d="M-12 351 C62 276, 175 360, 262 296"
          strokeWidth="0.8"
          opacity="0.18"
        />
        <path
          d="M0 262 a14 14 0 0 0 28 0 a14 14 0 0 0 28 0 a14 14 0 0 0 28 0 a14 14 0 0 0 28 0 a14 14 0 0 0 28 0 a14 14 0 0 0 28 0 a14 14 0 0 0 28 0 a14 14 0 0 0 28 0 a14 14 0 0 0 26 0"
          strokeWidth="0.8"
          opacity="0.22"
        />
      </g>
      <g fill="rgba(201,138,158,0.32)">
        {[0, 28, 56, 84, 112, 140, 168, 196, 224, 250].map((x) => (
          <circle key={x} cx={x} cy={270} r="0.9" />
        ))}
      </g>
      <path
        d="M225 28 a3 3 0 1 1 -5 2 a5.5 5.5 0 1 1 9 -4 a8.5 8.5 0 1 1 -14 7"
        stroke="rgba(201,138,158,0.35)"
        strokeWidth="1"
        fill="none"
      />
    </svg>
  );
}
