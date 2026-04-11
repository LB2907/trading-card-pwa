import type {
  CardInstance,
  CardTemplate,
  CollectionEntry,
  PackDefinition,
  PullHistory,
  TcgSet,
} from "@/lib/db/schema";

export type CloudSnapshotV1 = {
  v: 1;
  exportedAt: string;
  sets: TcgSet[];
  templates: CardTemplate[];
  instances: CardInstance[];
  collection: CollectionEntry[];
  packs: PackDefinition[];
  pulls: PullHistory[];
};

export function isCloudSnapshotV1(x: unknown): x is CloudSnapshotV1 {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return (
    o.v === 1 &&
    typeof o.exportedAt === "string" &&
    Array.isArray(o.sets) &&
    Array.isArray(o.templates) &&
    Array.isArray(o.instances) &&
    Array.isArray(o.collection) &&
    Array.isArray(o.packs) &&
    Array.isArray(o.pulls)
  );
}
