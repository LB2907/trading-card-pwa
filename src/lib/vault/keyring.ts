"use client";

/**
 * Vault keyring: KDF config lives in localStorage, the derived key lives in
 * sessionStorage while unlocked (cleared on lock / tab close).
 *
 * Threat model: protects data at rest against someone without the PIN. While
 * the vault is unlocked, the key and decrypted data are as exposed as any
 * running app. A forgotten PIN makes the vault unrecoverable by design.
 */

import {
  DEFAULT_KDF_ITERATIONS,
  decryptBytes,
  deriveKeyBytes,
  encryptBytes,
  randomSalt,
} from "@/lib/vault/crypto";

const K_CONFIG = "tcs_vault_crypto_v1";
const S_KEY = "tcs_vault_key_v1";
const CHECK_PLAINTEXT = "tc-vault-check";

type VaultCryptoConfig = {
  v: 1;
  salt: string; // base64
  iterations: number;
  check: string; // base64 of encryptBytes(key, CHECK_PLAINTEXT)
};

function toB64(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

function fromB64(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function readConfig(): VaultCryptoConfig | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(K_CONFIG);
  if (!raw) return null;
  try {
    const cfg = JSON.parse(raw) as VaultCryptoConfig;
    if (cfg.v !== 1 || !cfg.salt || !cfg.iterations || !cfg.check) return null;
    return cfg;
  } catch {
    return null;
  }
}

export function isEncryptionEnabled(): boolean {
  return readConfig() !== null;
}

export function getSessionKeyBytes(): Uint8Array | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(S_KEY);
  if (!raw) return null;
  try {
    return fromB64(raw);
  } catch {
    return null;
  }
}

/** Create config + unlock. Overwrites any previous config — caller verifies intent. */
export async function enableEncryption(pin: string): Promise<Uint8Array> {
  const salt = randomSalt();
  const iterations = DEFAULT_KDF_ITERATIONS;
  const key = await deriveKeyBytes(pin, salt, iterations);
  const check = await encryptBytes(key, new TextEncoder().encode(CHECK_PLAINTEXT));
  const cfg: VaultCryptoConfig = {
    v: 1,
    salt: toB64(salt),
    iterations,
    check: toB64(check),
  };
  localStorage.setItem(K_CONFIG, JSON.stringify(cfg));
  sessionStorage.setItem(S_KEY, toB64(key));
  return key;
}

/** Verify the PIN against the stored check value; stash the key on success. */
export async function unlockWithPin(pin: string): Promise<boolean> {
  const cfg = readConfig();
  if (!cfg) return false;
  const key = await deriveKeyBytes(pin, fromB64(cfg.salt), cfg.iterations);
  try {
    const check = await decryptBytes(key, fromB64(cfg.check));
    if (new TextDecoder().decode(check) !== CHECK_PLAINTEXT) return false;
  } catch {
    return false;
  }
  sessionStorage.setItem(S_KEY, toB64(key));
  return true;
}

/** Remove config + session key (call after data has been decrypted back). */
export function disableEncryptionConfig(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(K_CONFIG);
  sessionStorage.removeItem(S_KEY);
}

/** Drop the session key so the next launch requires the PIN again. */
export function lockVaultSession(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(S_KEY);
}
