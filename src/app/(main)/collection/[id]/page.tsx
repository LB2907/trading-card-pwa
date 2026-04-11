"use client";

import { eq } from "drizzle-orm";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useDb, usePersistDb } from "@/components/app-providers";
import {
  cardInstances,
  cardTemplates,
  collectionEntries,
  tcgSets,
  type CardInstance,
} from "@/lib/db/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { CardDetailPreview } from "@/components/card-detail-preview";
import { CardExportPanel } from "@/components/card-export-panel";
import { parseTagsJson } from "@/lib/collection/tags";
import { cn } from "@/lib/utils";

export default function CardDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const db = useDb();
  const persist = usePersistDb();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [row, setRow] = useState<{
    instance: CardInstance;
    layoutJson: string;
    setName: string | null;
  } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [entryId, setEntryId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [favorited, setFavorited] = useState(false);
  const [tagsInput, setTagsInput] = useState("");
  const [collMsg, setCollMsg] = useState<string | null>(null);

  useEffect(() => {
    setEntryId(null);
    setQuantity(1);
    setFavorited(false);
    setTagsInput("");
    setCollMsg(null);
    void (async () => {
      const [inst] = await db
        .select()
        .from(cardInstances)
        .where(eq(cardInstances.id, id))
        .limit(1);
      if (!inst) {
        setErr("Card not found");
        return;
      }
      const [tpl] = await db
        .select()
        .from(cardTemplates)
        .where(eq(cardTemplates.id, inst.templateId))
        .limit(1);
      const [s] = await db
        .select()
        .from(tcgSets)
        .where(eq(tcgSets.id, inst.setId))
        .limit(1);
      const [ce] = await db
        .select()
        .from(collectionEntries)
        .where(eq(collectionEntries.cardInstanceId, id))
        .limit(1);
      if (ce) {
        setEntryId(ce.id);
        setQuantity(ce.quantity);
        setFavorited(Boolean(ce.favorited));
        setTagsInput(parseTagsJson(ce.tagsJson || "[]").join(", "));
      }
      setRow({
        instance: inst,
        layoutJson: tpl?.layoutJson ?? "{}",
        setName: s?.name ?? null,
      });
    })();
  }, [db, id]);

  if (err) {
    return (
      <Card className="mx-auto max-w-md border-destructive/40 bg-destructive/5">
        <CardHeader>
          <CardTitle className="text-base text-destructive">Something went wrong</CardTitle>
          <CardDescription>{err}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="secondary" asChild>
            <Link href="/collection">Back to collection</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!row) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-muted-foreground">
        <div className="h-8 w-8 animate-pulse rounded-full bg-muted" aria-hidden />
        <p className="text-sm">Loading card…</p>
      </div>
    );
  }

  async function deleteCard() {
    setBusy(true);
    setErr(null);
    try {
      await db
        .delete(collectionEntries)
        .where(eq(collectionEntries.cardInstanceId, id));
      await db.delete(cardInstances).where(eq(cardInstances.id, id));
      persist();
      setDeleteOpen(false);
      router.push("/collection");
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function saveCollectionMeta() {
    setBusy(true);
    setCollMsg(null);
    try {
      const tagsJson = JSON.stringify(
        tagsInput.split(",").map((s) => s.trim()).filter(Boolean),
      );
      if (entryId) {
        await db
          .update(collectionEntries)
          .set({ quantity, favorited, tagsJson })
          .where(eq(collectionEntries.id, entryId));
      } else {
        const nid = crypto.randomUUID();
        await db.insert(collectionEntries).values({
          id: nid,
          cardInstanceId: id,
          quantity,
          favorited,
          tagsJson,
        });
        setEntryId(nid);
      }
      persist();
      setCollMsg("Saved.");
    } catch (e) {
      setCollMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function duplicateCard() {
    const r = row;
    if (!r) return;
    const inst = r.instance;
    setBusy(true);
    setErr(null);
    try {
      const newId = crypto.randomUUID();
      const now = new Date();
      await db.insert(cardInstances).values({
        id: newId,
        setId: inst.setId,
        templateId: inst.templateId,
        mediaPath: inst.mediaPath,
        mediaKind: inst.mediaKind,
        name: `${inst.name || "Card"} (copy)`,
        typeLine: inst.typeLine,
        rarity: inst.rarity,
        statCost: inst.statCost,
        statPower: inst.statPower,
        statDefense: inst.statDefense,
        statSpeed: inst.statSpeed,
        statHealth: inst.statHealth,
        statMind: inst.statMind,
        abilityText: inst.abilityText,
        flavorText: inst.flavorText,
        createdAt: now,
        updatedAt: now,
      });
      await db.insert(collectionEntries).values({
        id: crypto.randomUUID(),
        cardInstanceId: newId,
        quantity: 1,
        favorited: false,
        tagsJson: "[]",
      });
      persist();
      router.push(`/collection/${newId}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const rarityLabel =
    row.instance.rarity.charAt(0).toUpperCase() + row.instance.rarity.slice(1);

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" className="-ml-2 text-muted-foreground" asChild>
          <Link href="/collection">← Collection</Link>
        </Button>
      </div>

      <Card className="overflow-hidden border-border/80 shadow-md">
        <CardHeader className="space-y-3 pb-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <CardTitle className="text-xl sm:text-2xl">
                {row.instance.name || "Untitled card"}
              </CardTitle>
              {row.setName ? (
                <CardDescription className="text-xs sm:text-sm">
                  Set · {row.setName}
                </CardDescription>
              ) : null}
            </div>
            <Badge variant="secondary" className="shrink-0 capitalize">
              {rarityLabel}
            </Badge>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" asChild>
              <Link href={`/studio?edit=${encodeURIComponent(id)}`}>Edit</Link>
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={busy}
              onClick={() => void duplicateCard()}
            >
              Duplicate
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={busy}
              onClick={() => setDeleteOpen(true)}
            >
              Delete
            </Button>
          </div>
        </CardHeader>
        <Separator />
        <CardContent className="pt-6">
          <div className="mx-auto max-w-sm">
            <CardDetailPreview instance={row.instance} layoutJson={row.layoutJson} />
          </div>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete this card?"
        description="This removes the card from your collection on this device. This cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        busy={busy}
        onConfirm={() => void deleteCard()}
      />

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Collection</CardTitle>
          <CardDescription>Quantity, favorite, and tags for this device.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="fav-detail"
              checked={favorited}
              onChange={(e) => setFavorited(e.target.checked)}
              disabled={busy}
              className={cn(
                "h-4 w-4 rounded border-input accent-primary",
                busy && "opacity-50",
              )}
            />
            <Label htmlFor="fav-detail" className="cursor-pointer font-normal">
              Mark as favorite
            </Label>
          </div>
          <div className="space-y-2">
            <Label htmlFor="qty-detail">Quantity</Label>
            <Input
              id="qty-detail"
              type="number"
              min={0}
              dir="ltr"
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value) || 0)}
              disabled={busy}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tags-detail">Tags (comma-separated)</Label>
            <Input
              id="tags-detail"
              dir="ltr"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="e.g. fire, boss, foil"
              disabled={busy}
            />
          </div>
          <Button className="w-full" disabled={busy} onClick={() => void saveCollectionMeta()}>
            Save collection fields
          </Button>
          {collMsg ? (
            <p className="text-center text-sm text-primary">{collMsg}</p>
          ) : null}
        </CardContent>
      </Card>

      <CardExportPanel row={row} />
      <p className="text-center text-xs text-muted-foreground">
        Export only when you intend to move bytes off this device.
      </p>
    </div>
  );
}
