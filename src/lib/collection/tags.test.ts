import { describe, expect, it } from "vitest";
import { parseTagsJson, tagsMatchQuery } from "@/lib/collection/tags";

describe("parseTagsJson", () => {
  it("parses string array", () => {
    expect(parseTagsJson('["a","b"]')).toEqual(["a", "b"]);
  });

  it("returns empty for invalid", () => {
    expect(parseTagsJson("")).toEqual([]);
    expect(parseTagsJson("{}")).toEqual([]);
  });
});

describe("tagsMatchQuery", () => {
  it("matches substring case-insensitively", () => {
    expect(tagsMatchQuery('["Promo","Foil"]', "prom")).toBe(true);
    expect(tagsMatchQuery('["x"]', "zzz")).toBe(false);
  });

  it("empty query matches all", () => {
    expect(tagsMatchQuery("[]", "   ")).toBe(true);
  });
});
