import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPersistence } from "@/lib/db/persistence";

describe("createPersistence", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  function setup(saveImpl?: () => Promise<void>) {
    const exportFn = vi.fn(() => new Uint8Array([1, 2, 3]));
    const saveFn = vi.fn(saveImpl ?? (() => Promise.resolve()));
    const p = createPersistence({ exportFn, saveFn, debounceMs: 300 });
    return { p, exportFn, saveFn };
  }

  it("debounces markDirty into one save", async () => {
    const { p, saveFn } = setup();
    p.markDirty();
    p.markDirty();
    await vi.advanceTimersByTimeAsync(299);
    expect(saveFn).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(saveFn).toHaveBeenCalledTimes(1);
  });

  it("intervalTick is a no-op when clean", async () => {
    const { p, saveFn } = setup();
    await p.intervalTick();
    expect(saveFn).not.toHaveBeenCalled();
  });

  it("intervalTick flushes when dirty and clears the pending debounce", async () => {
    const { p, saveFn } = setup();
    p.markDirty();
    await p.intervalTick();
    expect(saveFn).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1000);
    expect(saveFn).toHaveBeenCalledTimes(1);
  });

  it("suspend blocks flushes; resume does not auto-flush", async () => {
    const { p, saveFn } = setup();
    p.markDirty();
    p.suspend();
    await vi.advanceTimersByTimeAsync(1000);
    await p.intervalTick();
    expect(saveFn).not.toHaveBeenCalled();
    p.resume();
    await vi.advanceTimersByTimeAsync(1000);
    expect(saveFn).not.toHaveBeenCalled();
    await p.intervalTick();
    expect(saveFn).toHaveBeenCalledTimes(1);
  });

  it("failed save re-marks dirty so the next tick retries", async () => {
    let fail = true;
    const { p, saveFn } = setup(() =>
      fail ? Promise.reject(new Error("boom")) : Promise.resolve(),
    );
    p.markDirty();
    await vi.advanceTimersByTimeAsync(300);
    expect(saveFn).toHaveBeenCalledTimes(1);
    expect(p.isDirty()).toBe(true);
    fail = false;
    await p.intervalTick();
    expect(saveFn).toHaveBeenCalledTimes(2);
    expect(p.isDirty()).toBe(false);
  });

  it("flushNow saves immediately when dirty", async () => {
    const { p, saveFn, exportFn } = setup();
    p.markDirty();
    await p.flushNow();
    expect(exportFn).toHaveBeenCalledTimes(1);
    expect(saveFn).toHaveBeenCalledWith(new Uint8Array([1, 2, 3]));
  });
});
