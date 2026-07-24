# Phase 1 — Vault Encryption Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Encrypt the vault at rest — SQLite blob and all media — with AES-256-GCM keyed from the user's PIN, replacing the cosmetic SHA-256 gate with real protection, honest UI copy included.

**Architecture:** A pure WebCrypto module (`vault/crypto.ts`) packs blobs as `TCV1 | iv(12) | ciphertext`. A browser keyring (`vault/keyring.ts`) stores KDF config (salt + iterations + encrypted check value) in localStorage and the derived key in sessionStorage while unlocked. `db/secure-blob.ts` wraps the IndexedDB SQLite blob load/save with transparent encrypt/decrypt; `media/storage.ts` does the same for media. Enabling/disabling encryption runs a migration (`vault/migrate-encryption.ts`, dependency-injected and node-testable) over the DB blob + every referenced media file. `AppProviders` blocks DB init behind a new unlock screen when the vault is encrypted and locked.

**Out of scope (later phases):** WebAuthn/biometric unlock, decoy mode, encrypted cloud backups.

**Tech Stack:** WebCrypto (PBKDF2-SHA256 310k iterations → AES-GCM-256 via deriveBits), sql.js, Drizzle, Vitest (Node ≥ 18 exposes `crypto.subtle`).

**Branch:** `phase-1-vault-encryption` off `main`.

**Threat model honesty (goes in UI copy):** protects data at rest against someone with the device/disk but not the PIN. While unlocked, the key sits in sessionStorage and decrypted data in memory — same exposure class as any unlocked app. Forgotten PIN = unrecoverable vault. Backup ZIPs remain unencrypted by design (they must be restorable anywhere) — say so next to the button.

---

### Task 1: Crypto primitives (`vault/crypto.ts`)

**Files:** Create `src/lib/vault/crypto.ts`, test `src/lib/vault/crypto.test.ts`.

- [ ] Failing tests: derive → encrypt → decrypt roundtrip; wrong key throws; tampered ciphertext throws; `isEncryptedBlob` true for packed / false for plaintext & short arrays; salt is 16 bytes and random.

```ts
// crypto.test.ts (core cases)
import { describe, expect, it } from "vitest";
import {
  decryptBytes, deriveKeyBytes, encryptBytes, isEncryptedBlob, randomSalt,
} from "@/lib/vault/crypto";

const TEST_ITER = 1000; // keep tests fast; prod uses DEFAULT_KDF_ITERATIONS

describe("vault crypto", () => {
  it("roundtrips bytes", async () => {
    const salt = randomSalt();
    const key = await deriveKeyBytes("1234", salt, TEST_ITER);
    const data = new TextEncoder().encode("hello vault");
    const packed = await encryptBytes(key, data);
    expect(isEncryptedBlob(packed)).toBe(true);
    expect(await decryptBytes(key, packed)).toEqual(data);
  });
  it("fails with the wrong key", async () => {
    const salt = randomSalt();
    const k1 = await deriveKeyBytes("1234", salt, TEST_ITER);
    const k2 = await deriveKeyBytes("4321", salt, TEST_ITER);
    const packed = await encryptBytes(k1, new Uint8Array([1, 2, 3]));
    await expect(decryptBytes(k2, packed)).rejects.toThrow();
  });
  it("detects tampering", async () => {
    const key = await deriveKeyBytes("1234", randomSalt(), TEST_ITER);
    const packed = await encryptBytes(key, new Uint8Array([9]));
    packed[packed.length - 1] ^= 0xff;
    await expect(decryptBytes(key, packed)).rejects.toThrow();
  });
  it("isEncryptedBlob rejects plaintext and short buffers", () => {
    expect(isEncryptedBlob(new TextEncoder().encode("SQLite format 3"))).toBe(false);
    expect(isEncryptedBlob(new Uint8Array([84]))).toBe(false);
  });
});
```

- [ ] Implement:

