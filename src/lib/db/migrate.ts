import type { Database } from "sql.js";

function tableColumns(db: Database, table: string): string[] {
  const r = db.exec(`PRAGMA table_info(${table})`);
  if (!r.length || !r[0].values.length) return [];
  const nameIdx = r[0].columns.indexOf("name");
  const idx = nameIdx >= 0 ? nameIdx : 1;
  return r[0].values.map((row) => String(row[idx]));
}

/** Add columns / fixes for existing OPFS DBs (CREATE IF NOT EXISTS skips new cols). */
export function runSqliteMigrations(db: Database): void {
  const cols = tableColumns(db, "card_instances");
  const add = (name: string, sql: string) => {
    if (!cols.includes(name)) {
      db.run(sql);
      cols.push(name);
    }
  };
  add("stat_speed", "ALTER TABLE card_instances ADD COLUMN stat_speed INTEGER NOT NULL DEFAULT 0");
  add("stat_health", "ALTER TABLE card_instances ADD COLUMN stat_health INTEGER NOT NULL DEFAULT 0");
  add("stat_mind", "ALTER TABLE card_instances ADD COLUMN stat_mind INTEGER NOT NULL DEFAULT 0");
}
