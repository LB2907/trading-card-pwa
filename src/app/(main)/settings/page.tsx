"use client";

import { eq } from "drizzle-orm";
import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { useDb, usePersistDb } from "@/components/app-providers";
import type { TradingCardDb } from "@/lib/db/client";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { CloudAccountPanel } from "@/components/cloud-account-panel";
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
import {
  cardInstances,
  packDefinitions,
  pullHistories,
  tcgSets,
} from "@/lib/db/schema";
import { downloadBlobLocally } from "@/lib/export-card-download";
import {
  clearExportDirectory,
  getExportDirectoryLabel,
  getExportWatermarkText,
  hydrateExportDirHandleFromStorage,
  isFolderExportSupported,
  pickExportDirectory,
  primeExportFolderWriteFromUserGesture,
  setExportWatermarkText,
} from "@/lib/export-preferences";
import { buildVaultBackupZip } from "@/lib/vault/build-backup-zip";
import { createTcgSetWithStarterPack } from "@/lib/sets/create-tcg-set";
import {
  hasPinConfigured,
  isBlurBackground,
  isVaultEnabled,
  lockSession,
  setBlurBackground,
  setPin,
  setVaultEnabled,
} from "@/lib/vault";

async function reloadSets(db: TradingCardDb): Promise<{ id: string; name: string }[]> {
  const rows = await db.select().from(tcgSets);
  return rows.map((r) => ({ id: r.id, name: r.name }));
}

