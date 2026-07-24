# Phase 0 — Data Safety Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove every data-loss path found in the 2026-07-24 audit: non-transactional snapshot restore, always-on 8 s full-DB persistence, launch-time template overwrites, and the missing guided ZIP restore.

**Architecture:** Extract persistence into a small injectable state machine (`db/persistence.ts`) so the 8 s interval only writes when dirty and can be suspended during restores. Make snapshot restore transactional (BEGIN/COMMIT/ROLLBACK on the raw sql.js handle). Guard built-in template sync behind a new `origin` column + content diff. Add a ZIP restore library (parse/validate pure, apply browser-only) and a Settings UI for it.

**Tech Stack:** sql.js + Drizzle (sql-js driver), fflate, Vitest (node env, real sql.js in tests), Next.js 16 client components.

**Branch:** `phase-0-data-safety` off `main`. Commit after each task with the `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>` trailer.

---

### Task 1: Persistence state machine (`db/persistence.ts`)

**Files:**
- Create: `src/lib/db/persistence.ts`
- Test: `src/lib/db/persistence.test.ts`
- Modify: `src/lib/db/client.ts` (wire in; delete old timer logic)

Behavior: `markDirty()` schedules a debounced (300 ms) flush. An interval tick (`intervalTick()`, called every 8 s by client.ts) flushes only when dirty. `suspend()` cancels pending flushes and blocks new ones until `resume()`. Flush failure re-marks dirty. `exportFn`/`saveFn` are injected so tests need no sql.js or IndexedDB.

- [ ] **Step 1: Write failing tests** (`src/lib/db/persistence.test.ts`)

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPersistence } from "@/lib/db/persistence";

describe("createPersistence", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  function setup(saveImpl?: () => Promise<void>) {
    const exportFn = vi.fn(() => new Uint8Array([1, 2, 3]));
    const saveFn = vi.fn(saveImpl ?? (() => Promise.resolve()));
    const p = createPersistence({ exportFn, saveFn, debounceMs: 300 });
    return { p, exportFn, saveFn };
  }

  it("debounces markDirty into one save", async () => {
    const { p, saveFn } = setup();
    p.markDirty();
    p.markDirty();
    await vi.advanceTimersByTimeAsync(299);
    expect(saveFn).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(saveFn).toHaveBeenCalledTimes(1);
  });

  it("intervalTick is a no-op when clean", async () => {
    const { p, saveFn } = setup();
    await p.intervalTick();
    expect(saveFn).not.toHaveBeenCalled();
  });

  it("intervalTick flushes when dirty", async () => {
    const { p, saveFn } = setup();
    p.markDirty(); // debounce pending, not yet fired
    await p.intervalTick();
    expect(saveFn).toHaveBeenCalledTimes(1);
    // debounce timer was cleared by the flush
    await vi.advanceTimersByTimeAsync(1000);
    expect(saveFn).toHaveBeenCalledTimes(1);
  });

  it("suspend blocks flushes; resume does not auto-flush", async () => {
    const { p, saveFn } = setup();
    p.markDirty();
    p.suspend();
    await vi.advanceTimersByTimeAsync(1000);
    await p.intervalTick();
    expect(saveFn).not.toHaveBeenCalled();
    p.resume();
    await vi.advanceTimersByTimeAsync(1000);
    expect(saveFn).not.toHaveBeenCalled(); // stays parked until next markDirty/tick
    await p.intervalTick(); // still dirty from before suspend
    expect(saveFn).toHaveBeenCalledTimes(1);
  });

  it("failed save re-marks dirty so the next tick retries", async () => {
    let fail = true;
    const { p, saveFn } = setup(() =>
      fail ? Promise.reject(new Error("boom")) : Promise.resolve(),
    );
    p.markDirty();
    await vi.advanceTimersByTimeAsync(300);
    expect(saveFn).toHaveBeenCalledTimes(1);
    fail = false;
    await p.intervalTick();
    expect(saveFn).toHaveBeenCalledTimes(2);
  });

  it("flushNow saves immediately when dirty", async () => {
    const { p, saveFn, exportFn } = setup();
    p.markDirty();
    await p.flushNow();
    expect(exportFn).toHaveBeenCalledTimes(1);
    expect(saveFn).toHaveBeenCalledWith(new Uint8Array([1, 2, 3]));
  });
});
```

- [ ] **Step 2: Run tests, verify they fail** — `npm run test` → FAIL (module not found).

- [ ] **Step 3: Implement** (`src/lib/db/persistence.ts`)

```ts
/** Dirty-flag persistence: saves only when something changed, suspendable for restores. */
export type Persistence = {
  markDirty: () => void;
  flushNow: () => Promise<void>;
  intervalTick: () => Promise<void>;
  suspend: () => void;
  resume: () => void;
  isDirty: () => boolean;
};

