const DB_NAME = "trading-card-pwa";
const STORE = "kv";
const KEY = "sqlite-db-v1";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onerror = () => reject(req.error);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
  });
}

/** Fallback when OPFS is unavailable (non-secure context). */
export async function saveMediaBytes(id: string, data: Uint8Array): Promise<void> {
  const idb = await openDb();
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(data, `media:${id}`);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadMediaBytes(id: string): Promise<Uint8Array | null> {
  const idb = await openDb();
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(STORE, "readonly");
    const get = tx.objectStore(STORE).get(`media:${id}`);
    get.onerror = () => reject(get.error);
    get.onsuccess = () => {
      const v = get.result;
      resolve(v instanceof Uint8Array ? v : null);
    };
  });
}

export async function loadSqliteBlob(): Promise<Uint8Array | null> {
  const idb = await openDb();
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(STORE, "readonly");
    const get = tx.objectStore(STORE).get(KEY);
    get.onerror = () => reject(get.error);
    get.onsuccess = () => {
      const v = get.result;
      resolve(v instanceof Uint8Array ? v : null);
    };
  });
}

export async function saveSqliteBlob(data: Uint8Array): Promise<void> {
  const idb = await openDb();
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(data, KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
