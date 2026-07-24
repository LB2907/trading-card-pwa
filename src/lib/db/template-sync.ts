import { eq } from "drizzle-orm";
import type { TradingCardDb } from "@/lib/db/client";
import { cardTemplates } from "@/lib/db/schema";
import { BUILTIN_TEMPLATES } from "@/lib/templates/registry";

/**
 * Refresh built-in template rows (theme upgrades, renames) without touching
 * rows whose origin is not "builtin". Returns how many rows changed.
 */
export async function syncBuiltinTemplates(db: TradingCardDb): Promise<number> {
  let updated = 0;
  for (const t of BUILTIN_TEMPLATES) {
    const [row] = await db
      .select()
      .from(cardTemplates)
      .where(eq(cardTemplates.id, t.id))
      .limit(1);
    if (!row || row.origin !== "builtin") continue;
    const layoutJson = JSON.stringify(t.layout);
    if (row.layoutJson === layoutJson && row.name === t.name) continue;
    await db
      .update(cardTemplates)
      .set({ layoutJson, name: t.name })
      .where(eq(cardTemplates.id, t.id));
    updated += 1;
  }
  return updated;
}
