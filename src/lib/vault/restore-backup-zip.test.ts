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

  it("rejects a file that is not a ZIP", () => {
    expect(() => parseVaultBackupZip(new Uint8Array([1, 2, 3]))).toThrow(/zip/i);
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
    await expect(validateVaultSqlite(bytes, () => initSqlJs())).rejects.toThrow(
      /tcg_sets/,
    );
  });
});

describe("applyVaultBackup", () => {
  it("writes media first, then the sqlite blob (commit point)", async () => {
    const writes: string[] = [];
    await applyVaultBackup(
      {
        sqlite: new Uint8Array([7]),
        media: new Map([["m1.png", new Uint8Array([1])]]),
      },
      {
        writeMedia: async (id) => {
          writes.push(`media:${id}`);
        },
        writeSqlite: async () => {
          writes.push("sqlite");
        },
      },
    );
    expect(writes).toEqual(["media:m1.png", "sqlite"]);
  });
});
