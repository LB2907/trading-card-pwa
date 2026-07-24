"use client";

import { eq } from "drizzle-orm";
import { Library, SearchX, Star } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useDb } from "@/components/app-providers";
import { CollectionBulkExportDialog } from "@/components/collection-bulk-export-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectNative } from "@/components/ui/select-native";
import { Separator } from "@/components/ui/separator";
import {
  cardInstances,
  cardTemplates,
  collectionEntries,
  tcgSets,
  type CardInstance,
} from "@/lib/db/schema";
import type { CardExportRow } from "@/lib/export/types";
import { rarityVisual } from "@/lib/card-visual";
import { cardMediaMode } from "@/lib/media/card-media-mode";
import { parseTagsJson, tagsMatchQuery } from "@/lib/collection/tags";
import { RARITY_DEFINITIONS, rarityTier } from "@/lib/rarity";
import { cn } from "@/lib/utils";

type EnrichedRow = {
  instance: CardInstance;
  quantity: number;
  favorited: boolean;
  tagsJson: string;
  setName: string;
  layoutJson: string;
};

function sortRows(rows: EnrichedRow[], key: string): EnrichedRow[] {
  const out = [...rows];
  switch (key) {
    case "updatedAsc":
      out.sort(
        (a, b) =>
          a.instance.updatedAt.getTime() - b.instance.updatedAt.getTime(),
      );
      break;
    case "nameAsc":
      out.sort((a, b) =>
        (a.instance.name || "").localeCompare(b.instance.name || "", undefined, {
          sensitivity: "base",
        }),
      );
      break;
    case "nameDesc":
      out.sort((a, b) =>
        (b.instance.name || "").localeCompare(a.instance.name || "", undefined, {
          sensitivity: "base",
        }),
      );
      break;
    case "rarity":
      out.sort((a, b) => {
        const ta = rarityTier(a.instance.rarity);
        const tb = rarityTier(b.instance.rarity);
        if (ta !== tb) return tb - ta;
        return b.instance.updatedAt.getTime() - a.instance.updatedAt.getTime();
      });
      break;
    case "updatedDesc":
    default:
      out.sort(
        (a, b) =>
          b.instance.updatedAt.getTime() - a.instance.updatedAt.getTime(),
      );
  }
  return out;
}

function rarityLabel(slug: string): string {
  return RARITY_DEFINITIONS.find((d) => d.id === slug)?.label ?? slug;
}

