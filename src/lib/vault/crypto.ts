/**
 * Vault crypto primitives. Encrypted blobs are packed as:
 *   "TCV1" (4 bytes) | IV (12 bytes) | AES-256-GCM ciphertext+tag
 * Keys are derived from the user's PIN with PBKDF2-SHA256.
 */

const MAGIC = new Uint8Array([0x54, 0x43, 0x56, 0x31]); // "TCV1"
const IV_LEN = 12;

export const DEFAULT_KDF_ITERATIONS = 310_000;

export function randomSalt(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(16));
}

export async function deriveKeyBytes(
  pin: string,
  salt: Uint8Array,
  iterations: number,
): Promise<Uint8Array> {
  const base = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(pin),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations },
    base,
    256,
  );
  return new Uint8Array(bits);
}

async function importAesKey(
  keyBytes: Uint8Array,
  usage: KeyUsage,
): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", keyBytes as BufferSource, "AES-GCM", false, [
    usage,
  ]);
}

export async function encryptBytes(
  keyBytes: Uint8Array,
  data: Uint8Array,
): Promise<Uint8Array> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_LEN));
  const key = await importAesKey(keyBytes, "encrypt");
  const ct = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: iv as BufferSource },
      key,
      data as BufferSource,
    ),
  );
  const out = new Uint8Array(MAGIC.length + IV_LEN + ct.length);
  out.set(MAGIC, 0);
  out.set(iv, MAGIC.length);
  out.set(ct, MAGIC.length + IV_LEN);
  return out;
}

export async function decryptBytes(
  keyBytes: Uint8Array,
  packed: Uint8Array,
): Promise<Uint8Array> {
  if (!isEncryptedBlob(packed)) throw new Error("Not an encrypted vault blob.");
  const iv = packed.slice(MAGIC.length, MAGIC.length + IV_LEN);
  const ct = packed.slice(MAGIC.length + IV_LEN);
  const key = await importAesKey(keyBytes, "decrypt");
  const pt = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: iv as BufferSource },
    key,
    ct as BufferSource,
  );
  return new Uint8Array(pt);
}

export function isEncryptedBlob(bytes: Uint8Array): boolean {
  if (bytes.length < MAGIC.length + IV_LEN + 1) return false;
  return MAGIC.every((b, i) => bytes[i] === b);
}
