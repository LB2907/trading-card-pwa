"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

type Row = {
  id: string;
  user_id: string;
  title: string;
  body: unknown;
  status: string;
  created_at: string;
};

export default function AdminModerationPage() {
  const [items, setItems] = useState<Row[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    const res = await fetch("/api/admin/moderation/queue", { credentials: "same-origin" });
    const j = (await res.json()) as { error?: string; items?: Row[] };
    if (!res.ok) {
      setErr(j.error || res.statusText);
      setItems([]);
      return;
    }
    setItems(j.items ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function decide(id: string, decision: "approved" | "rejected" | "hidden") {
    setBusyId(id);
    setErr(null);
    try {
      const res = await fetch("/api/admin/moderation/decision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ id, decision }),
      });
      const j = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(j.error || res.statusText);
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 pb-24">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Moderation queue</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Requires{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.7rem]">admin</code> or{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.7rem]">moderator</code>{" "}
            in <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.7rem]">profiles.role</code>{" "}
            (Supabase SQL).
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => void load()}>
            Refresh
          </Button>
          <Button variant="secondary" size="sm" asChild>
            <Link href="/settings">Settings</Link>
          </Button>
        </div>
      </div>
      {err ? (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="py-3 text-sm text-destructive">{err}</CardContent>
        </Card>
      ) : null}
      {items.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No pending submissions.
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-4">
          {items.map((it) => (
            <li key={it.id}>
              <Card className="overflow-hidden shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{it.title}</CardTitle>
                  <CardDescription className="font-mono text-[11px]">
                    {it.id} · {it.user_id} · {it.created_at}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <pre className="max-h-44 overflow-auto rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
                    {JSON.stringify(it.body, null, 2)}
                  </pre>
                </CardContent>
                <Separator />
                <CardFooter className="flex flex-wrap gap-2 py-4">
                  <Button
                    type="button"
                    size="sm"
                    className="bg-emerald-600 text-white hover:bg-emerald-600/90"
                    disabled={busyId === it.id}
                    onClick={() => void decide(it.id, "approved")}
                  >
                    Approve
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={busyId === it.id}
                    onClick={() => void decide(it.id, "rejected")}
                  >
                    Reject
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="border-amber-700/50 text-amber-100 hover:bg-amber-950/40"
                    disabled={busyId === it.id}
                    onClick={() => void decide(it.id, "hidden")}
                  >
                    Hide
                  </Button>
                </CardFooter>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