export function createPersistence(opts: {
  exportFn: () => Uint8Array;
  saveFn: (data: Uint8Array) => Promise<void>;
  debounceMs?: number;
}): Persistence {
  const debounceMs = opts.debounceMs ?? 300;
  let dirty = false;
  let suspended = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  function clearTimer() {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  }

  async function flush(): Promise<void> {
    if (suspended || !dirty) return;
    clearTimer();
    dirty = false;
    try {
      await opts.saveFn(opts.exportFn());
    } catch {
      dirty = true; // retried on the next tick / markDirty
    }
  }

  return {
    markDirty() {
      dirty = true;
      if (suspended) return;
      clearTimer();
      timer = setTimeout(() => {
        timer = null;
        void flush();
      }, debounceMs);
    },
    flushNow: () => flush(),
    intervalTick: () => flush(),
    suspend() {
      suspended = true;
      clearTimer();
    },
    resume() {
      suspended = false;
    },
    isDirty: () => dirty,
  };
}
```

- [ ] **Step 4: Run tests, verify pass** — `npm run test` → all green.

- [ ] **Step 5: Wire into `client.ts`.** Replace the `persistTimer` block and interval/beforeunload logic:

```ts
// remove: let persistTimer ... export function persistDatabase() {...}
import { createPersistence, type Persistence } from "./persistence";

let persistence: Persistence | null = null;

export function persistDatabase() {
  persistence?.markDirty();
}

export function getPersistence(): Persistence | null {
  return persistence;
}
```

In `initDatabase()` after `sqlDb = raw;`:

```ts
persistence = createPersistence({
  exportFn: () => raw.export(),
  saveFn: (data) => saveSqliteBlob(data),
});
```

Replace the window listeners at the bottom of `initDatabase()`:

```ts
if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", () => {
    if (persistence?.isDirty() && sqlDb) void saveSqliteBlob(sqlDb.export());
  });
  setInterval(() => {
    void persistence?.intervalTick();
  }, 8000);
}
```

- [ ] **Step 6: Verify** — `npm run lint && npm run test` green.
- [ ] **Step 7: Commit** — `git commit -m "feat: dirty-flag persistence with suspend support"`.

---

### Task 2: Transactional snapshot restore

**Files:**
- Modify: `src/lib/cloud/restore-snapshot.ts`
- Modify: caller in `src/components/cloud-account-panel.tsx` (signature change)
- Test: `src/lib/cloud/restore-snapshot.test.ts`

Signature change so the function is testable and side-effect-scoped: it receives the raw sql.js `Database` instead of reaching into module state, and no longer calls `persistDatabase()` itself — the caller suspends persistence, restores, then resumes + persists.

- [ ] **Step 1: Write failing tests** (`src/lib/cloud/restore-snapshot.test.ts`)

```ts
import initSqlJs, { type Database } from "sql.js";
import { drizzle } from "drizzle-orm/sql-js";
import { beforeEach, describe, expect, it } from "vitest";
import * as schema from "@/lib/db/schema";
import { INIT_SQL } from "@/lib/db/init-sql";
import { restoreCloudSnapshot } from "@/lib/cloud/restore-snapshot";
import type { CloudSnapshotV1 } from "@/lib/cloud/snapshot-types";

async function freshDb(): Promise<{ raw: Database; db: ReturnType<typeof drizzle<typeof schema>> }> {
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
    sets: [{ id: "set_a", name: "A", symbolAssetPath: null, rarityWeightsJson: "{}", createdAt: now }],
    templates: [{ id: "tpl_x", name: "X", layoutJson: "{}", origin: "user", createdAt: now }],
    instances: [],
    collection: [],
    packs: [],
    pulls: [],
  };
}

