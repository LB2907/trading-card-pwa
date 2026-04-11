import {
  integer,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

export const tcgSets = sqliteTable("tcg_sets", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  symbolAssetPath: text("symbol_asset_path"),
  rarityWeightsJson: text("rarity_weights_json").notNull().default("{}"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const cardTemplates = sqliteTable("card_templates", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  layoutJson: text("layout_json").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const cardInstances = sqliteTable("card_instances", {
  id: text("id").primaryKey(),
  setId: text("set_id")
    .notNull()
    .references(() => tcgSets.id),
  templateId: text("template_id")
    .notNull()
    .references(() => cardTemplates.id),
  mediaPath: text("media_path").notNull(),
  mediaKind: text("media_kind").notNull().default("image"),
  name: text("name").notNull().default(""),
  typeLine: text("type_line").notNull().default(""),
  rarity: text("rarity").notNull().default("common"),
  statPower: integer("stat_power").notNull().default(0),
  statDefense: integer("stat_defense").notNull().default(0),
  statCost: integer("stat_cost").notNull().default(0),
  statSpeed: integer("stat_speed").notNull().default(0),
  statHealth: integer("stat_health").notNull().default(0),
  statMind: integer("stat_mind").notNull().default(0),
  abilityText: text("ability_text").notNull().default(""),
  flavorText: text("flavor_text").notNull().default(""),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const collectionEntries = sqliteTable("collection_entries", {
  id: text("id").primaryKey(),
  cardInstanceId: text("card_instance_id")
    .notNull()
    .references(() => cardInstances.id),
  quantity: integer("quantity").notNull().default(1),
  favorited: integer("favorited", { mode: "boolean" }).notNull().default(false),
  tagsJson: text("tags_json").notNull().default("[]"),
});

export const packDefinitions = sqliteTable("pack_definitions", {
  id: text("id").primaryKey(),
  setId: text("set_id")
    .notNull()
    .references(() => tcgSets.id),
  name: text("name").notNull(),
  slotsPerPack: integer("slots_per_pack").notNull().default(5),
  slotRulesJson: text("slot_rules_json").notNull().default("{}"),
  rarityWeightsJson: text("rarity_weights_json").notNull().default("{}"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const pullHistories = sqliteTable("pull_histories", {
  id: text("id").primaryKey(),
  packDefinitionId: text("pack_definition_id")
    .notNull()
    .references(() => packDefinitions.id),
  pulledCardIdsJson: text("pulled_card_ids_json").notNull().default("[]"),
  pulledAt: integer("pulled_at", { mode: "timestamp" }).notNull(),
});

export type TcgSet = typeof tcgSets.$inferSelect;
export type CardTemplate = typeof cardTemplates.$inferSelect;
export type CardInstance = typeof cardInstances.$inferSelect;
export type CollectionEntry = typeof collectionEntries.$inferSelect;
export type PackDefinition = typeof packDefinitions.$inferSelect;
export type PullHistory = typeof pullHistories.$inferSelect;
