import { zipSync } from "fflate";
import type { TradingCardDb } from "@/lib/db/client";
import { getSqlDb } from "@/lib/db/client";
import { cardInstances, tcgSets } from "@/lib/db/schema";
import { loadUserBlob } from "@/lib/media/storage";

async function blobToU8(blob: Blob): Promise<Uint8Array> {
  return new Uint8Array(await blob.arrayBuffer());
}

/**
 * ZIP with `vault.sqlite` (current in-memory DB) plus `media/<id>` for referenced blobs.
 */
export async function buildVaultBackupZip(db: TradingCardDb): Promise<Blob> {
  const sql = getSqlDb();
  if (!sql) throw new Error("Database is not loaded yet.");

  const files: Record<string, Uint8Array> = {};
  files["vault.sqlite"] = sql.export();

  const instances = await db
    .select({ mediaPath: cardInstances.mediaPath })
    .from(cardInstances);
  const paths = new Set(instances.map((r) => r.mediaPath).filter(Boolean));

  const setRows = await db
    .select({ symbolAssetPath: tcgSets.symbolAssetPath })
    .from(tcgSets);
  for (const row of setRows) {
    const p = row.symbolAssetPath?.trim();
    if (p) paths.add(p);
  }

  for (const p of paths) {
    const blob = await loadUserBlob(p);
    if (blob) {
      files[`media/${p}`] = await blobToU8(blob);
    }
  }

  const zipped = zipSync(files, { level: 6 });
  return new Blob([new Uint8Array(zipped)], { type: "application/zip" });
}
