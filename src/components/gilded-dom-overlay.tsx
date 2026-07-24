/** SVG mirror of `gilded-motifs.ts` for the live DOM preview. */
export function GildedDomMotifOverlay() {
  const rays = Array.from({ length: 13 }, (_, i) => {
    const a = (Math.PI / 12) * i;
    const cx = 125;
    const cy = -20;
    return {
      x2: cx + Math.cos(a) * 150,
      y2: cy + Math.sin(a) * 150,
      op: i % 2 === 0 ? 0.14 : 0.07,
    };
  });
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox="0 0 250 350"
      preserveAspectRatio="none"
      aria-hidden
    >
      <g stroke="rgba(212,175,55,0.9)">
        {rays.map((r, i) => (
          <line
            key={i}
            x1="125"
            y1="-20"
            x2={r.x2}
            y2={r.y2}
            strokeWidth="0.5"
            opacity={r.op}
          />
        ))}
        <line x1="30" y1="262" x2="220" y2="262" strokeWidth="1" opacity="0.3" />
        <line x1="40" y1="266" x2="210" y2="266" strokeWidth="0.6" opacity="0.16" />
      </g>
      <g stroke="rgba(212,175,55,0.9)" fill="none" opacity="0.22">
        {[9, 14, 19, 24].map((r) => (
          <path key={r} d={`M15 ${344 - r} A${r} ${r} 0 0 1 ${15 + r} 344`} strokeWidth="0.6" />
        ))}
        {[9, 14, 19, 24].map((r) => (
          <path key={`b${r}`} d={`M${235 - r} 344 A${r} ${r} 0 0 1 235 ${344 - r}`} strokeWidth="0.6" />
        ))}
      </g>
    </svg>
  );
}
