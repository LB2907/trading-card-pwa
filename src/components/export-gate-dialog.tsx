"use client";

import { useState } from "react";

type Props = {
  onConfirm: () => void;
  label: string;
};

/** Explicit opt-in before creating a file that may be shared. */
export function ExportGateDialog({ onConfirm, label }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="w-full rounded-xl bg-[var(--tc-btn-primary-bg)] py-3 text-center text-sm font-semibold text-[#14100b] hover:bg-[var(--tc-btn-primary-hover)]"
        onClick={() => setOpen(true)}
      >
        {label}
      </button>
      {open && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-4">
          <div className="max-w-md rounded-2xl border border-zinc-700 bg-zinc-900 p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-white">Export card image</h2>
            <p className="mt-2 text-sm text-zinc-400">
              This downloads a PNG to your device. You may then share it through
              any app you choose. The server never sees your art.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-lg px-4 py-2 text-sm text-zinc-400 hover:bg-zinc-800"
                onClick={() => setOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-lg bg-[var(--tc-btn-primary-bg)] px-4 py-2 text-sm font-medium text-[#14100b] hover:bg-[var(--tc-btn-primary-hover)]"
                onClick={() => {
                  setOpen(false);
                  onConfirm();
                }}
              >
                Download PNG
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
