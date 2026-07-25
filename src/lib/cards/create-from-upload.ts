import type { TradingCardDb } from "@/lib/db/client";
import { cardInstances, collectionEntries } from "@/lib/db/schema";
import {
  extensionOf,
  isVideoFile,
  isWebpFile,
  rasterImageToJpeg,
} from "@/lib/media/import";
import { storeUserBlob } from "@/lib/media/storage";

export async function storeArtFile(
  file: File,
): Promise<{ mediaPath: string; mediaKind: string }> {
  const ext = extensionOf(file);
  if (ext === ".gif") {
    const id = await storeUserBlob(file, ".gif");
    return { mediaPath: id, mediaKind: "gif" };
  }
  if (isVideoFile(file)) {
    const id = await storeUserBlob(file, ext || ".mp4");
    return { mediaPath: id, mediaKind: "video" };
  }
  if (isWebpFile(file)) {
    const jpeg = await rasterImageToJpeg(file);
    const id = await storeUserBlob(jpeg, ".jpg");
    return { mediaPath: id, mediaKind: "image" };
  }
  const id = await storeUserBlob(file, ext || ".bin");
  return { mediaPath: id, mediaKind: "image" };
}

export type NewCardFields = {
  setId: string;
  templateId: string;
  name: string;
  typeLine: string;
  rarity: string;
  statCost: number;
  statPower: number;
  statDefense: number;
  statSpeed: number;
  statHealth: number;
  statMind: number;
  abilityText: string;
  flavorText: string;
  /** Optional bottom-rail text; omitted or empty hides the rail. */
  creditText?: string;
  /** Opt-in rarity foil; off unless the card asks for it. */
  foil?: boolean;
};

export async function insertCardWithCollection(
  db: TradingCardDb,
  media: { mediaPath: string; mediaKind: string },
  fields: NewCardFields,
): Promise<string> {
  const now = new Date();
  const id = crypto.randomUUID();
  await db.insert(cardInstances).values({
    id,
    setId: fields.setId,
    templateId: fields.templateId,
    mediaPath: media.mediaPath,
    mediaKind: media.mediaKind,
    name: fields.name,
    typeLine: fields.typeLine,
    rarity: fields.rarity,
    statCost: fields.statCost,
    statPower: fields.statPower,
    statDefense: fields.statDefense,
    statSpeed: fields.statSpeed,
    statHealth: fields.statHealth,
    statMind: fields.statMind,
    abilityText: fields.abilityText,
    flavorText: fields.flavorText,
    creditText: fields.creditText ?? "",
    foil: fields.foil ?? false,
    createdAt: now,
    updatedAt: now,
  });
  await db.insert(collectionEntries).values({
    id: crypto.randomUUID(),
    cardInstanceId: id,
    quantity: 1,
    favorited: false,
    tagsJson: "[]",
  });
  return id;
}
