"use client";

import initSqlJs, { type Database } from "sql.js";
import { eq } from "drizzle-orm";
import { drizzle, type SQLJsDatabase } from "drizzle-orm/sql-js";
import * as schema from "./schema";
import { INIT_SQL } from "./init-sql";
import { runSqliteMigrations } from "./migrate";
import { loadSqliteBlob, saveSqliteBlob } from "./idb";
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
import { defaultRarityWeightsJson } from "@/lib/rarity-weights";
import {
  cardTemplates,
  packDefinitions,
  tcgSets,
} from "./schema";

export type TradingCardDb = SQLJsDatabase<typeof schema>;

const BUILTIN_TEMPLATES: { id: string; name: string; layout: object }[] = [
  { id: "tpl_default", name: "Skirmish", layout: defaultLayout },
  { id: "tpl_minimal", name: "Planeswalker", layout: templatePlaneswalker },
  { id: "tpl_aurora", name: "Trainer", layout: templateTrainer },
  { id: "tpl_arena", name: "Duelist", layout: templateDuelist },
  { id: "tpl_floral", name: "Floral", layout: templateFloral },
  { id: "tpl_celestial", name: "Celestial", layout: templateCelestial },
  { id: "tpl_autumn", name: "Autumn", layout: templateAutumn },
  { id: "tpl_tide", name: "Tide", layout: templateTide },
  { id: "tpl_celestial_clock", name: "Celestial clock", layout: templateCelestialClock },
  { id: "tpl_neon_city", name: "Neon city", layout: templateNeonCity },
  { id: "tpl_monoline_ink", name: "Monoline ink", layout: templateMonolineInk },
];

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

/** Refresh built-in layout JSON + labels (theme upgrades, renames). */
async function syncBuiltinTemplateLayouts(db: TradingCardDb) {
  for (const row of BUILTIN_TEMPLATES) {
    await db
      .update(cardTemplates)
      .set({
        layoutJson: JSON.stringify(row.layout),
        name: row.name,
      })
      .where(eq(cardTemplates.id, row.id));
  }
  persistDatabase();
}

let persistTimer: ReturnType<typeof setTimeout> | null = null;

export function persistDatabase() {
  if (!sqlDb) return;
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    persistTimer = null;
    const data = sqlDb!.export();
    void saveSqliteBlob(data);
  }, 300);
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

  raw.run(INIT_SQL);
  runSqliteMigrations(raw);

  drizzleDb = drizzle(raw, { schema });
  await seedIfEmpty(drizzleDb);
  await ensureExtraTemplates(drizzleDb);
  await syncBuiltinTemplateLayouts(drizzleDb);

  if (typeof window !== "undefined") {
    window.addEventListener("beforeunload", () => {
      if (sqlDb) void saveSqliteBlob(sqlDb.export());
    });
    setInterval(() => {
      if (sqlDb) void saveSqliteBlob(sqlDb.export());
    }, 8000);
  }

  return drizzleDb;
}

export function getSqlDb(): Database | null {
  return sqlDb;
}
