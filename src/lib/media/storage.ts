import { loadMediaBytes, saveMediaBytes } from "@/lib/db/idb";
import { opfsRead, opfsWrite, randomMediaId } from "@/lib/opfs";

export async function storeUserBlob(blob: Blob, ext: string): Promise<string> {
  const id = randomMediaId(ext);
  try {
    await opfsWrite(id, blob);
  } catch {
    const buf = new Uint8Array(await blob.arrayBuffer());
    await saveMediaBytes(id, buf);
  }
  return id;
}

export async function loadUserBlob(id: string): Promise<Blob | null> {
  const fromOpfs = await opfsRead(id);
  if (fromOpfs) return fromOpfs;
  const mem = await loadMediaBytes(id);
  return mem ? new Blob([new Uint8Array(mem)]) : null;
}
