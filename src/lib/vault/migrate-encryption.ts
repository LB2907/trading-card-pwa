import type { TradingCardDb } from "@/lib/db/client";
import { cardInstances, tcgSets } from "@/lib/db/schema";
import { decryptBytes, encryptBytes, isEncryptedBlob } from "@/lib/vault/crypto";

export type BlobStore = {
  read: (id: string) => Promise<Uint8Array | null>;
  write: (id: string, data: Uint8Array) => Promise<void>;
};

export type MigrationProgress = (done: number, total: number) => void;

/** All media ids referenced by the DB (card art + set symbols), deduplicated. */
export async function collectMediaIds(db: TradingCardDb): Promise<string[]> {
  const ids = new Set<string>();
  const instances = await db
    .select({ mediaPath: cardInstances.mediaPath })
    .from(cardInstances);
  for (const r of instances) {
    if (r.mediaPath) ids.add(r.mediaPath);
  }
  const sets = await db
    .select({ symbolAssetPath: tcgSets.symbolAssetPath })
    .from(tcgSets);
  for (const r of sets) {
    const p = r.symbolAssetPath?.trim();
    if (p) ids.add(p);
  }
  return [...ids];
}

async function transformAllMedia(
  db: TradingCardDb,
  store: BlobStore,
  shouldTransform: (bytes: Uint8Array) => boolean,
  transform: (bytes: Uint8Array) => Promise<Uint8Array>,
  onProgress?: MigrationProgress,
): Promise<number> {
  const ids = await collectMediaIds(db);
  let changed = 0;
  let done = 0;
  for (const id of ids) {
    const bytes = await store.read(id);
    if (bytes && shouldTransform(bytes)) {
      await store.write(id, await transform(bytes));
      changed += 1;
    }
    done += 1;
    onProgress?.(done, ids.length);
  }
  return changed;
}

/** Encrypt every referenced media blob in place; skips already-encrypted. */
export async function encryptAllMedia(
  db: TradingCardDb,
  keyBytes: Uint8Array,
  store: BlobStore,
  onProgress?: MigrationProgress,
): Promise<number> {
  return transformAllMedia(
    db,
    store,
    (bytes) => !isEncryptedBlob(bytes),
    (bytes) => encryptBytes(keyBytes, bytes),
    onProgress,
  );
}

/** Decrypt every referenced media blob in place; skips plaintext. */
export async function decryptAllMedia(
  db: TradingCardDb,
  keyBytes: Uint8Array,
  store: BlobStore,
  onProgress?: MigrationProgress,
): Promise<number> {
  return transformAllMedia(
    db,
    store,
    (bytes) => isEncryptedBlob(bytes),
    (bytes) => decryptBytes(keyBytes, bytes),
    onProgress,
  );
}
