import type { TradingCardDb } from "@/lib/db/client";
import {
  cardInstances,
  cardTemplates,
  collectionEntries,
  packDefinitions,
  pullHistories,
  tcgSets,
} from "@/lib/db/schema";
import type { CloudSnapshotV1 } from "@/lib/cloud/snapshot-types";

export async function buildCloudSnapshotV1(db: TradingCardDb): Promise<CloudSnapshotV1> {
  const [sets, templates, instances, collection, packs, pulls] = await Promise.all([
    db.select().from(tcgSets),
    db.select().from(cardTemplates),
    db.select().from(cardInstances),
    db.select().from(collectionEntries),
    db.select().from(packDefinitions),
    db.select().from(pullHistories),
  ]);

  return {
    v: 1,
    exportedAt: new Date().toISOString(),
    sets,
    templates,
    instances,
    collection,
    packs,
    pulls,
  };
}
