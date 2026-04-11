"use client";

const EXPORT_PREF_DB = "trading-card-pwa-export";
const EXPORT_PREF_STORE = "prefs";
const EXPORT_DIR_HANDLE_KEY = "export-dir-handle";
const EXPORT_DIR_NAME_KEY = "tcg:export-dir-name";
const EXPORT_WATERMARK_KEY = "tcg:export-watermark-text";

/** Same object reference from the picker keeps write permission; IDB clones are flaky. */
let cachedExportDirHandle: FileSystemDirectoryHandle | null = null;

function sanitizeExportFilename(name: string): string {
  const cleaned = name
    .replace(/[\\/?:%*|"<>]/g, "_")
    .replace(/[\u0000-\u001f]/g, "_")
    .trim();
  const base = cleaned.length > 0 ? cleaned : "download";
  return base.length > 200 ? base.slice(0, 200) : base;
}

function openPrefDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(EXPORT_PREF_DB, 1);
    req.onerror = () => reject(req.error);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(EXPORT_PREF_STORE)) {
        req.result.createObjectStore(EXPORT_PREF_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
  });
}

async function saveHandle(handle: FileSystemDirectoryHandle): Promise<void> {
  const db = await openPrefDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(EXPORT_PREF_STORE, "readwrite");
    const req = tx.objectStore(EXPORT_PREF_STORE).put(handle, EXPORT_DIR_HANDLE_KEY);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB put failed"));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("IndexedDB transaction failed"));
  });
}

async function loadHandle(): Promise<FileSystemDirectoryHandle | null> {
  const db = await openPrefDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(EXPORT_PREF_STORE, "readonly");
    const req = tx.objectStore(EXPORT_PREF_STORE).get(EXPORT_DIR_HANDLE_KEY);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const result = req.result;
      if (result && typeof result === "object") {
        resolve(result as FileSystemDirectoryHandle);
      } else {
        resolve(null);
      }
    };
  });
}

function getDirPicker():
  | ((opts?: { mode?: "read" | "readwrite" }) => Promise<FileSystemDirectoryHandle>)
  | null {
  if (typeof window === "undefined") return null;
  const w = window as Window & {
    showDirectoryPicker?: (opts?: {
      mode?: "read" | "readwrite";
    }) => Promise<FileSystemDirectoryHandle>;
  };
  return w.showDirectoryPicker ?? null;
}

type DirPermHandle = FileSystemDirectoryHandle & {
  queryPermission?: (opts: {
    mode: "readwrite";
  }) => Promise<PermissionState>;
  requestPermission?: (opts: {
    mode: "readwrite";
  }) => Promise<PermissionState>;
};

/**
 * Call right after `showDirectoryPicker()` resolves so `requestPermission` still
 * runs within Chromium's user-activation window.
 */
async function ensureWritableFromPickerGesture(
  dir: FileSystemDirectoryHandle,
): Promise<boolean> {
  try {
    const anyDir = dir as DirPermHandle;
    if (
      typeof anyDir.requestPermission !== "function" &&
      typeof anyDir.queryPermission !== "function"
    ) {
      return true;
    }
    if (typeof anyDir.requestPermission === "function") {
      const r = await anyDir.requestPermission({ mode: "readwrite" });
      if (r === "granted") return true;
    }
    const q = await anyDir.queryPermission?.({ mode: "readwrite" });
    return q === "granted";
  } catch {
    return false;
  }
}

async function canWrite(dir: FileSystemDirectoryHandle): Promise<boolean> {
  try {
    const anyDir = dir as DirPermHandle;
    const q = await anyDir.queryPermission?.({ mode: "readwrite" });
    if (q === "granted") return true;
    const r = await anyDir.requestPermission?.({ mode: "readwrite" });
    if (r === "granted") return true;
    if (!anyDir.queryPermission && !anyDir.requestPermission) return true;
    return false;
  } catch {
    return false;
  }
}

export function isFolderExportSupported(): boolean {
  if (typeof window === "undefined") return false;
  if (!window.isSecureContext) return false;
  return !!getDirPicker();
}

export function getExportDirectoryLabel(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(EXPORT_DIR_NAME_KEY) ?? "";
}

export async function pickExportDirectory(): Promise<string> {
  const pick = getDirPicker();
  if (!pick) {
    throw new Error("This browser does not support folder export.");
  }
  const dir = await pick({ mode: "readwrite" });
  if (!(await ensureWritableFromPickerGesture(dir))) {
    throw new Error("Write permission to that folder was denied.");
  }
  await saveHandle(dir);
  cachedExportDirHandle = dir;
  if (typeof window !== "undefined") {
    localStorage.setItem(EXPORT_DIR_NAME_KEY, dir.name ?? "");
  }
  return dir.name ?? "";
}

/**
 * Load the saved directory handle from IndexedDB into memory (no permission prompt).
 * Call when opening export UI so writes reuse the live picker reference when possible.
 */
export async function hydrateExportDirHandleFromStorage(): Promise<void> {
  if (cachedExportDirHandle) return;
  const h = await loadHandle();
  if (h) cachedExportDirHandle = h;
}

/**
 * Fire `requestPermission` without awaiting — call synchronously from the same
 * click/tap as starting an export, before any `await`, so Chromium keeps write access.
 */
export function primeExportFolderWriteFromUserGesture(): void {
  const h = cachedExportDirHandle;
  if (!h) return;
  const anyDir = h as DirPermHandle;
  if (typeof anyDir.requestPermission !== "function") return;
  void anyDir.requestPermission({ mode: "readwrite" });
}

export function clearExportDirectory(): void {
  cachedExportDirHandle = null;
  if (typeof window !== "undefined") {
    localStorage.removeItem(EXPORT_DIR_NAME_KEY);
  }
  void (async () => {
    const db = await openPrefDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(EXPORT_PREF_STORE, "readwrite");
      tx.objectStore(EXPORT_PREF_STORE).delete(EXPORT_DIR_HANDLE_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  })();
}

export async function writeToExportDirectory(
  blob: Blob,
  filename: string,
): Promise<boolean> {
  let dir = cachedExportDirHandle;
  if (!dir) {
    dir = await loadHandle();
    if (dir) cachedExportDirHandle = dir;
  }
  if (!dir) return false;
  if (!(await canWrite(dir))) return false;
  const safeName = sanitizeExportFilename(filename);
  try {
    const file = await dir.getFileHandle(safeName, { create: true });
    const writable = await file.createWritable({ keepExistingData: false });
    await writable.write(blob);
    await writable.close();
    return true;
  } catch {
    return false;
  }
}

export function getExportWatermarkText(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(EXPORT_WATERMARK_KEY) ?? "";
}

export function setExportWatermarkText(text: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(EXPORT_WATERMARK_KEY, text);
}
