"use client";

const K_ENABLED = "tcs_vault_enabled";
const K_PIN_HASH = "tcs_vault_pin_sha256";
const K_BLUR = "tcs_blur_background";
const K_BIO = "tcs_biometric_hint";
const S_UNLOCK = "tcs_session_unlocked";
const O_DONE = "tcs_onboarding_done";

export function isOnboardingDone(): boolean {
  if (typeof window === "undefined") return true;
  return localStorage.getItem(O_DONE) === "1";
}

export function setOnboardingDone() {
  if (typeof window === "undefined") return;
  localStorage.setItem(O_DONE, "1");
}

export function isVaultEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(K_ENABLED) === "1";
}

export function setVaultEnabled(v: boolean) {
  if (typeof window === "undefined") return;
  localStorage.setItem(K_ENABLED, v ? "1" : "0");
  if (!v) sessionStorage.removeItem(S_UNLOCK);
}

export function isBlurBackground(): boolean {
  if (typeof window === "undefined") return true;
  return localStorage.getItem(K_BLUR) !== "0";
}

export function setBlurBackground(v: boolean) {
  if (typeof window === "undefined") return;
  localStorage.setItem(K_BLUR, v ? "1" : "0");
}

export function isBiometricHint(): boolean {
  if (typeof window === "undefined") return true;
  return localStorage.getItem(K_BIO) !== "0";
}

export function setBiometricHint(v: boolean) {
  if (typeof window === "undefined") return;
  localStorage.setItem(K_BIO, v ? "1" : "0");
}

export async function hashPin(pin: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(pin),
  );
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function getStoredPinHash(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(K_PIN_HASH);
}

export async function setPin(pin: string) {
  if (typeof window === "undefined") return;
  const h = await hashPin(pin);
  localStorage.setItem(K_PIN_HASH, h);
  sessionStorage.setItem(S_UNLOCK, "1");
}

export async function verifyPin(pin: string): Promise<boolean> {
  const want = getStoredPinHash();
  if (!want) return false;
  const h = await hashPin(pin);
  if (h === want) {
    sessionStorage.setItem(S_UNLOCK, "1");
    return true;
  }
  return false;
}

export function isSessionUnlocked(): boolean {
  if (typeof window === "undefined") return true;
  if (!isVaultEnabled()) return true;
  return sessionStorage.getItem(S_UNLOCK) === "1";
}

export function lockSession() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(S_UNLOCK);
}

export function hasPinConfigured(): boolean {
  return !!getStoredPinHash();
}
