import initSqlJs, { type Database } from "sql.js";
import { drizzle } from "drizzle-orm/sql-js";
import { beforeEach, describe, expect, it } from "vitest";
import * as schema from "@/lib/db/schema";
import { INIT_SQL } from "@/lib/db/init-sql";
import { restoreCloudSnapshot } from "@/lib/cloud/restore-snapshot";
import type { CloudSnapshotV1 } from "@/lib/cloud/snapshot-types";

type Db = ReturnType<typeof drizzle<typeof schema>>;

async function freshDb(): Promise<{ raw: Database; db: Db }> {
  const SQL = await initSqlJs();
  const raw = new SQL.Database();
  raw.run(INIT_SQL);
  const db = drizzle(raw, { schema });
  return { raw, db };
}

function validSnapshot(): CloudSnapshotV1 {
  const now = new Date();
  return {
    v: 1,
    exportedAt: now.toISOString(),
    sets: [
      {
        id: "set_a",
        name: "A",
        symbolAssetPath: null,
        rarityWeightsJson: "{}",
        createdAt: now,
      },
    ],
    templates: [],
    instances: [],
    collection: [],
    packs: [],
    pulls: [],
  };
}

describe("restoreCloudSnapshot", () => {
  let raw: Database;
  let db: Db;

  beforeEach(async () => {
    ({ raw, db } = await freshDb());
    await db.insert(schema.tcgSets).values({
      id: "set_local",
      name: "Local",
      rarityWeightsJson: "{}",
      createdAt: new Date(),
    });
  });

  it("replaces local data with the snapshot", async () => {
    await restoreCloudSnapshot(db, raw, validSnapshot());
    const sets = await db.select().from(schema.tcgSets);
    expect(sets.map((s) => s.id)).toEqual(["set_a"]);
  });

  it("rolls back and keeps local data when an insert fails", async () => {
    const bad = validSnapshot();
    // duplicate primary key inside the payload forces a mid-restore failure
    bad.sets.push({ ...bad.sets[0] });
    await expect(restoreCloudSnapshot(db, raw, bad)).rejects.toThrow();
    const sets = await db.select().from(schema.tcgSets);
    expect(sets.map((s) => s.id)).toEqual(["set_local"]);
  });

  it("rejects a non-snapshot payload without touching data", async () => {
    await expect(restoreCloudSnapshot(db, raw, { nope: true })).rejects.toThrow(
      /snapshot/i,
    );
    const sets = await db.select().from(schema.tcgSets);
    expect(sets).toHaveLength(1);
  });

  it("leaves the database usable (not mid-transaction) after a rollback", async () => {
    const bad = validSnapshot();
    bad.sets.push({ ...bad.sets[0] });
    await expect(restoreCloudSnapshot(db, raw, bad)).rejects.toThrow();
    // a follow-up write must succeed
    await db.insert(schema.tcgSets).values({
      id: "set_after",
      name: "After",
      rarityWeightsJson: "{}",
      createdAt: new Date(),
    });
    const sets = await db.select().from(schema.tcgSets);
    expect(sets.map((s) => s.id).sort()).toEqual(["set_after", "set_local"]);
  });
});
