/** Client-side DDL matching [schema.ts](schema.ts). SQLite + foreign keys. */
export const INIT_SQL = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS tcg_sets (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  symbol_asset_path TEXT,
  rarity_weights_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS card_templates (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  layout_json TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS card_instances (
  id TEXT PRIMARY KEY NOT NULL,
  set_id TEXT NOT NULL REFERENCES tcg_sets(id),
  template_id TEXT NOT NULL REFERENCES card_templates(id),
  media_path TEXT NOT NULL,
  media_kind TEXT NOT NULL DEFAULT 'image',
  name TEXT NOT NULL DEFAULT '',
  type_line TEXT NOT NULL DEFAULT '',
  rarity TEXT NOT NULL DEFAULT 'common',
  stat_power INTEGER NOT NULL DEFAULT 0,
  stat_defense INTEGER NOT NULL DEFAULT 0,
  stat_cost INTEGER NOT NULL DEFAULT 0,
  stat_speed INTEGER NOT NULL DEFAULT 0,
  stat_health INTEGER NOT NULL DEFAULT 0,
  stat_mind INTEGER NOT NULL DEFAULT 0,
  ability_text TEXT NOT NULL DEFAULT '',
  flavor_text TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS collection_entries (
  id TEXT PRIMARY KEY NOT NULL,
  card_instance_id TEXT NOT NULL REFERENCES card_instances(id),
  quantity INTEGER NOT NULL DEFAULT 1,
  favorited INTEGER NOT NULL DEFAULT 0,
  tags_json TEXT NOT NULL DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS pack_definitions (
  id TEXT PRIMARY KEY NOT NULL,
  set_id TEXT NOT NULL REFERENCES tcg_sets(id),
  name TEXT NOT NULL,
  slots_per_pack INTEGER NOT NULL DEFAULT 5,
  slot_rules_json TEXT NOT NULL DEFAULT '{}',
  rarity_weights_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS pull_histories (
  id TEXT PRIMARY KEY NOT NULL,
  pack_definition_id TEXT NOT NULL REFERENCES pack_definitions(id),
  pulled_card_ids_json TEXT NOT NULL DEFAULT '[]',
  pulled_at INTEGER NOT NULL
);
`;
