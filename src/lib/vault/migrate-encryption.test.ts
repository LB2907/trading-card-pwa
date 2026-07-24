import initSqlJs from "sql.js";
import { drizzle } from "drizzle-orm/sql-js";
import { beforeEach, describe, expect, it } from "vitest";
import * as schema from "@/lib/db/schema";
import { INIT_SQL } from "@/lib/db/init-sql";
import { deriveKeyBytes, isEncryptedBlob, randomSalt } from "@/lib/vault/crypto";
import {
  collectMediaIds,
  decryptAllMedia,
  encryptAllMedia,
  type BlobStore,
} from "@/lib/vault/migrate-encryption";

type Db = ReturnType<typeof drizzle<typeof schema>>;

function mapStore(init: Record<string, Uint8Array>): {
  store: BlobStore;
  map: Map<string, Uint8Array>;
} {
  const map = new Map(Object.entries(init));
  return {
    map,
    store: {
      read: async (id) => map.get(id) ?? null,
      write: async (id, data) => {
        map.set(id, data);
      },
    },
  };
}

describe("encryption migration", () => {
  let db: Db;
  let key: Uint8Array;

  beforeEach(async () => {
    const SQL = await initSqlJs();
    const raw = new SQL.Database();
    raw.run(INIT_SQL);
    db = drizzle(raw, { schema });
    key = await deriveKeyBytes("123456", randomSalt(), 1000);

    const now = new Date();
    await db.insert(schema.tcgSets).values({
      id: "set_a",
      name: "A",
      symbolAssetPath: "sym.png",
      rarityWeightsJson: "{}",
      createdAt: now,
    });
    await db.insert(schema.cardTemplates).values({
      id: "tpl_default",
      name: "Skirmish",
      layoutJson: "{}",
      createdAt: now,
    });
    await db.insert(schema.cardInstances).values([
      {
        id: "card_1",
        setId: "set_a",
        templateId: "tpl_default",
        mediaPath: "a.png",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "card_2",
        setId: "set_a",
        templateId: "tpl_default",
        mediaPath: "b.png",
        createdAt: now,
        updatedAt: now,
      },
    ]);
  });

  it("collects card media and set symbols, deduplicated", async () => {
    const ids = await collectMediaIds(db);
    expect(ids.sort()).toEqual(["a.png", "b.png", "sym.png"]);
  });

  it("encrypts all referenced blobs and is idempotent", async () => {
    const { store, map } = mapStore({
      "a.png": new Uint8Array([1, 1]),
      "b.png": new Uint8Array([2, 2]),
      "sym.png": new Uint8Array([3, 3]),
    });
    const n = await encryptAllMedia(db, key, store);
    expect(n).toBe(3);
    for (const bytes of map.values()) expect(isEncryptedBlob(bytes)).toBe(true);
    // second run touches nothing
    expect(await encryptAllMedia(db, key, store)).toBe(0);
  });

  it("decrypts back to the original bytes", async () => {
    const { store, map } = mapStore({
      "a.png": new Uint8Array([1, 1]),
      "b.png": new Uint8Array([2, 2]),
      "sym.png": new Uint8Array([3, 3]),
    });
    await encryptAllMedia(db, key, store);
    const n = await decryptAllMedia(db, key, store);
    expect(n).toBe(3);
    expect(map.get("a.png")).toEqual(new Uint8Array([1, 1]));
    expect(map.get("sym.png")).toEqual(new Uint8Array([3, 3]));
  });

  it("skips missing blobs without throwing and reports progress", async () => {
    const { store } = mapStore({ "a.png": new Uint8Array([1]) });
    const seen: number[] = [];
    const n = await encryptAllMedia(db, key, store, (done, total) => {
      seen.push(done);
      expect(total).toBe(3);
    });
    expect(n).toBe(1);
    expect(seen.length).toBe(3);
  });
});
