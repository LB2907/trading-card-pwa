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

/** Layout JSON for built-in template ids (instant; no DB round-trip). */
const BUILTIN_LAYOUT_JSON: Record<string, string> = {
  tpl_default: JSON.stringify(defaultLayout),
  tpl_minimal: JSON.stringify(templatePlaneswalker),
  tpl_aurora: JSON.stringify(templateTrainer),
  tpl_arena: JSON.stringify(templateDuelist),
  tpl_floral: JSON.stringify(templateFloral),
  tpl_celestial: JSON.stringify(templateCelestial),
  tpl_autumn: JSON.stringify(templateAutumn),
  tpl_tide: JSON.stringify(templateTide),
  tpl_celestial_clock: JSON.stringify(templateCelestialClock),
  tpl_neon_city: JSON.stringify(templateNeonCity),
  tpl_monoline_ink: JSON.stringify(templateMonolineInk),
};

export function layoutJsonForBuiltinTemplateId(id: string): string | null {
  return BUILTIN_LAYOUT_JSON[id] ?? null;
}

export function fallbackLayoutJsonString(): string {
  return JSON.stringify(templateDuelist);
}
