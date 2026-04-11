/**
 * @types/react/global.d.ts declares minimal DOM interfaces for non-DOM environments.
 * Under TS 5.9, `ChangeEvent<HTMLInputElement>["target"]` can resolve to
 * `EventTarget & HTMLInputElement` without input-specific fields. Augment merged
 * interfaces so form handlers type-check while keeping `lib: ["dom", ...]`.
 */
/// <reference lib="dom" />
export {};

declare global {
  interface HTMLInputElement {
    checked: boolean;
    files: FileList | null;
    value: string;
  }
  interface HTMLSelectElement {
    value: string;
  }
  interface HTMLTextAreaElement {
    value: string;
  }
}
