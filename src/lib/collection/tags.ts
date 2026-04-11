export function parseTagsJson(raw: string): string[] {
  try {
    const v = JSON.parse(raw || "[]") as unknown;
    if (!Array.isArray(v)) return [];
    return v
      .filter((x): x is string => typeof x === "string")
      .map((s) => s.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

/** Case-insensitive: any tag contains `q` (trimmed). */
export function tagsMatchQuery(tagsJson: string, q: string): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  return parseTagsJson(tagsJson).some((t) =>
    t.toLowerCase().includes(needle),
  );
}
