"use client";

import { eq } from "drizzle-orm";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useDb, usePersistDb } from "@/components/app-providers";
import { CardDetailPreview } from "@/components/card-detail-preview";
import { TemplateSwatchPicker } from "@/components/template-swatch-picker";
import {
  cardInstances,
  cardTemplates,
  tcgSets,
  type CardInstance,
} from "@/lib/db/schema";
import { RARITY_DEFINITIONS } from "@/lib/rarity";
import { parseLayout } from "@/lib/card-layout";
import {
  domPreviewArtRoundedClass,
  domPreviewOuterRingClass,
  domPreviewRoundedClass,
  domPreviewShellBackground,
} from "@/lib/compositor/card-theme";
import {
  fallbackLayoutJsonString,
  layoutJsonForBuiltinTemplateId,
} from "@/lib/templates/registry";
import {
  insertCardWithCollection,
  storeArtFile,
} from "@/lib/cards/create-from-upload";
import { createTcgSetWithStarterPack } from "@/lib/sets/create-tcg-set";
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
import { SelectNative } from "@/components/ui/select-native";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";

const DRAFT_ID = "00000000-0000-4000-8000-000000000001";

function StudioPreviewPlaceholder({ layoutJson }: { layoutJson: string }) {
  const layout = parseLayout(layoutJson);
  const mat = layout.artMatColor ?? "#08080a";
  const shellBg = domPreviewShellBackground(layout);
  const outerRing = domPreviewOuterRingClass(layout);
  const roundOuter = domPreviewRoundedClass(layout);
  const roundArt = domPreviewArtRoundedClass(layout);
  return (
    <div
      className={`flex w-full min-h-0 flex-col overflow-hidden shadow-xl ${outerRing} ${roundOuter}`}
      style={{
        aspectRatio: "5/7",
        boxShadow:
          "0 22px 48px rgba(0,0,0,0.52), 0 0 0 1px rgba(255,255,255,0.04)",
        background: shellBg,
      }}
    >
      <div
        className={`relative mx-2 mt-2 flex min-h-0 flex-1 flex-col items-center justify-center overflow-hidden ring-1 ring-white/12 ${roundArt}`}
        style={{
          backgroundColor: mat,
          boxShadow:
            "inset 0 1px 0 rgba(255,255,255,0.12), inset 0 -10px 20px rgba(0,0,0,0.35)",
        }}
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-1/4 bg-gradient-to-b from-white/[0.06] to-transparent" />
        <div className="relative z-[1] flex flex-col items-center gap-2 px-6 text-center">
          <p className="text-sm font-medium text-zinc-300">Live preview</p>
          <p className="max-w-[14rem] text-xs leading-relaxed text-zinc-500">
            Add card art to render the full card with this template and stats.
          </p>
        </div>
      </div>
      <div className="flex min-h-[28%] shrink-0 flex-col justify-center gap-2 border-t border-white/[0.06] px-4 pb-4 pt-3">
        <div className="h-2.5 w-3/5 rounded-full bg-white/[0.06]" />
        <div className="h-2 w-2/5 rounded-full bg-white/[0.04]" />
        <div className="flex flex-wrap gap-1.5">
          <span className="h-5 w-10 rounded-full bg-white/[0.05]" />
          <span className="h-5 w-10 rounded-full bg-white/[0.05]" />
          <span className="h-5 w-10 rounded-full bg-white/[0.05]" />
        </div>
      </div>
    </div>
  );
}

