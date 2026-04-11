import type { TradingCardDb } from "@/lib/db/client";
import { getSqlDb, persistDatabase } from "@/lib/db/client";
import {
  cardInstances,
  cardTemplates,
  collectionEntries,
  packDefinitions,
  pullHistories,
  tcgSets,
} from "@/lib/db/schema";
import { isCloudSnapshotV1, type CloudSnapshotV1 } from "@/lib/cloud/snapshot-types";

function asDate(v: unknown): Date {
  if (v instanceof Date) return v;
  if (typeof v === "string" || typeof v === "number") return new Date(v);
  return new Date();
}

function normalizeSnapshot(raw: unknown): CloudSnapshotV1 {
  if (!isCloudSnapshotV1(raw)) {
    throw new Error("Invalid cloud snapshot (expected v: 1).");
  }
  return {
    v: 1,
    exportedAt: raw.exportedAt,
    sets: raw.sets.map((r) => ({
      ...r,
      createdAt: asDate((r as { createdAt?: unknown }).createdAt),
    })) as CloudSnapshotV1["sets"],
    templates: raw.templates.map((r) => ({
      ...r,
      createdAt: asDate((r as { createdAt?: unknown }).createdAt),
    })) as CloudSnapshotV1["templates"],
    instances: raw.instances.map((r) => ({
      ...r,
      createdAt: asDate((r as { createdAt?: unknown }).createdAt),
      updatedAt: asDate((r as { updatedAt?: unknown }).updatedAt),
    })) as CloudSnapshotV1["instances"],
    collection: raw.collection.map((r) => ({
      ...r,
    })) as CloudSnapshotV1["collection"],
    packs: raw.packs.map((r) => ({
      ...r,
      createdAt: asDate((r as { createdAt?: unknown }).createdAt),
    })) as CloudSnapshotV1["packs"],
    pulls: raw.pulls.map((r) => ({
      ...r,
      pulledAt: asDate((r as { pulledAt?: unknown }).pulledAt),
    })) as CloudSnapshotV1["pulls"],
  };
}

export async function restoreCloudSnapshot(db: TradingCardDb, raw: unknown) {
  const snap = normalizeSnapshot(raw);
  const rawDb = getSqlDb();
  if (!rawDb) throw new Error("Local database is not ready.");

  rawDb.run("PRAGMA foreign_keys = OFF;");
  rawDb.run("DELETE FROM pull_histories;");
  rawDb.run("DELETE FROM collection_entries;");
  rawDb.run("DELETE FROM card_instances;");
  rawDb.run("DELETE FROM pack_definitions;");
  rawDb.run("DELETE FROM card_templates;");
  rawDb.run("DELETE FROM tcg_sets;");
  rawDb.run("PRAGMA foreign_keys = ON;");

  if (snap.sets.length) await db.insert(tcgSets).values(snap.sets);
  if (snap.templates.length) await db.insert(cardTemplates).values(snap.templates);
  if (snap.instances.length) await db.insert(cardInstances).values(snap.instances);
  if (snap.collection.length) await db.insert(collectionEntries).values(snap.collection);
  if (snap.packs.length) await db.insert(packDefinitions).values(snap.packs);
  if (snap.pulls.length) await db.insert(pullHistories).values(snap.pulls);

  persistDatabase();
}
