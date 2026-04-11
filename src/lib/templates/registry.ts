import defaultLayout from "@/lib/default-layout.json";
import templateDuelist from "@/lib/templates/duelist.json";
import templatePlaneswalker from "@/lib/templates/planeswalker.json";
import templateTrainer from "@/lib/templates/trainer.json";

/** Layout JSON for built-in template ids (instant; no DB round-trip). */
const BUILTIN_LAYOUT_JSON: Record<string, string> = {
  tpl_default: JSON.stringify(defaultLayout),
  tpl_minimal: JSON.stringify(templatePlaneswalker),
  tpl_aurora: JSON.stringify(templateTrainer),
  tpl_arena: JSON.stringify(templateDuelist),
};

export function layoutJsonForBuiltinTemplateId(id: string): string | null {
  return BUILTIN_LAYOUT_JSON[id] ?? null;
}

export function fallbackLayoutJsonString(): string {
  return JSON.stringify(templateDuelist);
}