export default function CollectionPage() {
  const db = useDb();
  const [rawRows, setRawRows] = useState<EnrichedRow[]>([]);
  const [setOptions, setSetOptions] = useState<{ id: string; name: string }[]>(
    [],
  );
  const [search, setSearch] = useState("");
  const [filterSetId, setFilterSetId] = useState("");
  const [filterRarity, setFilterRarity] = useState("");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [filterTag, setFilterTag] = useState("");
  const [sortKey, setSortKey] = useState("updatedDesc");
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [exportOpen, setExportOpen] = useState(false);

  useEffect(() => {
    void (async () => {
      const joined = await db
        .select({
          instance: cardInstances,
          entry: collectionEntries,
        })
        .from(cardInstances)
        .leftJoin(
          collectionEntries,
          eq(collectionEntries.cardInstanceId, cardInstances.id),
        );
      const tpls = await db.select().from(cardTemplates);
      const tplMap = new Map(tpls.map((t) => [t.id, t.layoutJson]));
      const setsList = await db.select().from(tcgSets);
      setSetOptions(setsList.map((s) => ({ id: s.id, name: s.name })));
      const setMap = new Map(setsList.map((s) => [s.id, s.name]));

      const map = new Map<string, EnrichedRow>();
      for (const j of joined) {
        const id = j.instance.id;
        if (map.has(id)) continue;
        map.set(id, {
          instance: j.instance,
          quantity: j.entry?.quantity ?? 0,
          favorited: Boolean(j.entry?.favorited),
          tagsJson: j.entry?.tagsJson ?? "[]",
          setName: setMap.get(j.instance.setId) ?? "",
          layoutJson: tplMap.get(j.instance.templateId) ?? "{}",
        });
      }
      setRawRows([...map.values()]);
    })();
  }, [db]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let r = rawRows;
    if (q) {
      r = r.filter((row) =>
        (row.instance.name || "").toLowerCase().includes(q),
      );
    }
    if (filterSetId) {
      r = r.filter((row) => row.instance.setId === filterSetId);
    }
    if (filterRarity) {
      r = r.filter((row) => row.instance.rarity === filterRarity);
    }
    if (favoritesOnly) {
      r = r.filter((row) => row.favorited);
    }
    if (filterTag.trim()) {
      r = r.filter((row) => tagsMatchQuery(row.tagsJson, filterTag));
    }
    return r;
  }, [rawRows, search, filterSetId, filterRarity, favoritesOnly, filterTag]);

  const displayed = useMemo(
    () => sortRows(filtered, sortKey),
    [filtered, sortKey],
  );

  const exportRows: CardExportRow[] = useMemo(() => {
    return displayed
      .filter((r) => selected.has(r.instance.id))
      .map((r) => ({
        instance: r.instance,
        layoutJson: r.layoutJson,
        setName: r.setName || null,
      }));
  }, [displayed, selected]);

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllVisible() {
    setSelected(new Set(displayed.map((r) => r.instance.id)));
  }

  function clearSelection() {
    setSelected(new Set());
  }

  if (!rawRows.length) {
    return (
      <div className="mx-auto max-w-md">
        <Card className="border-border/80 text-center shadow-lg">
          <CardHeader className="items-center space-y-3 pb-2">
            <div
              className="flex h-14 w-14 items-center justify-center rounded-full border border-border bg-muted/50"
              aria-hidden
            >
              <Library className="h-7 w-7 text-muted-foreground" strokeWidth={1.5} />
            </div>
            <CardTitle className="text-xl">No cards yet</CardTitle>
            <CardDescription className="text-pretty">
              Create cards in Studio or import many at once with bulk create. Everything
              stays on this device until you use cloud backup.
            </CardDescription>
          </CardHeader>
          <CardFooter className="flex flex-col gap-2 pb-8 pt-2 sm:flex-row sm:justify-center">
            <Button asChild className="w-full sm:w-auto">
              <Link href="/studio">Open Studio</Link>
            </Button>
            <Button variant="secondary" asChild className="w-full sm:w-auto">
              <Link href="/studio/bulk">Bulk create</Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold tracking-tight">Collection</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Browse, filter, and export cards from your local vault.
          </p>
        </div>
        <p className="shrink-0 text-xs font-medium tabular-nums text-muted-foreground sm:text-right">
          {displayed.length} shown · {rawRows.length} total
        </p>
      </header>

      <Card className="border-border/80 shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Filters</CardTitle>
          <CardDescription>
            Search and narrow the list; selections apply to bulk export.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="collection-search" className="sr-only">
              Search by name
            </Label>
            <Input
              id="collection-search"
              type="search"
              placeholder="Search by name…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search cards"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            <div className="space-y-2">
              <Label htmlFor="collection-filter-set" className="text-muted-foreground">
                Set
              </Label>
              <SelectNative
                id="collection-filter-set"
                value={filterSetId}
                onChange={(e) => setFilterSetId(e.target.value)}
              >
                <option value="">All sets</option>
                {setOptions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </SelectNative>
            </div>
            <div className="space-y-2">
              <Label htmlFor="collection-filter-rarity" className="text-muted-foreground">
                Rarity
              </Label>
              <SelectNative
                id="collection-filter-rarity"
                value={filterRarity}
                onChange={(e) => setFilterRarity(e.target.value)}
              >
                <option value="">All rarities</option>
                {RARITY_DEFINITIONS.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.label}
                  </option>
                ))}
              </SelectNative>
            </div>
            <div className="space-y-2">
              <Label htmlFor="collection-sort" className="text-muted-foreground">
                Sort
              </Label>
              <SelectNative
                id="collection-sort"
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value)}
              >
                <option value="updatedDesc">Updated (newest)</option>
                <option value="updatedAsc">Updated (oldest)</option>
                <option value="nameAsc">Name A–Z</option>
                <option value="nameDesc">Name Z–A</option>
                <option value="rarity">Rarity</option>
              </SelectNative>
            </div>
            <div className="space-y-2">
              <Label htmlFor="collection-filter-tag" className="text-muted-foreground">
                Tag contains
              </Label>
              <Input
                id="collection-filter-tag"
                placeholder="e.g. promo, foil…"
                value={filterTag}
                onChange={(e) => setFilterTag(e.target.value)}
                aria-label="Filter by collection tag"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-muted-foreground">View</Label>
              <label className="flex h-10 cursor-pointer items-center gap-2 rounded-md border border-input bg-background px-3 text-sm shadow-sm transition-colors hover:bg-muted/40">
                <Checkbox
                  checked={favoritesOnly}
                  onCheckedChange={(v) => setFavoritesOnly(v === true)}
                  aria-label="Favorites only"
                />
                <span className="text-foreground">Favorites only</span>
              </label>
            </div>
          </div>
          <Separator />
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground tabular-nums">
              {selected.size} selected
            </span>
            <Button type="button" variant="outline" size="sm" onClick={selectAllVisible}>
              Select visible
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={clearSelection}>
              Clear
            </Button>
            <Button
              type="button"
              size="sm"
              className="ml-auto"
              disabled={selected.size === 0}
              onClick={() => setExportOpen(true)}
            >
              Export selected…
            </Button>
          </div>
        </CardContent>
      </Card>

      <CollectionBulkExportDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        rows={exportRows}
      />

      {!displayed.length ? (
        <Card className="mx-auto max-w-sm border-border/80 text-center shadow-sm">
          <CardHeader className="items-center space-y-3 pb-2">
            <div
              className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-muted/40"
              aria-hidden
            >
              <SearchX className="h-5 w-5 text-muted-foreground" strokeWidth={1.5} />
            </div>
            <CardTitle className="text-base">No cards match</CardTitle>
            <CardDescription>
              Try clearing search or filters, or add cards in Studio.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 md:gap-5">
          {displayed.map(({ instance, quantity, favorited, tagsJson }) => {
            const rv = rarityVisual(instance.rarity);
            const tags = parseTagsJson(tagsJson);
            const isSel = selected.has(instance.id);
            return (
              <article
                key={instance.id}
                className={cn(
                  "group/card relative isolate rounded-2xl p-0.5",
                  isSel &&
                    "bg-gradient-to-br from-primary/40 via-primary/15 to-transparent p-[2px]",
                )}
              >
                <div
                  className={cn(
                    "relative rounded-[14px] bg-card/30 p-1.5 ring-1 ring-border/60 backdrop-blur-sm",
                    "transition-all duration-300 ease-out will-change-transform",
                    "group-hover/card:-translate-y-1.5 group-hover/card:shadow-[0_22px_44px_-14px_rgba(0,0,0,0.75)] group-hover/card:ring-border",
                  )}
                >
                  <Checkbox
                    checked={isSel}
                    onCheckedChange={() => toggleSelect(instance.id)}
                    aria-label={`Select ${instance.name || "card"}`}
                    className="absolute left-3 top-3 z-20 border-white/40 bg-black/55 shadow-md backdrop-blur-sm data-[state=checked]:border-primary data-[state=checked]:bg-primary"
                    onClick={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                  />
                  <Link
                    href={`/collection/${instance.id}`}
                    className="block min-w-0 outline-none ring-offset-2 ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <div className="relative aspect-[5/7] w-full overflow-hidden rounded-xl bg-zinc-950 shadow-inner ring-1 ring-black/40">
                      {favorited ? (
                        <span
                          className="absolute right-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full border border-amber-400/35 bg-black/55 text-amber-300 shadow-md backdrop-blur-sm"
                          aria-label="Favorited"
                        >
                          <Star className="h-3.5 w-3.5 fill-current" strokeWidth={0} />
                        </span>
                      ) : null}
                      <CardThumb
                        mediaPath={instance.mediaPath}
                        mediaKind={instance.mediaKind}
                        name={instance.name}
                      />
                      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/50 to-transparent opacity-0 transition-opacity duration-300 group-hover/card:opacity-100" />
                    </div>
                    <p className="mt-2.5 truncate px-0.5 text-center text-xs font-semibold tracking-tight text-foreground">
                      {instance.name || "Untitled"}
                    </p>
                    {tags.length ? (
                      <div className="mt-1 flex max-w-full flex-wrap justify-center gap-0.5 px-0.5">
                        {tags.slice(0, 3).map((t, ti) => (
                          <span
                            key={`${t}-${ti}`}
                            className="max-w-[5.5rem] truncate rounded-md border border-border/50 bg-muted/60 px-1 py-0.5 text-[9px] font-medium text-muted-foreground"
                            title={t}
                          >
                            {t}
                          </span>
                        ))}
                        {tags.length > 3 ? (
                          <span className="px-0.5 text-[9px] text-muted-foreground">
                            +{tags.length - 3}
                          </span>
                        ) : null}
                      </div>
                    ) : null}
                    <div className="mt-1 flex flex-wrap items-center justify-center gap-1.5 px-0.5">
                      <span
                        className="max-w-[95%] truncate rounded-full border px-2 py-0.5 text-[10px] font-semibold leading-none shadow-sm"
                        style={{
                          borderColor: `color-mix(in srgb, ${rv.primary} 55%, transparent)`,
                          color: rv.highlight,
                          backgroundColor: rv.soft,
                        }}
                      >
                        {rarityLabel(instance.rarity)}
                      </span>
                      {quantity > 0 ? (
                        <span className="text-[10px] tabular-nums text-muted-foreground">
                          ×{quantity}
                        </span>
                      ) : null}
                    </div>
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CardThumb({
  mediaPath,
  mediaKind,
  name,
}: {
  mediaPath: string;
  mediaKind: string;
  name: string;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "ok" | "missing">(
    "loading",
  );
  const mode = cardMediaMode({ mediaPath, mediaKind });

  useEffect(() => {
    let u: string | null = null;
    setLoadState("loading");
    void (async () => {
      const { loadUserBlob } = await import("@/lib/media/storage");
      const { withPlaybackMime } = await import("@/lib/media/card-media-mode");
      const blob = await loadUserBlob(mediaPath);
      if (blob) {
        const typed = withPlaybackMime(blob, mediaPath);
        u = URL.createObjectURL(typed);
        setUrl(u);
        setLoadState("ok");
      } else {
        setUrl(null);
        setLoadState("missing");
      }
    })();
    return () => {
      if (u) URL.revokeObjectURL(u);
    };
  }, [mediaPath]);

  if (loadState === "missing") {
    return (
      <div className="flex h-full min-h-[4rem] flex-col items-center justify-center gap-1 bg-amber-950/25 px-2 text-center">
        <span className="text-[10px] font-medium text-amber-200/90">
          Art missing
        </span>
        <span className="text-[9px] leading-tight text-muted-foreground">
          Re-upload in Studio if you cleared storage.
        </span>
      </div>
    );
  }

  if (!url) {
    return (
      <div className="flex h-full min-h-[4rem] items-center justify-center bg-muted/50">
        <span className="text-xs text-muted-foreground">Loading…</span>
      </div>
    );
  }

  if (mode === "video") {
    return (
      <video
        src={url}
        muted
        playsInline
        preload="metadata"
        className="h-full w-full scale-[1.02] bg-zinc-950 object-cover transition-transform duration-500 ease-out group-hover/card:scale-[1.05]"
        aria-label={name}
      />
    );
  }

  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element -- OPFS/blob; GIF animates */}
      <img
        src={url}
        alt={name}
        className="h-full w-full bg-zinc-950 object-cover transition-transform duration-500 ease-out group-hover/card:scale-[1.04]"
      />
    </>
  );
}
