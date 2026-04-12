/**
 * SVG botanical overlay for floral `tcgTheme` DOM preview (mirrors canvas motifs in
 * `floral-motifs.ts`). ViewBox 250×350 matches trading-card aspect.
 */
function RoseHead(props: { fill: string; centerFill?: string; id: string }) {
  const { fill, centerFill = "rgba(90,40,52,0.55)", id } = props;
  return (
    <g>
      {[0, 72, 144, 216, 288].map((deg) => (
        <path
          key={`${id}-${deg}`}
          transform={`rotate(${deg})`}
          d="M0 0 C12 -3 11 -20 0 -26 C-11 -20 -12 -3 0 0"
          fill={fill}
          stroke="rgba(120,50,70,0.22)"
          strokeWidth="0.5"
        />
      ))}
      <circle r="5" fill={centerFill} />
      <circle r="2.2" fill="rgba(255,230,160,0.6)" />
    </g>
  );
}

function SakuraHead(props: { scale?: number; rot?: number; id: string }) {
  const { scale = 1, rot = 0, id } = props;
  return (
    <g transform={`scale(${scale}) rotate(${rot})`}>
      {[0, 72, 144, 216, 288].map((deg, i) => (
        <path
          key={`${id}-${i}`}
          transform={`rotate(${deg})`}
          d="M0 0 Q7 -8 0 -18 Q-7 -8 0 0"
          fill="rgba(255,218,230,0.52)"
          stroke="rgba(180,100,130,0.24)"
          strokeWidth="0.45"
        />
      ))}
      <circle r="3.5" fill="rgba(255,240,210,0.5)" />
    </g>
  );
}

export function FloralDomMotifOverlay() {
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox="0 0 250 350"
      preserveAspectRatio="none"
      aria-hidden
    >
      <g opacity="0.9">
        <path
          d="M5 280 Q40 250 85 325"
          fill="none"
          stroke="rgba(58,88,58,0.5)"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
        <path
          d="M20 288 C28 275 38 268 32 258 C18 268 12 282 20 288"
          fill="rgba(88,130,92,0.5)"
          stroke="rgba(32,56,36,0.35)"
          strokeWidth="0.6"
        />
        <path
          d="M45 308 C52 298 62 288 55 278 C42 290 38 302 45 308"
          fill="rgba(88,130,92,0.45)"
          stroke="rgba(32,56,36,0.3)"
          strokeWidth="0.5"
        />
        <g transform="translate(28,318) rotate(-20)">
          <RoseHead fill="rgba(232,168,195,0.5)" id="bl" />
        </g>

        <path
          d="M245 275 Q210 248 165 322"
          fill="none"
          stroke="rgba(58,88,58,0.5)"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
        <path
          d="M230 283 C222 272 212 265 218 255 C232 265 238 277 230 283"
          fill="rgba(88,130,92,0.5)"
          stroke="rgba(32,56,36,0.35)"
          strokeWidth="0.6"
        />
        <g transform="translate(222,312) rotate(24)">
          <RoseHead
            fill="rgba(220,158,188,0.48)"
            centerFill="rgba(75,38,55,0.5)"
            id="br"
          />
        </g>

        <g transform="translate(108,245)">
          <SakuraHead id="s1" />
        </g>
        <g transform="translate(132,258)">
          <SakuraHead id="s2" scale={0.78} />
        </g>
        <g transform="translate(148,238)">
          <SakuraHead id="s3" scale={0.82} rot={8} />
        </g>

        <path
          d="M118 228 Q125 248 125 262"
          fill="none"
          stroke="rgba(58,88,58,0.4)"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
        <path
          d="M116 252 C110 246 108 238 114 234 C118 242 120 248 116 252"
          fill="rgba(88,130,92,0.42)"
          stroke="rgba(32,56,36,0.28)"
          strokeWidth="0.45"
        />

        <g transform="translate(22,42)">
          <SakuraHead id="t1" scale={0.55} />
        </g>
        <g transform="translate(228,38)">
          <SakuraHead id="t2" scale={0.52} rot={12} />
        </g>
      </g>
    </svg>
  );
}
