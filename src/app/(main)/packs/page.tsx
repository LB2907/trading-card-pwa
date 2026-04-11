"use client";

import { eq } from "drizzle-orm";
import Link from "next/link";
import { ChevronRight, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";
import { useEffect, useState } from "react";
import { useDb } from "@/components/app-providers";
import {
  packDefinitions,
  tcgSets,
  type PackDefinition,
} from "@/lib/db/schema";
import { openPack } from "@/lib/packs";
import { PackOpening } from "@/components/pack-opening";
import type { CardInstance } from "@/lib/db/schema";

type PackRow = PackDefinition & { setName: string };

export default function PacksPage() {
  const db = useDb();
  const [packs, setPacks] = useState<PackRow[]>([]);
  const [opening, setOpening] = useState<CardInstance[] | null>(null);
  const [emptyHint, setEmptyHint] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const p = await db.select().from(packDefinitions);
      const rows: PackRow[] = [];
      for (const pack of p) {
        const [s] = await db
          .select()
          .from(tcgSets)
          .where(eq(tcgSets.id, pack.setId))
          .limit(1);
        rows.push({ ...pack, setName: s?.name ?? pack.setId });
      }
      setPacks(rows);
    })();
  }, [db]);

  return (
    <div className="space-y-6">
      <header className="tc-page-head">
        <h1>Packs</h1>
        <p className="tc-page-head-lead max-w-xl">
          Opens are simulated on this device. Cards must exist in the pack&apos;s set—create them
          in Studio first.
        </p>
      </header>

      {packs.length === 0 ? (
        <Card className="border-dashed border-border/80 bg-muted/10">
          <CardContent className="tc-empty-state py-12">
            <div className="tc-empty-state-icon" aria-hidden>
              <Package className="h-7 w-7" strokeWidth={1.5} />
            </div>
            <CardTitle className="text-center text-base">No booster packs</CardTitle>
            <CardDescription className="max-w-sm text-center text-xs">
              The starter database normally includes a pack. If you removed sets, add a set from
              Studio or reset app data.
            </CardDescription>
            <Button asChild>
              <Link href="/studio">Go to Studio</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
      <ul className="flex flex-col gap-3">
        {packs.map((p) => (
          <li key={p.id}>
            <Card className="overflow-hidden py-0 transition-shadow hover:shadow-md">
            <button
              type="button"
              className="tc-card-tile group flex w-full items-center gap-3 border-0 bg-transparent px-4 py-3.5 text-left"
              onClick={async () => {
                const pulled = await openPack(db, p.id);
                if (!pulled.length) {
                  setEmptyHint(
                    "No cards in this pack's set yet. Create cards in Studio for that set, then try again.",
                  );
                  return;
                }
                setEmptyHint(null);
                setOpening(pulled);
              }}
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[color-mix(in_srgb,var(--tc-accent)_14%,transparent)] text-[var(--tc-accent)]">
                <Package className="h-5 w-5" strokeWidth={1.75} aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-medium text-[var(--tc-text-primary)]">{p.name}</span>
                <span className="mt-0.5 block text-sm text-[var(--tc-text-secondary)]">
                  {p.setName} · {p.slotsPerPack} cards per pack
                </span>
              </span>
              <ChevronRight
                className="h-5 w-5 shrink-0 text-zinc-600 transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--tc-accent)]"
                aria-hidden
              />
            </button>
            </Card>
          </li>
        ))}
      </ul>
      )}

      {emptyHint && (
        <p
          role="alert"
          className="mt-4 rounded-xl border border-amber-900/40 bg-amber-950/25 px-4 py-3 text-sm leading-snug text-amber-100/90"
        >
          {emptyHint}
        </p>
      )}

      {opening && (
        <PackOpening cards={opening} onDone={() => setOpening(null)} />
      )}
    </div>
  );
}
