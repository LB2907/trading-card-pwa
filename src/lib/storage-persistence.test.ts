import { describe, expect, it } from "vitest";
import { formatBytes, usagePercent } from "@/lib/storage-persistence";

describe("formatBytes", () => {
  it("formats byte ranges with one decimal above 1 KB", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(1023)).toBe("1023 B");
    expect(formatBytes(1024)).toBe("1.0 KB");
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatBytes(1048576)).toBe("1.0 MB");
    expect(formatBytes(5 * 1024 * 1024)).toBe("5.0 MB");
    expect(formatBytes(3 * 1024 * 1024 * 1024)).toBe("3.0 GB");
  });

  it("handles null and invalid input", () => {
    expect(formatBytes(null)).toBe("—");
    expect(formatBytes(-1)).toBe("—");
    expect(formatBytes(NaN)).toBe("—");
  });
});

describe("usagePercent", () => {
  it("computes a rounded, clamped percentage", () => {
    expect(usagePercent({ persisted: true, usage: 50, quota: 200 })).toBe(25);
    expect(usagePercent({ persisted: true, usage: 300, quota: 200 })).toBe(100);
  });

  it("returns null when usage or quota is unavailable", () => {
    expect(usagePercent({ persisted: true, usage: null, quota: 200 })).toBeNull();
    expect(usagePercent({ persisted: true, usage: 50, quota: null })).toBeNull();
    expect(usagePercent({ persisted: true, usage: 50, quota: 0 })).toBeNull();
  });
});