function StudioPageInner() {
  const db = useDb();
  const persist = usePersistDb();
  const router = useRouter();
  const searchParams = useSearchParams();
  const editQueryId = searchParams.get("edit");

  const [sets, setSets] = useState<{ id: string; name: string }[]>([]);
  const [tpls, setTpls] = useState<{ id: string; name: string }[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [setId, setSetId] = useState("");
  const [tplId, setTplId] = useState("");
  const [layoutJson, setLayoutJson] = useState(
    () =>
      layoutJsonForBuiltinTemplateId("tpl_arena") ?? fallbackLayoutJsonString(),
  );
  const [name, setName] = useState("New Card");
  const [typeLine, setTypeLine] = useState("");
  const [rarity, setRarity] = useState<string>("common");
  const [cost, setCost] = useState("0");
  const [power, setPower] = useState("0");
  const [defense, setDefense] = useState("0");
  const [speed, setSpeed] = useState("0");
  const [health, setHealth] = useState("0");
  const [mind, setMind] = useState("0");
  const [ability, setAbility] = useState("");
  const [flavor, setFlavor] = useState("");
  const [mediaId, setMediaId] = useState<string | null>(null);
  const [mediaKind, setMediaKind] = useState("image");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [newSetName, setNewSetName] = useState("");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const s = await db.select().from(tcgSets);
      const t = await db.select().from(cardTemplates);
      if (cancelled) return;
      setSets(s.map((r) => ({ id: r.id, name: r.name })));
      setTpls(t.map((r) => ({ id: r.id, name: r.name })));

      if (editQueryId) {
        const [inst] = await db
          .select()
          .from(cardInstances)
          .where(eq(cardInstances.id, editQueryId))
          .limit(1);
        if (cancelled) return;
        if (inst) {
          setEditingId(inst.id);
          setSetId(inst.setId);
          setTplId(inst.templateId);
          setName(inst.name || "Card");
          setTypeLine(inst.typeLine || "");
          setRarity(inst.rarity || "common");
          setCost(String(inst.statCost ?? 0));
          setPower(String(inst.statPower ?? 0));
          setDefense(String(inst.statDefense ?? 0));
          setSpeed(String(inst.statSpeed ?? 0));
          setHealth(String(inst.statHealth ?? 0));
          setMind(String(inst.statMind ?? 0));
          setAbility(inst.abilityText || "");
          setFlavor(inst.flavorText || "");
          setMediaId(inst.mediaPath);
          setMediaKind(inst.mediaKind || "image");
          setMsg(null);
          return;
        }
        setMsg("That card was not found. Creating a new card instead.");
      }
      setEditingId(null);
      if (s[0]) setSetId(s[0].id);
      const duelist = t.find((row) => row.id === "tpl_arena");
      setTplId(duelist?.id ?? t[0]?.id ?? "");
      setName("New Card");
      setTypeLine("");
      setRarity("common");
      setCost("0");
      setPower("0");
      setDefense("0");
      setSpeed("0");
      setHealth("0");
      setMind("0");
      setAbility("");
      setFlavor("");
      setMediaId(null);
      setMediaKind("image");
    })();
    return () => {
      cancelled = true;
    };
  }, [db, editQueryId]);

  /** Built-in layouts apply synchronously so preview tracks the template dropdown. */
  useEffect(() => {
    if (!tplId) return;
    const builtin = layoutJsonForBuiltinTemplateId(tplId);
    if (builtin) {
      setLayoutJson(builtin);
      return;
    }
    let cancelled = false;
    void (async () => {
      const [t] = await db
        .select()
        .from(cardTemplates)
        .where(eq(cardTemplates.id, tplId))
        .limit(1);
      if (!cancelled) {
        setLayoutJson(t?.layoutJson ?? fallbackLayoutJsonString());
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [db, tplId]);

  const draftInstance: CardInstance = useMemo(
    () => ({
      id: DRAFT_ID,
      setId: setId || "set_core",
      templateId: tplId || "tpl_arena",
      mediaPath: mediaId ?? "",
      mediaKind,
      name,
      typeLine,
      rarity,
      statCost: Number(cost) || 0,
      statPower: Number(power) || 0,
      statDefense: Number(defense) || 0,
      statSpeed: Number(speed) || 0,
      statHealth: Number(health) || 0,
      statMind: Number(mind) || 0,
      abilityText: ability,
      flavorText: flavor,
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
    [
      setId,
      tplId,
      mediaId,
      mediaKind,
      name,
      typeLine,
      rarity,
      cost,
      power,
      defense,
      speed,
      health,
      mind,
      ability,
      flavor,
    ],
  );

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setMsg(null);
    try {
      const { mediaPath, mediaKind: kind } = await storeArtFile(file);
      setMediaId(mediaPath);
      setMediaKind(kind);
      if (kind === "gif") {
        setMsg("GIF stored locally (animated in collection & detail).");
      } else if (kind === "video") {
        setMsg("Video stored locally (plays in detail view).");
      } else if (file.type === "image/webp" || file.name.toLowerCase().endsWith(".webp")) {
        setMsg("WebP converted to JPEG and stored locally.");
      } else {
        setMsg("Image stored locally.");
      }
    } catch (err) {
      setMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  function randomizeStats() {
    const r = () => crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32;
    const ir = (lo: number, hi: number) =>
      lo + Math.floor(r() * (hi - lo + 1));
    setCost(String(ir(0, 9)));
    setPower(String(ir(0, 12)));
    setDefense(String(ir(0, 12)));
    setSpeed(String(ir(0, 10)));
    setHealth(String(ir(1, 20)));
    setMind(String(ir(0, 12)));
  }

  async function createSet() {
    const trimmed = newSetName.trim();
    if (!trimmed) {
      setMsg("Enter a set name.");
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const { setId: setRowId } = await createTcgSetWithStarterPack(db, trimmed);
      const s = await db.select().from(tcgSets);
      setSets(s.map((row) => ({ id: row.id, name: row.name })));
      setSetId(setRowId);
      setNewSetName("");
      setMsg(`Created set "${trimmed}".`);
      persist();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!mediaId || !setId || !tplId) {
      setMsg("Pick art and ensure set/template exist.");
      return;
    }
    setBusy(true);
    const now = new Date();
    try {
      if (editingId) {
        await db
          .update(cardInstances)
          .set({
            setId,
            templateId: tplId,
            mediaPath: mediaId,
            mediaKind,
            name,
            typeLine,
            rarity,
            statCost: Number(cost) || 0,
            statPower: Number(power) || 0,
            statDefense: Number(defense) || 0,
            statSpeed: Number(speed) || 0,
            statHealth: Number(health) || 0,
            statMind: Number(mind) || 0,
            abilityText: ability,
            flavorText: flavor,
            updatedAt: now,
          })
          .where(eq(cardInstances.id, editingId));
        persist();
        router.push(`/collection/${editingId}`);
        return;
      }
      const id = await insertCardWithCollection(
        db,
        { mediaPath: mediaId, mediaKind },
        {
          setId,
          templateId: tplId,
          name,
          typeLine,
          rarity,
          statCost: Number(cost) || 0,
          statPower: Number(power) || 0,
          statDefense: Number(defense) || 0,
          statSpeed: Number(speed) || 0,
          statHealth: Number(health) || 0,
          statMind: Number(mind) || 0,
          abilityText: ability,
          flavorText: flavor,
        },
      );
      persist();
      router.push(`/collection/${id}`);
      return;
    } catch (err) {
      setMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto w-full pb-12">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold tracking-tight text-foreground">
            {editingId ? "Edit card" : "Studio"}
          </h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Files stay in this browser (OPFS or IndexedDB). Nothing uploads until you export.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {editingId ? (
            <>
              <Button variant="outline" size="sm" asChild>
                <Link href={`/collection/${editingId}`}>Back to card</Link>
              </Button>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/studio">New card</Link>
              </Button>
            </>
          ) : null}
          <Button variant="secondary" size="sm" asChild>
            <Link href="/studio/bulk">Bulk create →</Link>
          </Button>
        </div>
      </div>

      <div
        className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(300px,440px)] lg:items-start lg:gap-10"
        dir="ltr"
      >
        <Card className="isolate order-2 border-border/80 shadow-md lg:order-1 [direction:ltr]">
          <CardHeader className="space-y-1 pb-2">
            <CardTitle className="text-lg">Card details</CardTitle>
            <CardDescription>Art, set, template, text, and stats.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 pt-2">
            <label className="flex cursor-pointer flex-col gap-2 rounded-lg border border-dashed border-input bg-muted/20 p-4 transition-colors hover:border-primary/40 hover:bg-muted/30">
              <span className="text-sm font-medium text-foreground">
                Card art{editingId ? " (replace optional)" : ""}
              </span>
              <input
                type="file"
                accept="image/*,video/*,.gif,.webp,video/webm"
                className="text-xs text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-secondary-foreground"
                disabled={busy}
                onChange={onPick}
              />
            </label>

            {msg ? (
              <p className="rounded-md border border-primary/25 bg-primary/10 px-3 py-2 text-sm text-primary">
                {msg}
              </p>
            ) : null}

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="studio-set">Set</Label>
                <SelectNative
                  id="studio-set"
                  value={setId}
                  onChange={(e) => setSetId(e.target.value)}
                >
                  {sets.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </SelectNative>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <div className="min-w-0 flex-1 space-y-2">
                  <Label htmlFor="studio-new-set">New set name</Label>
                  <Input
                    id="studio-new-set"
                    dir="ltr"
                    value={newSetName}
                    placeholder="e.g. Crimson Tide"
                    onChange={(e) => setNewSetName(e.target.value)}
                  />
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="shrink-0"
                  disabled={busy}
                  onClick={() => void createSet()}
                >
                  Create set
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Each set gets a Booster on the Packs page. Saved cards go to the selected set.
              </p>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label>Template</Label>
              <TemplateSwatchPicker
                templates={tpls}
                value={tplId}
                onChange={setTplId}
                disabled={busy}
              />
              <p className="text-xs text-muted-foreground">
                Skirmish, Planeswalker, Trainer, Duelist — preview updates as you edit.
              </p>
            </div>

            <div className="grid gap-4">
              <div className="space-y-2">
                <Label htmlFor="studio-name">Name</Label>
                <Input
                  id="studio-name"
                  dir="ltr"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="studio-type">Type line</Label>
                <Input
                  id="studio-type"
                  dir="ltr"
                  value={typeLine}
                  onChange={(e) => setTypeLine(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="studio-rarity">Rarity</Label>
                <SelectNative
                  id="studio-rarity"
                  value={rarity}
                  onChange={(e) => setRarity(e.target.value)}
                >
                  {RARITY_DEFINITIONS.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.label}
                    </option>
                  ))}
                </SelectNative>
              </div>
              <div>
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <Label className="text-muted-foreground">Stats</Label>
                  <Button type="button" variant="outline" size="sm" onClick={randomizeStats}>
                    Randomize
                  </Button>
                </div>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                  <Field label="Cost (C)" v={cost} set={setCost} />
                  <Field label="Power (P)" v={power} set={setPower} />
                  <Field label="Defense (D)" v={defense} set={setDefense} />
                  <Field label="Speed (S)" v={speed} set={setSpeed} />
                  <Field label="Health (HP)" v={health} set={setHealth} />
                  <Field label="Mind (M)" v={mind} set={setMind} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="studio-ability">Ability</Label>
                <Textarea
                  id="studio-ability"
                  dir="ltr"
                  value={ability}
                  onChange={(e) => setAbility(e.target.value)}
                  rows={4}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="studio-flavor">Flavor</Label>
                <Textarea
                  id="studio-flavor"
                  dir="ltr"
                  value={flavor}
                  onChange={(e) => setFlavor(e.target.value)}
                  rows={2}
                />
              </div>
            </div>

            <Button
              type="button"
              size="lg"
              className="w-full"
              disabled={busy || !mediaId}
              onClick={() => void save()}
            >
              {editingId ? "Save changes" : "Save card"}
            </Button>
          </CardContent>
        </Card>

        <aside className="order-1 mx-auto w-full max-w-md space-y-3 lg:sticky lg:top-8 lg:order-2 [direction:ltr]">
          <div className="rounded-lg border border-border/60 bg-card/30 px-1 py-1">
            <h2 className="px-3 pb-2 pt-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Preview
            </h2>
            {mediaId ? (
              <CardDetailPreview
                key={tplId}
                instance={draftInstance}
                layoutJson={layoutJson}
              />
            ) : (
              <StudioPreviewPlaceholder key={tplId} layoutJson={layoutJson} />
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

function Field({
  label,
  v,
  set,
}: {
  label: string;
  v: string;
  set: (s: string) => void;
}) {
  const id = `stat-${label.replace(/[^a-zA-Z0-9]/g, "")}`;
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </Label>
      <Input
        id={id}
        type="number"
        dir="ltr"
        className="h-9"
        value={v}
        onChange={(e) => set(e.target.value)}
      />
    </div>
  );
}

export default function StudioPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground">
          Loading studio…
        </div>
      }
    >
      <StudioPageInner />
    </Suspense>
  );
}
