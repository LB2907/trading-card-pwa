import type { TradingCardDb } from "@/lib/db/client";
import { packDefinitions, tcgSets } from "@/lib/db/schema";
import { defaultRarityWeightsJson } from "@/lib/rarity-weights";

/**
 * Inserts a new TCG set plus a default “Booster” pack (same as Studio “new set”).
 */
export async function createTcgSetWithStarterPack(
  db: TradingCardDb,
  displayName: string,
): Promise<{ setId: string; packId: string }> {
  const name = displayName.trim();
  if (!name) {
    throw new Error("Set name cannot be empty.");
  }
  const now = new Date();
  const setId = `set_${crypto.randomUUID()}`;
  const packId = `pack_${crypto.randomUUID()}`;
  await db.insert(tcgSets).values({
    id: setId,
    name,
    symbolAssetPath: null,
    rarityWeightsJson: defaultRarityWeightsJson(),
    createdAt: now,
  });
  await db.insert(packDefinitions).values({
    id: packId,
    setId,
    name: "Booster",
    slotsPerPack: 5,
    slotRulesJson: "{}",
    rarityWeightsJson: defaultRarityWeightsJson(),
    createdAt: now,
  });
  return { setId, packId };
}
