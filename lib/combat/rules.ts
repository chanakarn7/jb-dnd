// File: lib/combat/rules.ts
// Pure deterministic rules for the Combat module — no DB, no socket, no side effects.
// All 5e combat constraints live here and are testable without mocks.
// Source: docs/modules/combat/SA_BLUEPRINT.md §5.1 + PRD §3.3–3.6

import type { Combatant, Encounter } from "@prisma/client";
import type { Condition, ConditionEntry, CombatantView, EncounterSnapshot } from "./types";

// ── Validation ──────────────────────────────────────────────────────────

/** Initiative must be a whole integer in [1, 30] (5e practical range). PRD §3.3 */
export function validateInitiative(v: unknown): v is number {
  return Number.isInteger(v) && (v as number) >= 1 && (v as number) <= 30;
}

/** HP delta must be a positive integer (>0). PRD §3.4 edge 5.4 */
export function validateHpDelta(v: unknown): v is number {
  return Number.isInteger(v) && (v as number) > 0;
}

// ── HP math ──────────────────────────────────────────────────────────────

/** Clamps at 0 — can never go negative. PRD §3.4 edge 5.2 */
export function applyDamage(currentHp: number, amount: number): number {
  return Math.max(0, currentHp - amount);
}

/** Clamps at maxHp — healing silently capped. PRD §3.4 edge 5.3 */
export function applyHealing(currentHp: number, amount: number, maxHp: number): number {
  return Math.min(maxHp, currentHp + amount);
}

// ── Conditions ────────────────────────────────────────────────────────────

export function parseConditions(json: string): ConditionEntry[] {
  try {
    return (JSON.parse(json) ?? []) as ConditionEntry[];
  } catch {
    return [];
  }
}

/**
 * Adds a condition. For Exhaustion: increments level (clamped at 6). PRD §3.5 edge 5.9.
 * For non-Exhaustion: idempotent — no duplicate entry. PRD §3.5 edge 5.10.
 */
export function applyCondition(conditions: ConditionEntry[], condition: Condition): ConditionEntry[] {
  if (condition === "Exhaustion") {
    const existing = conditions.find((c) => c.name === "Exhaustion") as
      | { name: "Exhaustion"; level: number }
      | undefined;
    if (existing) {
      return conditions.map((c) =>
        c.name === "Exhaustion"
          ? { name: "Exhaustion", level: Math.min(6, existing.level + 1) as 1 | 2 | 3 | 4 | 5 | 6 }
          : c,
      );
    }
    return [...conditions, { name: "Exhaustion", level: 1 as const }];
  }
  if (conditions.some((c) => c.name === condition)) return conditions;
  return [...conditions, { name: condition } as ConditionEntry];
}

/**
 * Removes a condition. For Exhaustion: decrements level; removes at 0.
 * For non-Exhaustion: removes entirely (no-op if not present).
 */
export function removeCondition(conditions: ConditionEntry[], condition: Condition): ConditionEntry[] {
  if (condition === "Exhaustion") {
    const existing = conditions.find((c) => c.name === "Exhaustion") as
      | { name: "Exhaustion"; level: number }
      | undefined;
    if (!existing) return conditions;
    if (existing.level <= 1) return conditions.filter((c) => c.name !== "Exhaustion");
    return conditions.map((c) =>
      c.name === "Exhaustion"
        ? { name: "Exhaustion", level: (existing.level - 1) as 1 | 2 | 3 | 4 | 5 | 6 }
        : c,
    );
  }
  return conditions.filter((c) => c.name !== condition);
}

/**
 * Returns true when HP just hit 0 AND Unconscious is not already present.
 * Used to auto-apply Unconscious after damage. PRD §3.4 + edge 5.2.
 */
export function shouldAutoUnconsciousOnKO(conditions: ConditionEntry[], newHp: number): boolean {
  return newHp === 0 && !conditions.some((c) => c.name === "Unconscious");
}

// ── Sort & turn management ────────────────────────────────────────────────

/**
 * Returns the active combatant list: non-removed, initiative set, sorted desc initiative
 * then asc initiativeOrder (tie-breaker). PRD §3.6 edge 5.20.
 */
export function sortCombatants(combatants: CombatantView[]): CombatantView[] {
  return combatants
    .filter((c) => !c.removed && c.initiative !== null)
    .sort((a, b) => {
      if (b.initiative! !== a.initiative!) return b.initiative! - a.initiative!;
      return a.initiativeOrder - b.initiativeOrder;
    });
}

/**
 * Computes the next turn index and whether the round increments.
 * PRD §3.6 — wraps from last to first → round++.
 */
export function advanceTurn(
  currentIndex: number,
  count: number,
): { nextIndex: number; roundIncrement: boolean } {
  if (count === 0) return { nextIndex: 0, roundIncrement: false };
  const nextIndex = (currentIndex + 1) % count;
  return { nextIndex, roundIncrement: nextIndex === 0 };
}

// ── Snapshot assembly ─────────────────────────────────────────────────────

/**
 * Builds the broadcast-safe EncounterSnapshot from DB rows.
 * Order: active (non-removed, initiative set, sorted) → waiting (non-removed, no initiative) → removed.
 */
export function buildSnapshot(encounter: Encounter, combatants: Combatant[]): EncounterSnapshot {
  const views: CombatantView[] = combatants.map((c) => ({
    id: c.id,
    type: c.type as "character" | "monster",
    characterId: c.characterId,
    monsterSlug: c.monsterSlug,
    name: c.name,
    initiative: c.initiative,
    initiativeOrder: c.initiativeOrder,
    maxHp: c.maxHp,
    currentHp: c.currentHp,
    conditions: parseConditions(c.conditionsJson),
    removed: c.removed,
  }));

  const active = sortCombatants(views);
  const waiting = views.filter((c) => !c.removed && c.initiative === null);
  const removed = views.filter((c) => c.removed);

  return {
    id: encounter.id,
    campaignId: encounter.campaignId,
    name: encounter.name,
    status: encounter.status as "active" | "ended",
    round: encounter.round,
    currentTurnIndex: encounter.currentTurnIndex,
    allowPlayerHpEdit: encounter.allowPlayerHpEdit,
    combatants: [...active, ...waiting, ...removed],
  };
}
