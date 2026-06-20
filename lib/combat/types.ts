// File: lib/combat/types.ts
// Shared TypeScript interfaces for the Combat module (Sprint 4).
// Source of truth: docs/modules/combat/SA_BLUEPRINT.md §3.3

export type Condition =
  | "Blinded"
  | "Charmed"
  | "Deafened"
  | "Exhaustion"
  | "Frightened"
  | "Grappled"
  | "Incapacitated"
  | "Invisible"
  | "Paralyzed"
  | "Petrified"
  | "Poisoned"
  | "Prone"
  | "Restrained"
  | "Stunned"
  | "Unconscious";

export type ConditionEntry =
  | { name: Exclude<Condition, "Exhaustion"> }
  | { name: "Exhaustion"; level: 1 | 2 | 3 | 4 | 5 | 6 };

export interface CombatantView {
  id: string;
  type: "character" | "monster";
  characterId: string | null;
  monsterSlug: string | null;
  name: string;
  initiative: number | null;
  initiativeOrder: number;
  maxHp: number;
  currentHp: number;
  conditions: ConditionEntry[];
  removed: boolean;
}

export interface EncounterSnapshot {
  id: string;
  campaignId: string;
  name: string | null;
  status: "active" | "ended";
  round: number;
  currentTurnIndex: number;
  allowPlayerHpEdit: boolean;
  combatants: CombatantView[]; // sorted: active (desc initiative) → waiting (null initiative) → removed
}

export type CombatErrorCode =
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "encounter_already_active"
  | "duplicate_combatant"
  | "monster_not_found"
  | "character_not_found"
  | "invalid_initiative"
  | "invalid_hp_delta"
  | "no_active_combatants";

export interface CombatError {
  error: CombatErrorCode;
}
