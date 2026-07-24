"use client";

import { loadSqliteBlob, saveSqliteBlob } from "@/lib/db/idb";
import { decryptBytes, encryptBytes, isEncryptedBlob } from "@/lib/vault/crypto";
import { getSessionKeyBytes, isEncryptionEnabled } from "@/lib/vault/keyring";

/** Load the stored DB, decrypting when the vault is encrypted. */
export async function loadVaultSqlite(): Promise<Uint8Array | null> {
  const raw = await loadSqliteBlob();
  if (!raw) return null;
  if (!isEncryptedBlob(raw)) return raw; // plaintext (pre-encryption or disabled)
  const key = getSessionKeyBytes();
  if (!key) throw new Error("Vault is locked — unlock to load the database.");
  return decryptBytes(key, raw);
}

/** Save the DB, encrypting when the vault is encrypted and unlocked. */
export async function saveVaultSqlite(data: Uint8Array): Promise<void> {
  if (isEncryptionEnabled()) {
    const key = getSessionKeyBytes();
    if (!key) throw new Error("Vault is locked — refusing to save.");
    return saveSqliteBlob(await encryptBytes(key, data));
  }
  return saveSqliteBlob(data);
}