```ts
const MAGIC = new Uint8Array([0x54, 0x43, 0x56, 0x31]); // "TCV1"
const IV_LEN = 12;
export const DEFAULT_KDF_ITERATIONS = 310_000;

export function randomSalt(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(16));
}

export async function deriveKeyBytes(pin: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations }, base, 256,
  );
  return new Uint8Array(bits);
}

async function importAesKey(keyBytes: Uint8Array, usage: KeyUsage): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", keyBytes as BufferSource, "AES-GCM", false, [usage]);
}

export async function encryptBytes(keyBytes: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_LEN));
  const key = await importAesKey(keyBytes, "encrypt");
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv as BufferSource }, key, data as BufferSource));
  const out = new Uint8Array(MAGIC.length + IV_LEN + ct.length);
  out.set(MAGIC, 0); out.set(iv, MAGIC.length); out.set(ct, MAGIC.length + IV_LEN);
  return out;
}

export async function decryptBytes(keyBytes: Uint8Array, packed: Uint8Array): Promise<Uint8Array> {
  if (!isEncryptedBlob(packed)) throw new Error("Not an encrypted vault blob.");
  const iv = packed.slice(MAGIC.length, MAGIC.length + IV_LEN);
  const ct = packed.slice(MAGIC.length + IV_LEN);
  const key = await importAesKey(keyBytes, "decrypt");
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: iv as BufferSource }, key, ct as BufferSource);
  return new Uint8Array(pt);
}

export function isEncryptedBlob(bytes: Uint8Array): boolean {
  if (bytes.length < MAGIC.length + IV_LEN + 1) return false;
  return MAGIC.every((b, i) => bytes[i] === b);
}
```

- [ ] `npm run test` green → commit `feat: vault crypto primitives (PBKDF2 + AES-GCM packing)`.

### Task 2: Keyring (`vault/keyring.ts`)

