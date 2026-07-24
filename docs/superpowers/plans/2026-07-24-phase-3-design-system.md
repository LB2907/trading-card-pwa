# Phase 3 — "Elegant but Hot" Design System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the generic violet dashboard identity with a dark-luxe system — warm charcoal, champagne-gold + deep-rose, editorial serif display — carried through the app shell, the card chrome in both render pipelines, and a redesigned export dialog.

**Architecture:** Fonts vendored locally (`geist` npm package for UI sans; `@fontsource/fraunces` for the display serif) so builds never depend on Google Fonts. All color flows through `globals.css` tokens; no raw violet classes anywhere. Card names render in Fraunces in the DOM preview *and* the canvas compositor, with an explicit `document.fonts.load` preload before any canvas draw (iOS Safari renders fallback fonts on canvas otherwise — documented in `docs/export-watermark-ios-notes.md`). The export dialog is restructured around a primary action + format grid + privacy footnote.

**Aesthetic commitments:** near-black warm charcoal surfaces (`#0c0a09` family, not blue-zinc); champagne-gold `#c8a96a` as the single primary; deep rose `#a85e6e` as the sensual secondary (used sparingly: rarity moments, destructive-adjacent warmth); hairline gold borders at low alpha instead of gray boxes; Fraunces for h1/card names/hero moments; Geist for everything functional. No neon, no glow spam, no violet.

**Branch:** `phase-3-design-system` off `main`.

---

### Task 1: Vendored fonts
- [ ] `npm i geist @fontsource/fraunces`
- [ ] `layout.tsx`: replace `next/font/google` Geist imports with `import { GeistSans } from "geist/font/sans"` / `import { GeistMono } from "geist/font/mono"`; import Fraunces weights (`@fontsource/fraunces/600.css`, `/700.css`) in `globals.css` or layout; expose `--font-display: Fraunces, ui-serif, Georgia, serif` in `@theme`.
- [ ] Verify build shows no font download warnings.
- [ ] Commit `feat: vendor Geist + Fraunces locally`.

### Task 2: Token overhaul (palette)
- [ ] Rewrite `globals.css` `:root` + `@theme`: warm charcoal surfaces (`#0c0a09`, `#151210`, `#1c1917` family), borders `#2a2420`, gold primary `#c8a96a` (hover `#d9bd85`), rose accent `#a85e6e`, text `#f5f1ea` / muted `#a8a29e`. Remove dead light tokens. `tc-page-head h1` gets `font-family: var(--font-display)`.
- [ ] `manifest.ts` `theme_color` + `layout.tsx` viewport `themeColor` → `#c8a96a` on `#0c0a09` background.
- [ ] Sweep raw violet classes → tokens: `vault-lock-gate.tsx`, `vault-unlock-screen.tsx`, `onboarding-gate.tsx` (buttons → `tc-btn-primary` styling), `confirm-dialog.tsx` default variant, `cloud-account-panel.tsx` message styling, `card-export-panel.tsx` share buttons.
- [ ] Lint/build green; commit `feat: dark-luxe token palette, no more violet`.

### Task 3: Serif card nameplates in both pipelines
- [ ] `canvas-font.ts`: add `getCanvasFontFamilyDisplay()` (`"Fraunces", ui-serif, Georgia, serif`), `canvasFontDisplay(weight, sizePx)`, and `ensureCardFontsLoaded(sizes: number[])` — cached promise awaiting `document.fonts.load` for each needed spec; no-op server-side.
- [ ] `draw-card.ts`: name uses `canvasFontDisplay(700, layout.nameFontSize)`; measure/fit logic unchanged (metrics flow through `ctx.measureText`).
- [ ] Export + preview entrypoints await `ensureCardFontsLoaded` before drawing (`export/card-rendered-media.ts` render fns, `card-canvas-preview.tsx` effect).
- [ ] `card-dom-preview.tsx` + any DOM name row: `fontFamily: var(--font-display)`, weight 700, slight `letterSpacing: "0.01em"`.
- [ ] Lint/test/build green; commit `feat: Fraunces card nameplates in DOM and canvas pipelines`.

### Task 4: Shell polish
- [ ] `main-nav.tsx`: active = gold text + 2px gold top hairline on the item, inactive warm-muted; keep a11y attrs.
- [ ] Page headers (`collection`, `studio`, `packs`, `settings`): h1 via `tc-page-head` display serif at `text-2xl`.
- [ ] Onboarding gate restyle: display-serif title, gold CTA, refined copy layout (content unchanged).
- [ ] Lint/build green; commit `feat: shell polish — nav, headers, onboarding as brand moment`.

### Task 5: Export dialog redesign
- [ ] `card-export-panel.tsx`: title "Export card"; privacy sentence demoted to footnote; format buttons in a 2-col grid (PNG primary gold, JPEG/WebP/GIF secondary); video its own labeled row; source-only + share in an "Original media" subsection; watermark toggle stays at top; status note styled with gold tint. All colors via tokens.
- [ ] Bulk export dialog (`collection-bulk-export-dialog.tsx`): inherit tokens; check headings/progress text for violet remnants only (no structural rework).
- [ ] Lint/build green; commit `feat: export dialog restructured around format grid`.

### Task 6: Verification + QA
- [ ] `npm run lint` + `npm run test` + `npm run build` all green, no font warnings.
- [ ] Dev-server DOM QA: computed styles show Fraunces on h1 + card name; no `violet` classes anywhere in rendered DOM; export dialog structure present; canvas preview draws without error after font preload.
- [ ] Update vault roadmap note; merge to `main`, push.
