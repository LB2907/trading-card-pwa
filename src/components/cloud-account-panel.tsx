"use client";

import { Cloud } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { buildCloudSnapshotV1 } from "@/lib/cloud/build-snapshot";
import { isCloudSnapshotV1 } from "@/lib/cloud/snapshot-types";
import { restoreCloudSnapshot } from "@/lib/cloud/restore-snapshot";
import { useDb, usePersistDb } from "@/components/app-providers";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { Button } from "@/components/ui/button";

export function CloudAccountPanel() {
  const db = useDb();
  const persist = usePersistDb();
  const router = useRouter();
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [lastCloud, setLastCloud] = useState<string | null>(null);
  const [confirmRestore, setConfirmRestore] = useState(false);
  const [pendingSnapshot, setPendingSnapshot] = useState<unknown>(null);

  const refreshUser = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      setUser(null);
      return;
    }
    try {
      const supabase = createSupabaseBrowserClient();
      const { data } = await supabase.auth.getUser();
      setUser(data.user ?? null);
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    void refreshUser();
    if (!isSupabaseConfigured()) return;
    const supabase = createSupabaseBrowserClient();
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      void refreshUser();
    });
    return () => {
      sub.subscription.unsubscribe();
    };
  }, [refreshUser]);

  async function signOut() {
    if (!isSupabaseConfigured()) return;
    setBusy(true);
    setMsg(null);
    try {
      const supabase = createSupabaseBrowserClient();
      await supabase.auth.signOut();
      setUser(null);
      router.refresh();
      setMsg("Signed out.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function pushSnapshot() {
    setBusy(true);
    setMsg(null);
    try {
      const snap = await buildCloudSnapshotV1(db);
      const res = await fetch("/api/sync/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ payload: snap }),
      });
      const j = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(j.error || res.statusText);
      setMsg("Cloud backup updated.");
      setLastCloud(new Date().toISOString());
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function pullMeta() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/sync/pull", { credentials: "same-origin" });
      const j = (await res.json()) as { error?: string; updatedAt?: string | null };
      if (!res.ok) throw new Error(j.error || res.statusText);
      setLastCloud(j.updatedAt ?? null);
      setMsg(j.updatedAt ? `Cloud backup last updated: ${j.updatedAt}` : "No cloud backup yet.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function pullAndOfferRestore() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/sync/pull", { credentials: "same-origin" });
      const j = (await res.json()) as {
        error?: string;
        snapshot?: unknown;
        updatedAt?: string | null;
      };
      if (!res.ok) throw new Error(j.error || res.statusText);
      if (!j.snapshot || !isCloudSnapshotV1(j.snapshot)) {
        setMsg("No snapshot in cloud to restore.");
        return;
      }
      setPendingSnapshot(j.snapshot);
      setConfirmRestore(true);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function applyRestore() {
    if (!pendingSnapshot) return;
    setBusy(true);
    setMsg(null);
    try {
      await restoreCloudSnapshot(db, pendingSnapshot);
      persist();
      setConfirmRestore(false);
      setPendingSnapshot(null);
      setMsg("Local database replaced from cloud. Reloading…");
      window.setTimeout(() => window.location.reload(), 600);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  if (user === undefined) {
    return (
      <div className="tc-panel p-4 sm:p-5">
        <div className="flex items-center gap-2">
          <Cloud className="h-4 w-4 text-[var(--tc-accent)]" strokeWidth={1.75} aria-hidden />
          <h2 className="text-sm font-semibold text-[var(--tc-text-primary)]">Cloud account</h2>
        </div>
        <p className="mt-2 text-sm text-[var(--tc-text-secondary)]">Checking session…</p>
      </div>
    );
  }

  if (!isSupabaseConfigured()) {
    return (
      <div className="tc-panel space-y-2 p-4 sm:p-5">
        <div className="flex items-center gap-2">
          <Cloud className="h-4 w-4 text-zinc-600" strokeWidth={1.75} aria-hidden />
          <h2 className="text-sm font-semibold text-[var(--tc-text-primary)]">Cloud account</h2>
        </div>
        <p className="text-xs leading-relaxed text-[var(--tc-text-secondary)]">
          Configure Supabase environment variables to enable sign-in and cloud backup.
        </p>
      </div>
    );
  }

  return (
    <div className="tc-panel-elevated space-y-4 p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[color-mix(in_srgb,var(--tc-accent)_14%,transparent)] text-[var(--tc-accent)]">
          <Cloud className="h-5 w-5" strokeWidth={1.75} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-[var(--tc-text-primary)]">Cloud account</h2>
          <p className="mt-1 text-xs leading-relaxed text-[var(--tc-text-secondary)]">
            Sign in to back up your local SQLite snapshot to your Supabase project. Restoring{" "}
            <strong className="text-[var(--tc-text-primary)]">replaces</strong> this device&apos;s
            database.
          </p>
        </div>
      </div>
      {user ? (
        <p className="text-xs text-[var(--tc-text-secondary)]">
          Signed in as{" "}
          <span className="font-medium text-[var(--tc-text-primary)]">{user.email}</span>
        </p>
      ) : (
        <p className="text-xs text-[var(--tc-text-secondary)]">Not signed in.</p>
      )}
      <div className="flex flex-wrap gap-2">
        {!user ? (
          <Button size="sm" asChild>
            <Link href="/login">Sign in</Link>
          </Button>
        ) : (
          <>
            <Button size="sm" disabled={busy} onClick={() => void pushSnapshot()}>
              Push backup to cloud
            </Button>
            <Button size="sm" variant="secondary" disabled={busy} onClick={() => void pullMeta()}>
              Cloud status
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="border-amber-800/50 text-amber-100 hover:bg-amber-950/30"
              disabled={busy}
              onClick={() => void pullAndOfferRestore()}
            >
              Restore from cloud…
            </Button>
            <Button size="sm" variant="secondary" disabled={busy} onClick={() => void signOut()}>
              Sign out
            </Button>
            <Button size="sm" variant="outline" asChild>
              <Link href="/admin/moderation">Moderation (staff)</Link>
            </Button>
          </>
        )}
      </div>
      {lastCloud ? (
        <p className="text-xs tabular-nums text-[var(--tc-text-secondary)]">Last checked: {lastCloud}</p>
      ) : null}
      {msg ? (
        <p className="rounded-lg border border-violet-900/35 bg-violet-950/25 px-3 py-2 text-sm text-violet-200/95">
          {msg}
        </p>
      ) : null}

      <ConfirmDialog
        open={confirmRestore}
        onOpenChange={(open) => {
          if (!open) {
            setConfirmRestore(false);
            setPendingSnapshot(null);
          }
        }}
        title="Replace local database?"
        description="This deletes local cards and replaces them with the cloud snapshot. Export first if you are unsure."
        confirmLabel="Replace local data"
        cancelLabel="Cancel"
        variant="danger"
        busy={busy}
        onConfirm={() => void applyRestore()}
      />
    </div>
  );
}
