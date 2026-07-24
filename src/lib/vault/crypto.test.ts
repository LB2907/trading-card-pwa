import { describe, expect, it } from "vitest";
import {
  decryptBytes,
  deriveKeyBytes,
  encryptBytes,
  isEncryptedBlob,
  randomSalt,
} from "@/lib/vault/crypto";

const TEST_ITER = 1000; // keep tests fast; prod uses DEFAULT_KDF_ITERATIONS

describe("vault crypto", () => {
  it("roundtrips bytes through derive → encrypt → decrypt", async () => {
    const salt = randomSalt();
    const key = await deriveKeyBytes("1234", salt, TEST_ITER);
    const data = new TextEncoder().encode("hello vault");
    const packed = await encryptBytes(key, data);
    expect(isEncryptedBlob(packed)).toBe(true);
    expect(await decryptBytes(key, packed)).toEqual(data);
  });

  it("derives the same key for the same pin+salt, different for another pin", async () => {
    const salt = randomSalt();
    const a = await deriveKeyBytes("1234", salt, TEST_ITER);
    const b = await deriveKeyBytes("1234", salt, TEST_ITER);
    const c = await deriveKeyBytes("4321", salt, TEST_ITER);
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
    expect(a.length).toBe(32);
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

  it("produces different ciphertexts per call (random IV)", async () => {
    const key = await deriveKeyBytes("1234", randomSalt(), TEST_ITER);
    const a = await encryptBytes(key, new Uint8Array([1]));
    const b = await encryptBytes(key, new Uint8Array([1]));
    expect(a).not.toEqual(b);
  });

  it("isEncryptedBlob rejects plaintext and short buffers", () => {
    expect(isEncryptedBlob(new TextEncoder().encode("SQLite format 3"))).toBe(false);
    expect(isEncryptedBlob(new Uint8Array([0x54]))).toBe(false);
    expect(isEncryptedBlob(new Uint8Array(0))).toBe(false);
  });

  it("randomSalt returns 16 random bytes", () => {
    const a = randomSalt();
    const b = randomSalt();
    expect(a.length).toBe(16);
    expect(a).not.toEqual(b);
  });
});
