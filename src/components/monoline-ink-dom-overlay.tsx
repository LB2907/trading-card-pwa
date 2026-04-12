/** Corner flourishes only (Monoline ink). */
export function MonolineInkDomMotifOverlay() {
  const stroke = "rgba(216,207,196,0.55)";
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox="0 0 250 350"
      preserveAspectRatio="none"
      aria-hidden
    >
      <g fill="none" stroke={stroke} strokeWidth="1" strokeLinecap="round" opacity="0.9">
        <path d="M8 8 Q18 6 22 18 Q14 14 8 8" />
        <path d="M242 8 Q232 6 228 18 Q236 14 242 8" />
        <path d="M8 342 Q18 344 22 332 Q14 336 8 342" />
        <path d="M242 342 Q232 344 228 332 Q236 336 242 342" />
      </g>
    </svg>
  );
}