export default function SettingsPage() {
  const db = useDb();
  const persist = usePersistDb();
  const [vault, setVault] = useState(false);
  const [blur, setBlur] = useState(true);
  const [pin1, setPin1] = useState("");
  const [pin2, setPin2] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [sets, setSets] = useState<{ id: string; name: string }[]>([]);
  const [renameDraft, setRenameDraft] = useState<Record<string, string>>({});
  const [newSetName, setNewSetName] = useState("");
  const [deleteSetId, setDeleteSetId] = useState<string | null>(null);
  const [setsBusy, setSetsBusy] = useState(false);
  const [backupBusy, setBackupBusy] = useState(false);
  const [exportDirLabel, setExportDirLabel] = useState("");
  const [watermarkDraft, setWatermarkDraft] = useState("");
  const folderExportSupported = isFolderExportSupported();

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      setVault(isVaultEnabled());
      setBlur(isBlurBackground());
      setExportDirLabel(getExportDirectoryLabel());
      setWatermarkDraft(getExportWatermarkText());
    });
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (getExportDirectoryLabel()) {
      void hydrateExportDirHandleFromStorage();
    }
  }, []);

  useEffect(() => {
    void (async () => {
      const list = await reloadSets(db);
      setSets(list);
      const m: Record<string, string> = {};
      for (const r of list) m[r.id] = r.name;
      setRenameDraft(m);
    })();
  }, [db]);

  async function saveSetName(setId: string) {
    const name = (renameDraft[setId] ?? "").trim();
    if (!name) {
      setMsg("Set name cannot be empty.");
      return;
    }
    setSetsBusy(true);
    setMsg(null);
    try {
      await db.update(tcgSets).set({ name }).where(eq(tcgSets.id, setId));
      persist();
      setSets((s) => s.map((x) => (x.id === setId ? { ...x, name } : x)));
      setMsg("Set name updated.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setSetsBusy(false);
    }
  }

  async function addSet() {
    const trimmed = newSetName.trim();
    if (!trimmed) {
      setMsg("Enter a name for the new set.");
      return;
    }
    setSetsBusy(true);
    setMsg(null);
    try {
      await createTcgSetWithStarterPack(db, trimmed);
      persist();
      const list = await reloadSets(db);
      setSets(list);
      const m: Record<string, string> = {};
      for (const r of list) m[r.id] = r.name;
      setRenameDraft(m);
      setNewSetName("");
      setMsg(`Added “${trimmed}” with a starter Booster pack (see Packs).`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setSetsBusy(false);
    }
  }

  async function deleteSetConfirmed(setId: string) {
    const using = await db
      .select({ id: cardInstances.id })
      .from(cardInstances)
      .where(eq(cardInstances.setId, setId))
      .limit(1);
    if (using.length > 0) {
      setMsg(
        "This set still has cards. Move or delete those cards before deleting the set.",
      );
      setDeleteSetId(null);
      return;
    }
    setSetsBusy(true);
    setMsg(null);
    try {
      const packs = await db
        .select()
        .from(packDefinitions)
        .where(eq(packDefinitions.setId, setId));
      for (const p of packs) {
        await db
          .delete(pullHistories)
          .where(eq(pullHistories.packDefinitionId, p.id));
      }
      await db.delete(packDefinitions).where(eq(packDefinitions.setId, setId));
      await db.delete(tcgSets).where(eq(tcgSets.id, setId));
      persist();
      setSets((s) => s.filter((x) => x.id !== setId));
      setRenameDraft((d) => {
        const next = { ...d };
        delete next[setId];
        return next;
      });
      setDeleteSetId(null);
      setMsg("Set deleted.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setSetsBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-10 pb-16">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Cloud backup, security, exports, and TCG sets on this device.
        </p>
      </div>

      {msg ? (
        <div
          role="status"
          className="flex items-start gap-3 rounded-lg border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-primary"
        >
          <p className="min-w-0 flex-1 leading-snug">{msg}</p>
          <button
            type="button"
            className="shrink-0 rounded-md p-1 text-primary opacity-70 transition hover:bg-primary/15 hover:opacity-100"
            aria-label="Dismiss message"
            onClick={() => setMsg(null)}
          >
            <X className="size-4" />
          </button>
        </div>
      ) : null}

      <section className="space-y-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Cloud
        </h2>
        <CloudAccountPanel />
      </section>

      <Card className="border-border/80 shadow-sm">
        <CardHeader>
          <CardTitle>Local vault backup</CardTitle>
          <CardDescription>
            ZIP includes <code className="rounded bg-muted px-1 py-0.5 text-xs">vault.sqlite</code>{" "}
            plus <code className="rounded bg-muted px-1 py-0.5 text-xs">media/</code> files
            referenced by your cards. Cloud sync (above) is separate.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            type="button"
            variant="secondary"
            disabled={backupBusy}
            onClick={() => {
              primeExportFolderWriteFromUserGesture();
              void (async () => {
                setBackupBusy(true);
                setMsg(null);
                try {
                  persist();
                  await new Promise((r) => setTimeout(r, 400));
                  const zip = await buildVaultBackupZip(db);
                  const name = `vault_backup_${new Date().toISOString().slice(0, 10)}.zip`;
                  await downloadBlobLocally(zip, name);
                  setMsg(
                    `Backup started as ${name} (saved to your export folder if set, otherwise the browser download bar).`,
                  );
                } catch (e) {
                  setMsg(e instanceof Error ? e.message : String(e));
                } finally {
                  setBackupBusy(false);
                }
              })();
            }}
          >
            {backupBusy ? "Building backup…" : "Download vault backup (ZIP)"}
          </Button>
        </CardContent>
      </Card>

      <Card className="border-border/80 shadow-sm">
        <CardHeader>
          <CardTitle>Security & privacy</CardTitle>
          <CardDescription>
            Vault lock, background blur, and PIN for this browser only.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <label className="flex cursor-pointer items-center justify-between gap-4 rounded-lg border border-border bg-muted/25 px-4 py-3.5 transition-colors hover:bg-muted/40">
              <div>
                <span className="text-sm font-medium">Vault lock</span>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Requires a saved PIN before you can turn this on.
                </p>
              </div>
              <input
                type="checkbox"
                className="size-4 shrink-0 rounded border-input accent-primary"
                checked={vault}
                onChange={(e) => {
                  const v = e.target.checked;
                  if (v && !hasPinConfigured()) {
                    setMsg("Save a PIN below before enabling the vault.");
                    return;
                  }
                  setVault(v);
                  setVaultEnabled(v);
                  setMsg(null);
                }}
              />
            </label>
            <label className="flex cursor-pointer items-center justify-between gap-4 rounded-lg border border-border bg-muted/25 px-4 py-3.5 transition-colors hover:bg-muted/40">
              <span className="text-sm font-medium">Blur when app is in background</span>
              <input
                type="checkbox"
                className="size-4 shrink-0 rounded border-input accent-primary"
                checked={blur}
                onChange={(e) => {
                  setBlur(e.target.checked);
                  setBlurBackground(e.target.checked);
                }}
              />
            </label>
          </div>

          <Separator />

          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-medium">PIN</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Hashed (SHA-256) and stored in localStorage on this device only.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="settings-pin-new">New PIN</Label>
                <Input
                  id="settings-pin-new"
                  type="password"
                  inputMode="numeric"
                  placeholder="New PIN"
                  value={pin1}
                  onChange={(e) => setPin1(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="settings-pin-confirm">Confirm</Label>
                <Input
                  id="settings-pin-confirm"
                  type="password"
                  inputMode="numeric"
                  placeholder="Confirm PIN"
                  value={pin2}
                  onChange={(e) => setPin2(e.target.value)}
                />
              </div>
            </div>
            <Button
              type="button"
              onClick={async () => {
                if (pin1.length < 4) {
                  setMsg("PIN must be at least 4 characters.");
                  return;
                }
                if (pin1 !== pin2) {
                  setMsg("PINs do not match.");
                  return;
                }
                await setPin(pin1);
                setPin1("");
                setPin2("");
                setMsg("PIN saved.");
              }}
            >
              Save PIN
            </Button>
          </div>

          <Separator />

          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => {
              lockSession();
              window.location.reload();
            }}
          >
            Lock session now
          </Button>
        </CardContent>
      </Card>

      <Card className="border-border/80 shadow-sm">
        <CardHeader>
          <CardTitle>Export defaults</CardTitle>
          <CardDescription>
            Optional folder for file exports and watermark text on rendered cards.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={!folderExportSupported}
              onClick={() => {
                setMsg(null);
                void pickExportDirectory()
                  .then((label) => {
                    setExportDirLabel(label);
                    setMsg("Export folder saved.");
                  })
                  .catch((e) => {
                    setMsg(e instanceof Error ? e.message : String(e));
                  });
              }}
            >
              Choose export folder
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                clearExportDirectory();
                setExportDirLabel("");
                setMsg("Export folder cleared.");
              }}
            >
              Clear folder
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Active folder:{" "}
            <span className="font-medium text-foreground">
              {exportDirLabel || "Not set — browser download bar"}
            </span>
          </p>
          {!folderExportSupported ? (
            <p className="rounded-md border border-amber-900/40 bg-amber-950/20 px-3 py-2 text-xs text-amber-200/90">
              Folder export needs https, a Chromium-based browser (Chrome, Edge,
              Arc), and the File System Access API.
            </p>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="settings-watermark">Watermark text</Label>
            <Input
              id="settings-watermark"
              dir="ltr"
              placeholder="e.g. Leon's Collection"
              value={watermarkDraft}
              onChange={(e) => setWatermarkDraft(e.target.value)}
              onBlur={() => {
                setExportWatermarkText(watermarkDraft);
                setMsg("Watermark saved.");
              }}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/80 shadow-sm">
        <CardHeader>
          <CardTitle>TCG sets</CardTitle>
          <CardDescription>
            Add sets for Studio and Packs. Each new set gets a starter “Booster” pack.
            Rename or delete empty sets (no cards); deleting removes that pack too.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1 space-y-2">
              <Label htmlFor="settings-new-set">New set name</Label>
              <Input
                id="settings-new-set"
                dir="ltr"
                placeholder="e.g. Cyber League 2026"
                value={newSetName}
                disabled={setsBusy}
                onChange={(e) => setNewSetName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void addSet();
                }}
              />
            </div>
            <Button
              type="button"
              disabled={setsBusy}
              className="shrink-0 sm:w-auto"
              onClick={() => void addSet()}
            >
              Add set
            </Button>
          </div>

          <Separator />

          {sets.length === 0 ? (
            <p className="text-sm text-muted-foreground">No sets yet — add one above.</p>
          ) : (
            <ul className="space-y-3">
              {sets.map((s) => (
                <li
                  key={s.id}
                  className="rounded-xl border border-border/80 bg-muted/15 p-4 transition-colors hover:bg-muted/25"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                    <div className="min-w-0 flex-1 space-y-2">
                      <Label
                        htmlFor={`set-name-${s.id}`}
                        className="text-xs text-muted-foreground"
                      >
                        Display name
                      </Label>
                      <Input
                        id={`set-name-${s.id}`}
                        dir="ltr"
                        value={renameDraft[s.id] ?? s.name}
                        disabled={setsBusy}
                        onChange={(e) =>
                          setRenameDraft((d) => ({ ...d, [s.id]: e.target.value }))
                        }
                      />
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        disabled={setsBusy}
                        onClick={() => void saveSetName(s.id)}
                      >
                        Save name
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        disabled={setsBusy}
                        onClick={() => setDeleteSetId(s.id)}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={deleteSetId !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteSetId(null);
        }}
        title="Delete this set?"
        description="Only sets with no cards can be deleted. Associated booster pack definitions and pull history for this set are removed."
        confirmLabel="Delete set"
        cancelLabel="Cancel"
        variant="danger"
        busy={setsBusy}
        onConfirm={() => {
          if (deleteSetId) void deleteSetConfirmed(deleteSetId);
        }}
      />
    </div>
  );
}
