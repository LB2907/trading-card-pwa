"use client";

import initSqlJs, { type Database } from "sql.js";
import { eq } from "drizzle-orm";
import { drizzle, type SQLJsDatabase } from "drizzle-orm/sql-js";
import * as schema from "./schema";
import { INIT_SQL } from "./init-sql";
import { runSqliteMigrations } from "./migrate";
import { loadSqliteBlob, saveSqliteBlob } from "./idb";
import { createPersistence, type Persistence } from "./persistence";
import { syncBuiltinTemplates } from "./template-sync";
import { BUILTIN_TEMPLATES } from "@/lib/templates/registry";
import { defaultRarityWeightsJson } from "@/lib/rarity-weights";
import {
  cardTemplates,
  packDefinitions,
  tcgSets,
} from "./schema";

export type TradingCardDb = SQLJsDatabase<typeof schema>;

const EXTRA_TEMPLATES = BUILTIN_TEMPLATES.slice(1);

let drizzleDb: TradingCardDb | null = null;
let sqlDb: Database | null = null;

async function seedIfEmpty(db: TradingCardDb) {
  const rows = await db.select().from(tcgSets).limit(1);
  if (rows.length > 0) return;
  const now = new Date();
  await db.insert(tcgSets).values({
    id: "set_core",
    name: "Core Set",
    rarityWeightsJson: defaultRarityWeightsJson(),
    createdAt: now,
  });
  await db.insert(cardTemplates).values({
    id: BUILTIN_TEMPLATES[0].id,
    name: BUILTIN_TEMPLATES[0].name,
    layoutJson: JSON.stringify(BUILTIN_TEMPLATES[0].layout),
    createdAt: now,
  });
  await db.insert(packDefinitions).values({
    id: "pack_starter",
    setId: "set_core",
    name: "Booster",
    slotsPerPack: 5,
    slotRulesJson: "{}",
    rarityWeightsJson: defaultRarityWeightsJson(),
    createdAt: now,
  });
}

/** Register additional layouts on existing databases (Skirmish is `tpl_default`). */
async function ensureExtraTemplates(db: TradingCardDb) {
  const now = new Date();
  let added = false;
  for (const t of EXTRA_TEMPLATES) {
    const [row] = await db
      .select()
      .from(cardTemplates)
      .where(eq(cardTemplates.id, t.id))
      .limit(1);
    if (row) continue;
    await db.insert(cardTemplates).values({
      id: t.id,
      name: t.name,
      layoutJson: JSON.stringify(t.layout),
      createdAt: now,
    });
    added = true;
  }
  if (added) persistDatabase();
}

let persistence: Persistence | null = null;

export function persistDatabase() {
  persistence?.markDirty();
}

/** Suspend/resume/flush access for restore flows. Null before initDatabase. */
export function getPersistence(): Persistence | null {
  return persistence;
}

export async function initDatabase(): Promise<TradingCardDb> {
  if (drizzleDb && sqlDb) return drizzleDb;

  const SQL = await initSqlJs({
    locateFile: (file) => `/sqljs/${file}`,
  });

  const existing = await loadSqliteBlob();
  const raw = existing
    ? new SQL.Database(existing)
    : new SQL.Database();
  sqlDb = raw;
  persistence = createPersistence({
    exportFn: () => raw.export(),
    saveFn: (data) => saveSqliteBlob(data),
  });

  raw.run(INIT_SQL);
  runSqliteMigrations(raw);

  drizzleDb = drizzle(raw, { schema });
  await seedIfEmpty(drizzleDb);
  await ensureExtraTemplates(drizzleDb);
  if ((await syncBuiltinTemplates(drizzleDb)) > 0) persistDatabase();

  if (typeof window !== "undefined") {
    window.addEventListener("beforeunload", () => {
      if (persistence?.isDirty() && sqlDb) void saveSqliteBlob(sqlDb.export());
    });
    setInterval(() => {
      void persistence?.intervalTick();
    }, 8000);
  }

  return drizzleDb;
}

export function getSqlDb(): Database | null {
  return sqlDb;
}
