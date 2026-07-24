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
      id: "tpl_floral",
      name: "Old name",
      layoutJson: "{}",
      origin: "builtin",
      createdAt: new Date(),
    });
    const n = await syncBuiltinTemplates(db);
    expect(n).toBe(1);
    const [row] = await db
      .select()
      .from(schema.cardTemplates)
      .where(eq(schema.cardTemplates.id, "tpl_floral"));
    expect(row.name).toBe("Floral");
    expect(row.layoutJson).toBe(
      JSON.stringify(BUILTIN_TEMPLATES.find((t) => t.id === "tpl_floral")!.layout),
    );
  });

  it("does not touch rows a user took ownership of", async () => {
    await db.insert(schema.cardTemplates).values({
      id: "tpl_floral",
      name: "My floral remix",
      layoutJson: '{"custom":true}',
      origin: "user",
      createdAt: new Date(),
    });
    const n = await syncBuiltinTemplates(db);
    expect(n).toBe(0);
    const [row] = await db
      .select()
      .from(schema.cardTemplates)
      .where(eq(schema.cardTemplates.id, "tpl_floral"));
    expect(row.name).toBe("My floral remix");
    expect(row.layoutJson).toBe('{"custom":true}');
  });

  it("returns 0 when everything is already current", async () => {
    const t = BUILTIN_TEMPLATES.find((x) => x.id === "tpl_floral")!;
    await db.insert(schema.cardTemplates).values({
      id: t.id,
      name: t.name,
      layoutJson: JSON.stringify(t.layout),
      origin: "builtin",
      createdAt: new Date(),
    });
    expect(await syncBuiltinTemplates(db)).toBe(0);
  });

  it("ignores builtin ids that are not present in the database", async () => {
    expect(await syncBuiltinTemplates(db)).toBe(0);
  });
});
