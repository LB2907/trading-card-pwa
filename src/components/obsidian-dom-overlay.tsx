/** SVG mirror of `obsidian-motifs.ts` for the live DOM preview. */
export function ObsidianDomMotifOverlay() {
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox="0 0 250 350"
      preserveAspectRatio="none"
      aria-hidden
    >
      <g fill="#ffffff">
        <polygon points="0,0 110,0 0,105" opacity="0.05" />
        <polygon points="250,0 250,119 155,0" opacity="0.035" />
        <polygon points="0,350 100,350 0,231" opacity="0.045" />
        <polygon points="250,350 250,217 145,350" opacity="0.03" />
      </g>
      <g stroke="rgba(174,182,194,0.9)" strokeLinecap="round" fill="none">
        <line x1="45" y1="24" x2="105" y2="150" strokeWidth="0.8" opacity="0.22" />
        <line x1="175" y1="70" x2="225" y2="245" strokeWidth="0.7" opacity="0.16" />
        <line x1="25" y1="270" x2="88" y2="340" strokeWidth="0.5" opacity="0.12" />
      </g>
    </svg>
  );
}
