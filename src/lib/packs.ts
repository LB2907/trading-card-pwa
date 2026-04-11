import { eq } from "drizzle-orm";
import { persistDatabase, type TradingCardDb } from "@/lib/db/client";
import {
  cardInstances,
  collectionEntries,
  packDefinitions,
  pullHistories,
  type CardInstance,
} from "@/lib/db/schema";
import {
  parsePackWeights,
  rollRarityFromWeights,
} from "@/lib/packs/roll-rarity";

export async function openPack(
  db: TradingCardDb,
  packId: string,
): Promise<CardInstance[]> {
  const [pack] = await db
    .select()
    .from(packDefinitions)
    .where(eq(packDefinitions.id, packId))
    .limit(1);
  if (!pack) return [];

  const pool = await db
    .select()
    .from(cardInstances)
    .where(eq(cardInstances.setId, pack.setId));

  if (!pool.length) return [];

  const weights = parsePackWeights(pack.rarityWeightsJson);
  const slots = pack.slotsPerPack;
  const pulled: CardInstance[] = [];
  const rng = () => crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32;

  for (let i = 0; i < slots; i++) {
    const rarity = rollRarityFromWeights(weights, rng);
    const sub = pool.filter((c) => c.rarity === rarity);
    const from = sub.length ? sub : pool;
    pulled.push(from[Math.floor(rng() * from.length)]!);
  }

  for (const c of pulled) {
    const [existing] = await db
      .select()
      .from(collectionEntries)
      .where(eq(collectionEntries.cardInstanceId, c.id))
      .limit(1);
    if (!existing) {
      await db.insert(collectionEntries).values({
        id: crypto.randomUUID(),
        cardInstanceId: c.id,
        quantity: 1,
        favorited: false,
        tagsJson: "[]",
      });
    } else {
      await db
        .update(collectionEntries)
        .set({ quantity: existing.quantity + 1 })
        .where(eq(collectionEntries.id, existing.id));
    }
  }

  await db.insert(pullHistories).values({
    id: crypto.randomUUID(),
    packDefinitionId: pack.id,
    pulledCardIdsJson: JSON.stringify(pulled.map((p) => p.id)),
    pulledAt: new Date(),
  });

  persistDatabase();
  return pulled;
}
