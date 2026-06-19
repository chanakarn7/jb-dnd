// Shared types for the 5e Reference module (Sprint 1).
// List types = lean payload for rows + client-side filtering.
// Detail types = full card / statblock.
// See docs/modules/5e-reference/SA_BLUEPRINT.md §4.1.

export type ReferenceKind = "spells" | "monsters" | "items";

export interface SpellListItem {
  slug: string;
  name: string;
  level: number; // 0 = cantrip
  school: string;
  castingTime: string;
  ritual: boolean;
  concentration: boolean;
  classes: string[];
}
export interface SpellDetail extends SpellListItem {
  range: string;
  duration: string;
  components: { v: boolean; s: boolean; m: string | null };
  description: string;
  higherLevels: string | null;
  source: string;
}

export interface MonsterListItem {
  slug: string;
  name: string;
  cr: string; // display ("1/4")
  crSort: number; // numeric for range filter/sort
  type: string;
  size: string;
  hp: number;
  ac: number;
}
export interface MonsterDetail extends MonsterListItem {
  alignment: string;
  xp: number;
  acNote: string | null;
  hpFormula: string | null;
  speed: string;
  abilityScores: Record<"str" | "dex" | "con" | "int" | "wis" | "cha", number>;
  saves: Record<string, string>;
  skills: Record<string, string>;
  senses: string | null;
  languages: string | null;
  immunities: { damage: string[]; condition: string[] };
  resistances: string[];
  traits: { name: string; desc: string }[];
  actions: { name: string; desc: string; kind: "action" | "legendary" | "reaction" }[];
  source: string;
}

export interface ItemListItem {
  slug: string;
  name: string;
  type: string;
  rarity: string;
  requiresAttunement: boolean;
}
export interface ItemDetail extends ItemListItem {
  properties: Record<string, unknown>;
  description: string | null;
  source: string;
}