describe("restoreCloudSnapshot", () => {
  let raw: Database;
  let db: Awaited<ReturnType<typeof freshDb>>["db"];

  beforeEach(async () => {
    ({ raw, db } = await freshDb());
    await db.insert(schema.tcgSets).values({
      id: "set_local", name: "Local", rarityWeightsJson: "{}", createdAt: new Date(),
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
    expect(sets.map((s) => s.id)).toEqual(["set_local"]); // untouched
  });

  it("rejects a non-snapshot payload without touching data", async () => {
    await expect(restoreCloudSnapshot(db, raw, { nope: true })).rejects.toThrow(/snapshot/i);
    const sets = await db.select().from(schema.tcgSets);
    expect(sets).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run to verify failure** (signature mismatch / rollback test fails against current wipe-then-insert).

- [ ] **Step 3: Rewrite `restoreCloudSnapshot`** — keep `normalizeSnapshot` as is; replace the exported function:

```ts
import type { Database } from "sql.js";

/**
 * Atomically replace local data with the snapshot. Throws (and leaves the DB
 * untouched) on any failure. Caller is responsible for suspending persistence
 * around this call and persisting afterwards.
 */
export async function restoreCloudSnapshot(
  db: TradingCardDb,
  rawDb: Database,
  raw: unknown,
) {
  const snap = normalizeSnapshot(raw);

  rawDb.run("PRAGMA foreign_keys = OFF;");
  rawDb.run("BEGIN;");
  try {
    rawDb.run("DELETE FROM pull_histories;");
    rawDb.run("DELETE FROM collection_entries;");
    rawDb.run("DELETE FROM card_instances;");
    rawDb.run("DELETE FROM pack_definitions;");
    rawDb.run("DELETE FROM card_templates;");
    rawDb.run("DELETE FROM tcg_sets;");

    if (snap.sets.length) await db.insert(tcgSets).values(snap.sets);
    if (snap.templates.length) await db.insert(cardTemplates).values(snap.templates);
    if (snap.instances.length) await db.insert(cardInstances).values(snap.instances);
    if (snap.collection.length) await db.insert(collectionEntries).values(snap.collection);
    if (snap.packs.length) await db.insert(packDefinitions).values(snap.packs);
    if (snap.pulls.length) await db.insert(pullHistories).values(snap.pulls);

    rawDb.run("COMMIT;");
  } catch (e) {
    rawDb.run("ROLLBACK;");
    throw e;
  } finally {
    rawDb.run("PRAGMA foreign_keys = ON;");
  }
}
```

Remove the `getSqlDb`/`persistDatabase` imports from this file.

- [ ] **Step 4: Update the caller** in `cloud-account-panel.tsx` — locate the pull/restore handler and wrap:

```ts
import { getPersistence, getSqlDb, persistDatabase } from "@/lib/db/client";

const rawDb = getSqlDb();
if (!rawDb) throw new Error("Local database is not ready.");
const p = getPersistence();
p?.suspend();
try {
  await restoreCloudSnapshot(db, rawDb, payload);
} finally {
  p?.resume();
}
persistDatabase();
```

- [ ] **Step 5: Verify** — `npm run lint && npm run test` green.
- [ ] **Step 6: Commit** — `git commit -m "feat: transactional cloud snapshot restore"`.

---

### Task 3: Template `origin` column + guarded sync

**Files:**
- Modify: `src/lib/db/schema.ts`, `src/lib/db/init-sql.ts`, `src/lib/db/migrate.ts`
- Modify: `src/lib/templates/registry.ts` (add names → single source for builtin list)
- Create: `src/lib/db/template-sync.ts`
- Modify: `src/lib/db/client.ts` (use registry + new sync)
- Test: `src/lib/db/template-sync.test.ts`

- [ ] **Step 1: Schema.** `schema.ts` — add to `cardTemplates`:

```ts
origin: text("origin").notNull().default("builtin"),
```

`init-sql.ts` — add `origin TEXT NOT NULL DEFAULT 'builtin',` after `layout_json` in `card_templates`. `migrate.ts` — generalize and add the column for existing DBs:

```ts
const tplCols = tableColumns(db, "card_templates");
if (!tplCols.includes("origin")) {
  db.run("ALTER TABLE card_templates ADD COLUMN origin TEXT NOT NULL DEFAULT 'builtin'");
}
```

- [ ] **Step 2: Registry as single source.** In `registry.ts` export:

```ts
export const BUILTIN_TEMPLATES: readonly { id: string; name: string; layout: object }[] = [
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
```

Derive `BUILTIN_LAYOUT_JSON` from it; delete the duplicate list in `client.ts` and import this one.

- [ ] **Step 3: Failing tests** (`src/lib/db/template-sync.test.ts`)

```ts
import initSqlJs, { type Database } from "sql.js";
import { drizzle } from "drizzle-orm/sql-js";
import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import * as schema from "@/lib/db/schema";
import { INIT_SQL } from "@/lib/db/init-sql";
import { syncBuiltinTemplates } from "@/lib/db/template-sync";
import { BUILTIN_TEMPLATES } from "@/lib/templates/registry";

describe("syncBuiltinTemplates", () => {
  let raw: Database;
  let db: ReturnType<typeof drizzle<typeof schema>>;

  beforeEach(async () => {
    const SQL = await initSqlJs();
    raw = new SQL.Database();
    raw.run(INIT_SQL);
    db = drizzle(raw, { schema });
  });

  it("updates stale builtin rows and reports the count", async () => {
    await db.insert(schema.cardTemplates).values({
      id: "tpl_floral", name: "Old name", layoutJson: "{}",
      origin: "builtin", createdAt: new Date(),
    });
    const n = await syncBuiltinTemplates(db);
    expect(n).toBe(1);
    const [row] = await db.select().from(schema.cardTemplates)
      .where(eq(schema.cardTemplates.id, "tpl_floral"));
    expect(row.name).toBe("Floral");
    expect(row.layoutJson).toBe(JSON.stringify(
      BUILTIN_TEMPLATES.find((t) => t.id === "tpl_floral")!.layout,
    ));
  });

  it("does not touch rows a user took ownership of", async () => {
    await db.insert(schema.cardTemplates).values({
      id: "tpl_floral", name: "My floral remix", layoutJson: "{\"custom\":true}",
      origin: "user", createdAt: new Date(),
    });
    const n = await syncBuiltinTemplates(db);
    expect(n).toBe(0);
    const [row] = await db.select().from(schema.cardTemplates)
      .where(eq(schema.cardTemplates.id, "tpl_floral"));
    expect(row.name).toBe("My floral remix");
  });

  it("returns 0 when everything is already current (no write, no persist)", async () => {
    const t = BUILTIN_TEMPLATES.find((x) => x.id === "tpl_floral")!;
    await db.insert(schema.cardTemplates).values({
      id: t.id, name: t.name, layoutJson: JSON.stringify(t.layout),
      origin: "builtin", createdAt: new Date(),
    });
    expect(await syncBuiltinTemplates(db)).toBe(0);
  });
});
```

- [ ] **Step 4: Implement** (`src/lib/db/template-sync.ts`)

```ts
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
```

Note: `TradingCardDb` is a type-only import from client.ts, so no circular runtime dependency.

- [ ] **Step 5: Wire into `client.ts`** — delete the old `syncBuiltinTemplateLayouts`, and in `initDatabase()`:

```ts
await seedIfEmpty(drizzleDb);
await ensureExtraTemplates(drizzleDb);
if ((await syncBuiltinTemplates(drizzleDb)) > 0) persistDatabase();
```

(`ensureExtraTemplates` keeps its existing insert behavior but reads `BUILTIN_TEMPLATES` from the registry.)

- [ ] **Step 6: Verify** — `npm run lint && npm run test` green.
- [ ] **Step 7: Commit** — `git commit -m "feat: origin-guarded builtin template sync"`.

---

### Task 4: ZIP backup restore library

**Files:**
- Create: `src/lib/vault/restore-backup-zip.ts`
- Test: `src/lib/vault/restore-backup-zip.test.ts`

Pure parsing/validation is unit-tested; the browser-only apply step is thin glue over injected writers.

- [ ] **Step 1: Failing tests** (`src/lib/vault/restore-backup-zip.test.ts`)

```ts
import { zipSync } from "fflate";
import initSqlJs from "sql.js";
import { describe, expect, it } from "vitest";
import { INIT_SQL } from "@/lib/db/init-sql";
import {
  applyVaultBackup,
  parseVaultBackupZip,
  validateVaultSqlite,
} from "@/lib/vault/restore-backup-zip";

async function sqliteBytes(): Promise<Uint8Array> {
  const SQL = await initSqlJs();
  const raw = new SQL.Database();
  raw.run(INIT_SQL);
  const bytes = raw.export();
  raw.close();
  return bytes;
}

describe("parseVaultBackupZip", () => {
  it("extracts vault.sqlite and media files", async () => {
    const zip = zipSync({
      "vault.sqlite": await sqliteBytes(),
      "media/abc.png": new Uint8Array([9, 9]),
    });
    const parsed = parseVaultBackupZip(zip);
    expect(parsed.media.get("abc.png")).toEqual(new Uint8Array([9, 9]));
    expect(parsed.sqlite.length).toBeGreaterThan(0);
  });

  it("rejects a zip without vault.sqlite", () => {
    const zip = zipSync({ "media/a.png": new Uint8Array([1]) });
    expect(() => parseVaultBackupZip(zip)).toThrow(/vault\.sqlite/);
  });

  it("rejects a vault.sqlite that is not SQLite", () => {
    const zip = zipSync({ "vault.sqlite": new Uint8Array([1, 2, 3]) });
    expect(() => parseVaultBackupZip(zip)).toThrow(/not a sqlite/i);
  });
});

describe("validateVaultSqlite", () => {
  it("accepts a database with the expected tables", async () => {
    await expect(
      validateVaultSqlite(await sqliteBytes(), () => initSqlJs()),
    ).resolves.toBeUndefined();
  });

  it("rejects a database missing app tables", async () => {
    const SQL = await initSqlJs();
    const raw = new SQL.Database();
    raw.run("CREATE TABLE other (id TEXT);");
    const bytes = raw.export();
    raw.close();
    await expect(
      validateVaultSqlite(bytes, () => initSqlJs()),
    ).rejects.toThrow(/card_instances/);
  });
});

describe("applyVaultBackup", () => {
  it("writes media then the sqlite blob via injected writers", async () => {
    const writes: string[] = [];
    await applyVaultBackup(
      { sqlite: new Uint8Array([7]), media: new Map([["m1.png", new Uint8Array([1])]]) },
      {
        writeMedia: async (id) => { writes.push(`media:${id}`); },
        writeSqlite: async () => { writes.push("sqlite"); },
      },
    );
    expect(writes).toEqual(["media:m1.png", "sqlite"]); // sqlite last = commit point
  });
});
```

- [ ] **Step 2: Implement** (`src/lib/vault/restore-backup-zip.ts`)

```ts
import { unzipSync } from "fflate";
import type { SqlJsStatic } from "sql.js";

const SQLITE_MAGIC = "SQLite format 3 ";
const REQUIRED_TABLES = [
  "tcg_sets", "card_templates", "card_instances",
  "collection_entries", "pack_definitions", "pull_histories",
] as const;

export type ParsedVaultBackup = {
  sqlite: Uint8Array;
  media: Map<string, Uint8Array>;
};

export function parseVaultBackupZip(zipBytes: Uint8Array): ParsedVaultBackup {
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(zipBytes);
  } catch {
    throw new Error("This file is not a readable ZIP archive.");
  }
  const sqlite = entries["vault.sqlite"];
  if (!sqlite) throw new Error("Backup is missing vault.sqlite — not a vault backup ZIP.");
  const head = new TextDecoder().decode(sqlite.slice(0, 16));
  if (head !== SQLITE_MAGIC) throw new Error("vault.sqlite is not a SQLite database.");
  const media = new Map<string, Uint8Array>();
  for (const [name, data] of Object.entries(entries)) {
    if (name.startsWith("media/") && name.length > "media/".length) {
      media.set(name.slice("media/".length), data);
    }
  }
  return { sqlite, media };
}

/** Opens the backup DB and checks the app's tables exist. */
export async function validateVaultSqlite(
  sqlite: Uint8Array,
  loadSql: () => Promise<SqlJsStatic>,
): Promise<void> {
  const SQL = await loadSql();
  const raw = new SQL.Database(sqlite);
  try {
    const res = raw.exec("SELECT name FROM sqlite_master WHERE type='table'");
    const names = new Set(res.length ? res[0].values.map((v) => String(v[0])) : []);
    for (const t of REQUIRED_TABLES) {
      if (!names.has(t)) throw new Error(`Backup database is missing the ${t} table.`);
    }
  } finally {
    raw.close();
  }
}

export type VaultBackupWriters = {
  writeMedia: (id: string, data: Uint8Array) => Promise<void>;
  writeSqlite: (data: Uint8Array) => Promise<void>;
};

/** Media first, sqlite last — the sqlite write is the commit point. */
export async function applyVaultBackup(
  parsed: ParsedVaultBackup,
  writers: VaultBackupWriters,
): Promise<void> {
  for (const [id, data] of parsed.media) {
    await writers.writeMedia(id, data);
  }
  await writers.writeSqlite(parsed.sqlite);
}
```

- [ ] **Step 3: Verify** — `npm run test` green.
- [ ] **Step 4: Commit** — `git commit -m "feat: vault backup ZIP parse/validate/apply library"`.

---

### Task 5: Guided restore in Settings

**Files:**
- Create: `src/components/vault-restore-panel.tsx`
- Modify: `src/app/(main)/settings/page.tsx` (render it inside the "Local vault backup" card)

Browser flow: pick `.zip` → parse + validate → ConfirmDialog ("replaces everything on this device") → suspend persistence → write media (OPFS, IDB fallback) → write sqlite blob to IndexedDB → `window.location.reload()`.

- [ ] **Step 1: Implement the panel** (`src/components/vault-restore-panel.tsx`)

```tsx
"use client";

import { useRef, useState } from "react";
import initSqlJs from "sql.js";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { getPersistence } from "@/lib/db/client";
import { saveMediaBytes, saveSqliteBlob } from "@/lib/db/idb";
import { opfsWrite } from "@/lib/opfs";
import {
  applyVaultBackup,
  parseVaultBackupZip,
  validateVaultSqlite,
  type ParsedVaultBackup,
} from "@/lib/vault/restore-backup-zip";

async function writeMediaBlob(id: string, data: Uint8Array): Promise<void> {
  try {
    await opfsWrite(id, new Blob([new Uint8Array(data)]));
  } catch {
    await saveMediaBytes(id, data);
  }
}

export function VaultRestorePanel({ onMessage }: { onMessage: (m: string) => void }) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [pending, setPending] = useState<{ parsed: ParsedVaultBackup; fileName: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function onPick(file: File) {
    setBusy(true);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const parsed = parseVaultBackupZip(bytes);
      await validateVaultSqlite(parsed.sqlite, () =>
        initSqlJs({ locateFile: (f) => `/sqljs/${f}` }),
      );
      setPending({ parsed, fileName: file.name });
    } catch (e) {
      onMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function restoreConfirmed() {
    if (!pending) return;
    setBusy(true);
    try {
      getPersistence()?.suspend();
      await applyVaultBackup(pending.parsed, {
        writeMedia: writeMediaBlob,
        writeSqlite: saveSqliteBlob,
      });
      window.location.reload();
    } catch (e) {
      getPersistence()?.resume();
      onMessage(e instanceof Error ? e.message : String(e));
      setBusy(false);
      setPending(null);
    }
  }

  return (
    <div className="space-y-3">
      <input
        ref={fileRef}
        type="file"
        accept=".zip,application/zip"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void onPick(f);
        }}
      />
      <Button
        type="button"
        variant="outline"
        disabled={busy}
        onClick={() => fileRef.current?.click()}
      >
        {busy ? "Checking backup…" : "Restore from backup (ZIP)"}
      </Button>
      <p className="text-xs text-muted-foreground">
        Restoring replaces every card, set, pack, and media file on this device
        with the backup's contents.
      </p>
      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open && !busy) setPending(null);
        }}
        title="Restore this backup?"
        description={`Everything currently in this vault will be replaced with the contents of ${pending?.fileName ?? "the backup"} (${pending?.parsed.media.size ?? 0} media files). This cannot be undone.`}
        confirmLabel="Replace my vault"
        cancelLabel="Cancel"
        variant="danger"
        busy={busy}
        onConfirm={() => void restoreConfirmed()}
      />
    </div>
  );
}
```

(Check `confirm-dialog.tsx` props before use; adjust prop names to its actual API.)

- [ ] **Step 2: Render it** in `settings/page.tsx` inside the "Local vault backup" `CardContent`, under the download button:

```tsx
<Separator className="my-4" />
<VaultRestorePanel onMessage={setMsg} />
```

with `import { VaultRestorePanel } from "@/components/vault-restore-panel";`. Update the card description to mention restore.

- [ ] **Step 3: Verify** — `npm run lint && npm run test && npm run build` all green; launch dev server and confirm the Settings page renders the new control and rejects a non-ZIP file.
- [ ] **Step 4: Commit** — `git commit -m "feat: guided vault restore from backup ZIP in Settings"`.

---

### Task 6: Final verification

- [ ] `npm run lint` — clean
- [ ] `npm run test` — all files green (expect ~6 test files)
- [ ] `npm run build` — succeeds
- [ ] Update `README.md` restore section: replace the "manual/advanced" paragraph with the guided flow (Settings → Local vault backup → Restore from backup).
- [ ] Commit docs: `git commit -m "docs: guided restore instructions"`.
