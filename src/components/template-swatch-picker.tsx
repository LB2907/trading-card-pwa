"use client";

import { useEffect, useState } from "react";
import { parseLayout } from "@/lib/card-layout";
import { domPreviewShellBackground } from "@/lib/compositor/card-theme";
import { layoutJsonForBuiltinTemplateId } from "@/lib/templates/registry";
import { useDb } from "@/components/app-providers";
import { cardTemplates } from "@/lib/db/schema";

type Tpl = { id: string; name: string };

export function TemplateSwatchPicker({
  templates,
  value,
  onChange,
  disabled,
}: {
  templates: Tpl[];
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
}) {
  const db = useDb();
  const [layoutById, setLayoutById] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const builtin: Record<string, string> = {};
      for (const t of templates) {
        const j = layoutJsonForBuiltinTemplateId(t.id);
        if (j) builtin[t.id] = j;
      }
      const missing = templates.filter((t) => !builtin[t.id]).map((t) => t.id);
      const rows = missing.length
        ? await db.select().from(cardTemplates)
        : [];
      if (cancelled) return;
      const next = { ...builtin };
      for (const t of templates) {
        if (next[t.id]) continue;
        const row = rows.find((r) => r.id === t.id);
        if (row) next[t.id] = row.layoutJson;
      }
      setLayoutById(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [db, templates]);

  return (
    <div
      className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
      role="listbox"
      aria-label="Templates"
    >
      {templates.map((t) => {
        const json = layoutById[t.id];
        const bg = json
          ? domPreviewShellBackground(parseLayout(json))
          : "linear-gradient(135deg, #27272a 0%, #3f3f46 100%)";
        const selected = t.id === value;
        return (
          <button
            key={t.id}
            type="button"
            role="option"
            aria-selected={selected}
            disabled={disabled}
            title={t.name}
            onClick={() => onChange(t.id)}
            className={`flex h-[3.75rem] w-full min-w-0 flex-col items-stretch justify-between gap-1 overflow-hidden rounded-[var(--tc-radius-lg)] border p-1.5 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--tc-accent)] disabled:opacity-40 ${
              selected
                ? "border-[var(--tc-accent)] bg-[var(--tc-surface-hover)] ring-1 ring-[var(--tc-accent)]/40"
                : "border-[var(--tc-border)] bg-zinc-900/60 hover:border-zinc-600"
            }`}
          >
            <span
              className="h-5 w-full shrink-0 rounded-md ring-1 ring-white/10"
              style={{ background: bg }}
              aria-hidden
            />
            <span className="min-h-0 w-full truncate text-center text-[10px] font-medium leading-tight text-zinc-400">
              {t.name}
            </span>
          </button>
        );
      })}
    </div>
  );
}
