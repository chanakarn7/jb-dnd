// File: lib/characters/types.ts
// API response shapes for the Characters module. List = lean payload for pickers;
// Detail = full shape used by the wizard preview + character sheet.
import type { Abilities, AbilityKey, DerivedStat, FeatureView } from "./rules";

// ── Reference (GLOBAL) ──────────────────────────────────────────────
export interface ClassListItem {
  slug: string; name: string; hitDie: number; primaryAbility: string;
  isCaster: boolean; subclassLevel: number;
}
export interface ClassDetail extends ClassListItem {
  saves: AbilityKey[]; armorProf: string[]; weaponProf: string[]; toolProf: string[];
  skillChoices: { from: string[]; count: number };
  spellcasting: { ability: string; type: string } | null;
  levels: { level: number; proficiencyBonus: number; features: string[]; spellSlots: Record<string, number>; counters: Record<string, number> }[];
}
export interface SubclassListItem {
  slug: string; classSlug: string; name: string; flavor: string | null; source: string; license: string;
}
export interface SubclassDetail extends SubclassListItem {
  description: string | null; featuresByLevel: Record<string, string[]>;
}
export interface RaceListItem {
  slug: string; name: string; parentRaceSlug: string | null; size: string; speed: number;
}
export interface RaceDetail extends RaceListItem {
  abilityBonuses: Record<string, number>; traits: { name: string }[]; proficiencies: string[]; languages: string[];
}
export interface BackgroundListItem {
  slug: string; name: string;
}
export interface BackgroundDetail extends BackgroundListItem {
  skillProficiencies: string[]; toolProficiencies: string[]; languages: string[];
  feature: { name: string; desc: string }; startingEquipment: string | null;
}

// ── Character (campaign-scoped) ─────────────────────────────────────
export interface CharacterListItem {
  id: string; name: string; isNpc: boolean; ownedByMe: boolean;
  raceName: string; className: string; subclassName: string | null; level: number;
  currentHp: number; maxHp: number; ac: number;
}
export interface CharacterDetail extends CharacterListItem {
  campaignId: string;
  raceSlug: string; subraceSlug: string | null; classSlug: string;
  subclassSlug: string | null; backgroundSlug: string | null;
  abilities: Abilities; abilityMods: Abilities; abilityMethod: string;
  proficiencyBonus: number; tempHp: number; speed: number; initiative: number;
  saves: Record<AbilityKey, DerivedStat>;
  skills: Record<string, DerivedStat>;
  spellSlots: Record<string, number> | null; // null = non-caster
  features: FeatureView[];
  spells: { slug: string; name: string; level: number; known: boolean; prepared: boolean }[];
  conditions: string[]; overrides: string[]; notes: string | null;
}

// Input payloads (server derives/owns everything else)
export interface CreateCharacterInput {
  name: string;
  raceSlug: string; subraceSlug?: string | null; classSlug: string;
  subclassSlug?: string | null; backgroundSlug?: string | null;
  level?: number;
  abilityMethod: "standard-array" | "point-buy";
  baseAbilities: Abilities; // assigned scores pre-race
  skills?: string[];        // chosen skill proficiencies
  isNpc?: boolean;          // DM only
}
export type UpdateCharacterInput = Partial<{
  name: string; level: number; subclassSlug: string | null;
  str: number; dex: number; con: number; int: number; wis: number; cha: number;
  maxHp: number; currentHp: number; tempHp: number; ac: number; speed: number; initiative: number;
  proficiencyBonus: number; notes: string | null;
  skills: string[];
  resetAuto: string[]; // field names to clear from overrides (re-enable auto)
}>;
