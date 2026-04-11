"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useDb, usePersistDb } from "@/components/app-providers";
import {
  insertCardWithCollection,
  storeArtFile,
} from "@/lib/cards/create-from-upload";
import { cardTemplates, tcgSets } from "@/lib/db/schema";
import { RARITY_DEFINITIONS } from "@/lib/rarity";
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

function sanitizeStem(name: string): string {
  const base = name.replace(/\.[^/.]+$/, "").trim() || "Card";
  return base.replace(/[^\w\s-]/g, "").replace(/\s+/g, " ").slice(0, 80);
}

export default function BulkStudioPage() {
  const db = useDb();
  const persist = usePersistDb();
  const router = useRouter();
  const [sets, setSets] = useState<{ id: string; name: string }[]>([]);
  const [tpls, setTpls] = useState<{ id: string; name: string }[]>([]);
  const [setId, setSetId] = useState("");
  const [tplId, setTplId] = useState("");
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
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [done, setDone] = useState(0);
  const [total, setTotal] = useState(0);
  const [failures, setFailures] = useState<{ file: string; reason: string }[]>(
    [],
  );

  useEffect(() => {
    void (async () => {
      const s = await db.select().from(tcgSets);
      const t = await db.select().from(cardTemplates);
      setSets(s.map((r) => ({ id: r.id, name: r.name })));
      setTpls(t.map((r) => ({ id: r.id, name: r.name })));
      if (s[0]) setSetId(s[0].id);
      const duelist = t.find((row) => row.id === "tpl_arena");
      setTplId(duelist?.id ?? t[0]?.id ?? "");
    })();
  }, [db]);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const list = e.target.files;
    if (!list?.length || !setId || !tplId) {
      setMsg("Pick files and ensure a set and template are selected.");
      return;
    }
    const files = Array.from(list);
    setBusy(true);
    setMsg(null);
    setFailures([]);
    setDone(0);
    setTotal(files.length);

    const usedNames = new Set<string>();
    const queue = [...files];
    const concurrency = 2;
    const failed: { file: string; reason: string }[] = [];

    async function worker() {
      while (queue.length) {
        const file = queue.shift();
        if (!file) break;
        const stem = sanitizeStem(file.name);
        let name = stem;
        let n = 1;
        while (usedNames.has(name.toLowerCase())) {
          name = `${stem} (${n})`;
          n++;
        }
        usedNames.add(name.toLowerCase());
        try {
          const media = await storeArtFile(file);
          await insertCardWithCollection(db, media, {
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
          });
        } catch (err) {
          failed.push({
            file: file.name,
            reason: err instanceof Error ? err.message : String(err),
          });
        }
        setDone((d) => d + 1);
      }
    }

    try {
      await Promise.all(Array.from({ length: concurrency }, () => worker()));
      persist();
      setFailures(failed);
      setMsg(
        failed.length
          ? `Finished with ${failed.length} error(s). Open collection to review.`
          : "All cards saved.",
      );
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 pb-12">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Bulk create</h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Upload multiple images, GIFs, or videos. Each file becomes one card with the shared
            fields below. Names default to the file name.
          </p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href="/studio">Single-card Studio</Link>
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Files</CardTitle>
          <CardDescription>Select many art files at once.</CardDescription>
        </CardHeader>
        <CardContent>
          <label className="flex cursor-pointer flex-col gap-2 rounded-lg border border-dashed border-input bg-muted/15 p-4 transition-colors hover:border-primary/35 hover:bg-muted/25">
            <span className="text-sm font-medium text-foreground">Card art files</span>
            <input
              type="file"
              multiple
              accept="image/*,video/*,.gif,.webp,video/webm"
              className="text-xs text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-secondary-foreground"
              disabled={busy}
              onChange={(e) => void onPick(e)}
            />
          </label>
        </CardContent>
      </Card>

      {total > 0 ? (
        <div className="space-y-2">
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-[width]"
              style={{ width: `${total ? (done / total) * 100 : 0}%` }}
            />
          </div>
          <p className="text-center text-xs tabular-nums text-muted-foreground">
            {done} / {total}
          </p>
        </div>
      ) : null}

      {msg ? (
        <p className="rounded-md border border-primary/25 bg-primary/10 px-3 py-2 text-sm text-primary">
          {msg}
        </p>
      ) : null}

      {failures.length > 0 ? (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-destructive">Errors</CardTitle>
          </CardHeader>
          <CardContent className="max-h-48 overflow-y-auto">
            <ul className="space-y-1.5 text-xs text-destructive/90">
              {failures.map((f, i) => (
                <li key={`${f.file}-${i}`}>
                  <span className="font-mono text-muted-foreground">{f.file}</span>: {f.reason}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Shared card fields</CardTitle>
          <CardDescription>Applied to every imported file.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="bulk-set">Set</Label>
            <SelectNative
              id="bulk-set"
              value={setId}
              onChange={(e) => setSetId(e.target.value)}
              disabled={busy}
            >
              {sets.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </SelectNative>
          </div>
          <div className="space-y-2">
            <Label htmlFor="bulk-tpl">Template</Label>
            <SelectNative
              id="bulk-tpl"
              value={tplId}
              onChange={(e) => setTplId(e.target.value)}
              disabled={busy}
            >
              {tpls.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </SelectNative>
          </div>
          <div className="space-y-2">
            <Label htmlFor="bulk-rarity">Rarity</Label>
            <SelectNative
              id="bulk-rarity"
              value={rarity}
              onChange={(e) => setRarity(e.target.value)}
              disabled={busy}
            >
              {RARITY_DEFINITIONS.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                </option>
              ))}
            </SelectNative>
          </div>
          <div className="space-y-2">
            <Label htmlFor="bulk-type">Type line (shared)</Label>
            <Input
              id="bulk-type"
              dir="ltr"
              value={typeLine}
              onChange={(e) => setTypeLine(e.target.value)}
              disabled={busy}
            />
          </div>
          <Separator />
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            <Num label="Cost" v={cost} set={setCost} disabled={busy} />
            <Num label="Power" v={power} set={setPower} disabled={busy} />
            <Num label="Defense" v={defense} set={setDefense} disabled={busy} />
            <Num label="Speed" v={speed} set={setSpeed} disabled={busy} />
            <Num label="Health" v={health} set={setHealth} disabled={busy} />
            <Num label="Mind" v={mind} set={setMind} disabled={busy} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bulk-ability">Ability (shared)</Label>
            <Textarea
              id="bulk-ability"
              dir="ltr"
              rows={3}
              value={ability}
              onChange={(e) => setAbility(e.target.value)}
              disabled={busy}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bulk-flavor">Flavor (shared)</Label>
            <Textarea
              id="bulk-flavor"
              dir="ltr"
              rows={2}
              value={flavor}
              onChange={(e) => setFlavor(e.target.value)}
              disabled={busy}
            />
          </div>
        </CardContent>
      </Card>

      <Button className="w-full" size="lg" disabled={busy} onClick={() => router.push("/collection")}>
        Open collection
      </Button>
    </div>
  );
}

function Num({
  label,
  v,
  set,
  disabled,
}: {
  label: string;
  v: string;
  set: (s: string) => void;
  disabled?: boolean;
}) {
  const id = `bulk-num-${label}`;
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
        disabled={disabled}
        onChange={(e) => set(e.target.value)}
      />
    </div>
  );
}
