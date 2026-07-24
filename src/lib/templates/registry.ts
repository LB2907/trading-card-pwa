import defaultLayout from "@/lib/default-layout.json";
import templateAutumn from "@/lib/templates/autumn.json";
import templateCelestial from "@/lib/templates/celestial.json";
import templateCelestialClock from "@/lib/templates/celestial_clock.json";
import templateDuelist from "@/lib/templates/duelist.json";
import templateFloral from "@/lib/templates/floral.json";
import templateMonolineInk from "@/lib/templates/monoline_ink.json";
import templateNeonCity from "@/lib/templates/neon_city.json";
import templateTide from "@/lib/templates/tide.json";
import templatePlaneswalker from "@/lib/templates/planeswalker.json";
import templateTrainer from "@/lib/templates/trainer.json";

/** Display order for built-in templates (showcase sheet, docs). */
export const BUILTIN_TEMPLATE_IDS_ORDERED: readonly string[] = [
  "tpl_default",
  "tpl_minimal",
  "tpl_aurora",
  "tpl_arena",
  "tpl_floral",
  "tpl_celestial",
  "tpl_autumn",
  "tpl_tide",
  "tpl_celestial_clock",
  "tpl_neon_city",
  "tpl_monoline_ink",
];

/** Single source of truth for built-in templates (ids, display names, layouts). */
export const BUILTIN_TEMPLATES: readonly {
  id: string;
  name: string;
  layout: object;
}[] = [
  { id: "tpl_default", name: "Skirmish", layout: defaultLayout },
  { id: "tpl_minimal", name: "Planeswalker", layout: templatePlaneswalker },
  { id: "tpl_aurora", name: "Trainer", layout: templateTrainer },
  { id: "tpl_arena", name: "Duelist", layout: templateDuelist },
  { id: "tpl_floral", name: "Floral", layout: templateFloral },
  { id: "tpl_celestial", name: "Celestial", layout: templateCelestial },
  { id: "tpl_autumn", name: "Autumn", layout: templateAutumn },
  { id: "tpl_tide", name: "Tide", layout: templateTide },
  { id: "tpl_celestial_clock", name: "Celestial clock", layout: templateCelestialClock },
  { id: "tpl_neon_city", name: "Neon city", layout: templateNeonCity },
  { id: "tpl_monoline_ink", name: "Monoline ink", layout: templateMonolineInk },
];

/** Layout JSON for built-in template ids (instant; no DB round-trip). */
const BUILTIN_LAYOUT_JSON: Record<string, string> = Object.fromEntries(
  BUILTIN_TEMPLATES.map((t) => [t.id, JSON.stringify(t.layout)]),
);

export function layoutJsonForBuiltinTemplateId(id: string): string | null {
  return BUILTIN_LAYOUT_JSON[id] ?? null;
}

export function fallbackLayoutJsonString(): string {
  return JSON.stringify(templateDuelist);
}