**Files:** Create `src/lib/vault/keyring.ts` (browser-only glue; no unit tests — exercised via the migration tests' injected deps and manual QA).

- [ ] Implement. localStorage `tcs_vault_crypto_v1` = `{ v:1, salt:b64, iterations:number, check:b64 }` where `check = encryptBytes(key, "tc-vault-check")`. sessionStorage `tcs_vault_key_v1` = b64 key bytes while unlocked.

```ts
export function isEncryptionEnabled(): boolean;            // config present
export function getSessionKeyBytes(): Uint8Array | null;   // null = locked
export async function enableEncryption(pin: string): Promise<Uint8Array>; // create config + unlock
export async function unlockWithPin(pin: string): Promise<boolean>;       // verify via check value
export function disableEncryptionConfig(): void;           // remove config + session key
export function lockVaultSession(): void;                  // drop session key (+ legacy flag)
```

`unlockWithPin` derives with stored salt/iterations, attempts `decryptBytes(key, check)`; success → stash key in sessionStorage, return true; GCM failure → return false. Base64 helpers local to the module.

- [ ] Lint green → commit `feat: vault keyring (KDF config + session key)`.

### Task 3: Secure SQLite blob + secure media writes

**Files:** Create `src/lib/db/secure-blob.ts`; modify `src/lib/db/client.ts`, `src/lib/media/storage.ts`, `src/components/vault-restore-panel.tsx`.

- [ ] `secure-blob.ts`:

```ts
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
```

- [ ] `client.ts`: replace `loadSqliteBlob()`/`saveSqliteBlob` usages with `loadVaultSqlite()`/`saveVaultSqlite` (persistence `saveFn` and the `beforeunload` handler — the latter becomes `void saveVaultSqlite(sqlDb.export()).catch(() => {})`).
- [ ] `media/storage.ts`: add `writeUserBlobRaw(id, bytes)` (encrypts when enabled+unlocked, OPFS with IDB fallback) and use it from `storeUserBlob`; in `loadUserBlob`, after reading bytes, decrypt when `isEncryptedBlob`. Restore panel's `writeMediaBlob` replaced by `writeUserBlobRaw`.
- [ ] `npm run lint && npm run test` green → commit `feat: transparent encrypt/decrypt for sqlite blob and media`.

### Task 4: Encryption migration (`vault/migrate-encryption.ts`)

**Files:** Create `src/lib/vault/migrate-encryption.ts`, test `src/lib/vault/migrate-encryption.test.ts`.

Dependency-injected so tests run in node against an in-memory blob map:

```ts
export type BlobStore = {
  read: (id: string) => Promise<Uint8Array | null>;
  write: (id: string, data: Uint8Array) => Promise<void>;
};

/** All media ids referenced by the DB (card art + set symbols). */
export async function collectMediaIds(db: TradingCardDb): Promise<string[]>;

/** Encrypt every referenced media blob in place; skips already-encrypted. */
export async function encryptAllMedia(db, keyBytes, store: BlobStore, onProgress?): Promise<number>;

/** Decrypt every referenced media blob in place; skips plaintext. */
export async function decryptAllMedia(db, keyBytes, store: BlobStore, onProgress?): Promise<number>;
```

- [ ] Tests: seed a drizzle sql.js DB with two card instances + one set symbol; fake store map; `encryptAllMedia` encrypts all three and is idempotent; `decryptAllMedia` restores original bytes; missing blobs are skipped without throwing.
- [ ] Implement (iterate `collectMediaIds`, read → `isEncryptedBlob` check → transform → write).
- [ ] Green → commit `feat: media encryption migration helpers`.

### Task 5: Unlock screen + AppProviders gating

**Files:** Create `src/components/vault-unlock-screen.tsx`; modify `src/components/app-providers.tsx`.

- [ ] Unlock screen: PIN input + Unlock button, calls `unlockWithPin`; on success calls `onUnlocked()`; on failure shows "Incorrect PIN — the vault stays encrypted." Styled like the existing lock gate (fixed inset, zinc-950).
- [ ] `app-providers.tsx`: track `locked = isEncryptionEnabled() && !getSessionKeyBytes()` via `useSyncExternalStore`-style read + local state bump; when locked render `<VaultUnlockScreen onUnlocked={bump}/>` **instead of** calling `initDatabase()`; when unlocked (or unencrypted) proceed exactly as today. Legacy `VaultLockGate` stays in the tree for legacy-flag users.
- [ ] Lint + build green → commit `feat: unlock gate before database init for encrypted vaults`.

### Task 6: Settings — encryption panel with honest copy

**Files:** Create `src/components/vault-encryption-panel.tsx`; modify `src/app/(main)/settings/page.tsx`.

- [ ] Panel states:
  - **Off:** PIN + confirm fields (min 6 chars for encryption), "Encrypt vault" button. If a legacy PIN hash exists, require the current PIN to match (`verifyPin`) before proceeding. Flow: `enableEncryption(pin)` → `encryptAllMedia` (progress text "Encrypting n/m…", injected store = OPFS/IDB via `writeUserBlobRaw`-level raw fns) → flush DB via persistence + `saveVaultSqlite` → clear legacy `tcs_vault_*` keys → success message.
  - **On:** status line "Vault encrypted — AES-256-GCM, key derived from your PIN (PBKDF2, 310,000 iterations). If you forget the PIN, this vault cannot be recovered." Buttons: "Lock now" (`lockVaultSession()` + reload) and "Decrypt & turn off" (PIN prompt → `unlockWithPin` verify → `decryptAllMedia` → save plaintext DB → `disableEncryptionConfig()`).
- [ ] Settings page: replace the old PIN section inside "Security & privacy" with the panel; keep the blur toggle; legacy vault-lock toggle renders only when the legacy flag is already on, labeled "Legacy screen lock (no encryption) — replace it below". Update backup card copy: "Backup ZIPs are unencrypted so they can be restored anywhere — store them somewhere safe."
- [ ] Lint + test + build green; dev-server DOM check: panel renders, enable flow reaches the progress state with an empty vault instantly.
- [ ] Commit `feat: vault encryption setup/teardown in Settings with honest copy`.

### Task 7: Final verification

- [ ] `npm run lint` + `npm run test` + `npm run build` all green.
- [ ] Browser QA (dev server): enable encryption on an empty vault → reload → unlock screen appears → wrong PIN rejected → correct PIN loads app → Settings shows "Vault encrypted"; disable → reload skips unlock.
- [ ] README: rewrite the vault/security paragraph to describe encryption honestly.
- [ ] Merge to `main`, push (user pre-authorized push for this line of work? — ask before pushing unless told).
