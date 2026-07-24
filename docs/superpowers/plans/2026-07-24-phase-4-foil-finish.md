# Phase 4 slice — Foil / Finish System

**Goal:** A rarity-driven metallic/holographic finish that layers over *any* of the 14 templates, baked into the canvas compositor (so it exports) and mirrored in the DOM-animated preview.

**Design:** Pure `foilFinishForTier(tier)` maps the 7-tier ladder to a finish (none ≤ uncommon, metallic at rare/super-rare, holographic at ultra/legendary, prismatic at mythic). `paintFoilFinish` composites a diagonal brushed-metal sheen (`soft-light`) plus, for holo/prismatic tiers, diagonal rainbow bands (`overlay`) and a prism highlight — all clipped to the card's rounded rect, alphas tuned to enhance not obscure. Canvas paints it just before the final outer-clip restore in `drawTradingCard`, under the watermark. DOM path adds a matching CSS gradient overlay for animated (GIF/video) cards.

**Tests:** tier→finish mapping (boundaries at common/uncommon = none, rare = metallic, ultra = holographic, mythic = prismatic); `hasFoil` boolean.

**Branch:** `phase-4-foil-finish` off `main`.

- [ ] Task 1: `src/lib/compositor/foil.ts` + test — `FoilFinish`, `foilFinishForTier`, `hasFoil`, `paintFoilFinish`.
- [ ] Task 2: wire `paintFoilFinish` into `draw-card.ts` before the outer-clip restore, using `rarityTier(instance.rarity)`.
- [ ] Task 3: `src/components/foil-overlay.tsx` CSS mirror; render in `card-dom-preview.tsx` after `ThemedMotifOverlay`.
- [ ] Task 4: verify lint/test/build; browser QA that mythic renders distinctly from common on the same art; merge + push.
