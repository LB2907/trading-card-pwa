/** Origin Private File System — media blobs only (no SQLite file here by default). */

function supportsOpfs(): boolean {
  return typeof navigator !== "undefined" && !!navigator.storage?.getDirectory;
}

export async function opfsWrite(id: string, data: Blob): Promise<void> {
  if (!supportsOpfs()) {
    throw new Error("OPFS not supported in this context (use HTTPS or localhost)");
  }
  const root = await navigator.storage.getDirectory();
  const fileHandle = await root.getFileHandle(id, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(data);
  await writable.close();
}

export async function opfsRead(id: string): Promise<Blob | null> {
  if (!supportsOpfs()) return null;
  try {
    const root = await navigator.storage.getDirectory();
    const fileHandle = await root.getFileHandle(id);
    const file = await fileHandle.getFile();
    return file;
  } catch {
    return null;
  }
}

export async function opfsDelete(id: string): Promise<void> {
  if (!supportsOpfs()) return;
  try {
    const root = await navigator.storage.getDirectory();
    await root.removeEntry(id);
  } catch {
    /* ignore */
  }
}

export function randomMediaId(ext: string): string {
  const e = ext.startsWith(".") ? ext : `.${ext}`;
  return `${crypto.randomUUID()}${e}`;
}
