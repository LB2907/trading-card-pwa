import { unzipSync } from "fflate";
import type { SqlJsStatic } from "sql.js";

const SQLITE_MAGIC = "SQLite format 3";
const REQUIRED_TABLES = [
  "tcg_sets",
  "card_templates",
  "card_instances",
  "collection_entries",
  "pack_definitions",
  "pull_histories",
] as const;

export type ParsedVaultBackup = {
  sqlite: Uint8Array;
  media: Map<string, Uint8Array>;
};

/** Parse a vault backup ZIP: requires vault.sqlite, collects media/<id> entries. */
export function parseVaultBackupZip(zipBytes: Uint8Array): ParsedVaultBackup {
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(zipBytes);
  } catch {
    throw new Error("This file is not a readable ZIP archive.");
  }
  const sqlite = entries["vault.sqlite"];
  if (!sqlite) {
    throw new Error("Backup is missing vault.sqlite — not a vault backup ZIP.");
  }
  const head = new TextDecoder().decode(sqlite.slice(0, SQLITE_MAGIC.length));
  if (head !== SQLITE_MAGIC) {
    throw new Error("vault.sqlite is not a SQLite database.");
  }
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
    const names = new Set(
      res.length ? res[0].values.map((v) => String(v[0])) : [],
    );
    for (const t of REQUIRED_TABLES) {
      if (!names.has(t)) {
        throw new Error(`Backup database is missing the ${t} table.`);
      }
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
