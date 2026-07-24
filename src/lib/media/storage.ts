import { loadMediaBytes, saveMediaBytes } from "@/lib/db/idb";
import { opfsRead, opfsWrite, randomMediaId } from "@/lib/opfs";
import { decryptBytes, encryptBytes, isEncryptedBlob } from "@/lib/vault/crypto";
import { getSessionKeyBytes, isEncryptionEnabled } from "@/lib/vault/keyring";

/**
 * Write media bytes under a fixed id (OPFS, IndexedDB fallback), encrypting
 * when the vault is encrypted and unlocked.
 */
export async function writeUserBlobRaw(id: string, data: Uint8Array): Promise<void> {
  let out = data;
  if (isEncryptionEnabled()) {
    const key = getSessionKeyBytes();
    if (!key) throw new Error("Vault is locked — refusing to save media.");
    out = await encryptBytes(key, data);
  }
  try {
    await opfsWrite(id, new Blob([new Uint8Array(out)]));
  } catch {
    await saveMediaBytes(id, out);
  }
}

export async function storeUserBlob(blob: Blob, ext: string): Promise<string> {
  const id = randomMediaId(ext);
  await writeUserBlobRaw(id, new Uint8Array(await blob.arrayBuffer()));
  return id;
}

async function readStoredBytes(id: string): Promise<Uint8Array | null> {
  const fromOpfs = await opfsRead(id);
  if (fromOpfs) return new Uint8Array(await fromOpfs.arrayBuffer());
  return loadMediaBytes(id);
}

export async function loadUserBlob(id: string): Promise<Blob | null> {
  const bytes = await readStoredBytes(id);
  if (!bytes) return null;
  if (isEncryptedBlob(bytes)) {
    const key = getSessionKeyBytes();
    if (!key) throw new Error("Vault is locked — unlock to load media.");
    const plain = await decryptBytes(key, bytes);
    return new Blob([new Uint8Array(plain)]);
  }
  return new Blob([new Uint8Array(bytes)]);
}

/** Raw stored bytes without decryption — used by encryption migration. */
export async function readUserBlobStoredBytes(id: string): Promise<Uint8Array | null> {
  return readStoredBytes(id);
}

/** Write already-transformed bytes without re-encrypting — migration only. */
export async function writeUserBlobStoredBytes(id: string, data: Uint8Array): Promise<void> {
  try {
    await opfsWrite(id, new Blob([new Uint8Array(data)]));
  } catch {
    await saveMediaBytes(id, data);
  }
}
