/** Dirty-flag persistence: saves only when something changed, suspendable for restores. */
export type Persistence = {
  markDirty: () => void;
  flushNow: () => Promise<void>;
  intervalTick: () => Promise<void>;
  suspend: () => void;
  resume: () => void;
  isDirty: () => boolean;
};

export function createPersistence(opts: {
  exportFn: () => Uint8Array;
  saveFn: (data: Uint8Array) => Promise<void>;
  debounceMs?: number;
}): Persistence {
  const debounceMs = opts.debounceMs ?? 300;
  let dirty = false;
  let suspended = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  function clearTimer() {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  }

  async function flush(): Promise<void> {
    if (suspended || !dirty) return;
    clearTimer();
    dirty = false;
    try {
      await opts.saveFn(opts.exportFn());
    } catch {
      dirty = true; // retried on the next tick / markDirty
    }
  }

  return {
    markDirty() {
      dirty = true;
      if (suspended) return;
      clearTimer();
      timer = setTimeout(() => {
        timer = null;
        void flush();
      }, debounceMs);
    },
    flushNow: () => flush(),
    intervalTick: () => flush(),
    suspend() {
      suspended = true;
      clearTimer();
    },
    resume() {
      suspended = false;
    },
    isDirty: () => dirty,
  };
}
