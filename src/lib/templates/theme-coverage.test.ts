import { describe, expect, it } from "vitest";
import { BUILTIN_TEMPLATES } from "@/lib/templates/registry";
import { normalizeTcgTheme } from "@/lib/tcg-theme-base";
import { parseLayout } from "@/lib/card-layout";

/**
 * Guards the "every template is its own design" invariant. A template that
 * forgets to declare a distinct theme silently renders as the default frame
 * (the exact bug found in the 2026-07-24 review for Gilded/Obsidian).
 */
describe("builtin template theme coverage", () => {
  const themes = BUILTIN_TEMPLATES.map((t) => {
    const layout = parseLayout(JSON.stringify(t.layout));
    return { id: t.id, name: t.name, theme: normalizeTcgTheme(layout.tcgTheme) };
  });

  it("every builtin declares a recognized theme (no silent fallback)", () => {
    for (const t of themes) {
      // normalizeTcgTheme round-trips a known theme; an unknown value would
      // collapse to "skirmish".
      expect(normalizeTcgTheme(t.theme)).toBe(t.theme);
    }
  });

  it("no two builtin templates share the same theme", () => {
    const seen = new Map<string, string>();
    for (const t of themes) {
      const prev = seen.get(t.theme);
      expect(
        prev,
        `${t.name} (${t.id}) shares theme "${t.theme}" with ${prev}`,
      ).toBeUndefined();
      seen.set(t.theme, t.name);
    }
  });

  it("Gilded and Obsidian are their own themes, not the skirmish default", () => {
    // Regression guard for the 2026-07-24 review finding: these two used to be
    // layout-JSON variants on `skirmish` and rendered as recolored defaults.
    const byName = new Map(themes.map((t) => [t.name, t.theme]));
    expect(byName.get("Gilded")).toBe("gilded");
    expect(byName.get("Obsidian")).toBe("obsidian");
    expect(byName.get("Skirmish")).toBe("skirmish");
  });
});
