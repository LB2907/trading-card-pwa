import initSqlJs, { type Database } from "sql.js";
import { describe, expect, it } from "vitest";
import { INIT_SQL } from "@/lib/db/init-sql";
import { runSqliteMigrations } from "@/lib/db/migrate";

function columns(db: Database, table: string): string[] {
  const r = db.exec(`PRAGMA table_info(${table})`);
  if (!r.length) return [];
  const i = r[0].columns.indexOf("name");
  return r[0].values.map((row) => String(row[i >= 0 ? i : 1]));
}

/** A vault created before the rail existed: same DDL minus the new column. */
function legacyDb(SQL: Awaited<ReturnType<typeof initSqlJs>>): Database {
  const db = new SQL.Database();
  db.run(INIT_SQL.replace(/\s*credit_text TEXT NOT NULL DEFAULT '',\n/, "\n"));
  return db;
}

describe("runSqliteMigrations", () => {
  it("adds credit_text to a vault that predates the bottom rail", async () => {
    const SQL = await initSqlJs();
    const db = legacyDb(SQL);
    expect(columns(db, "card_instances")).not.toContain("credit_text");

    runSqliteMigrations(db);

    expect(columns(db, "card_instances")).toContain("credit_text");
  });

  it("defaults existing cards to an empty credit", async () => {
    const SQL = await initSqlJs();
    const db = legacyDb(SQL);
    const now = Date.now();
    db.run(
      `INSERT INTO tcg_sets (id, name, created_at) VALUES ('s1', 'Set', ${now})`,
    );
    db.run(
      `INSERT INTO card_templates (id, name, layout_json, created_at) VALUES ('t1', 'T', '{}', ${now})`,
    );
    db.run(
      `INSERT INTO card_instances (id, set_id, template_id, media_path, created_at, updated_at)
       VALUES ('c1', 's1', 't1', 'a.png', ${now}, ${now})`,
    );

    runSqliteMigrations(db);

    const r = db.exec("SELECT credit_text FROM card_instances WHERE id = 'c1'");
    expect(r[0].values[0][0]).toBe("");
  });

  it("is idempotent", async () => {
    const SQL = await initSqlJs();
    const db = legacyDb(SQL);
    runSqliteMigrations(db);
    expect(() => runSqliteMigrations(db)).not.toThrow();
    expect(
      columns(db, "card_instances").filter((c) => c === "credit_text"),
    ).toHaveLength(1);
  });

  it("leaves a fresh vault (DDL already current) untouched", async () => {
    const SQL = await initSqlJs();
    const db = new SQL.Database();
    db.run(INIT_SQL);
    expect(columns(db, "card_instances")).toContain("credit_text");
    expect(() => runSqliteMigrations(db)).not.toThrow();
  });
});
