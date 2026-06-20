import { describe, it, expect } from "vitest";
import {
  validateInitiative,
  validateHpDelta,
  applyDamage,
  applyHealing,
  parseConditions,
  applyCondition,
  removeCondition,
  shouldAutoUnconsciousOnKO,
  sortCombatants,
  advanceTurn,
  buildSnapshot,
} from "@/lib/combat/rules";
import type { CombatantView } from "@/lib/combat/types";

// ── Helpers ───────────────────────────────────────────────────────────────

function makeCombatant(overrides: Partial<CombatantView> = {}): CombatantView {
  return {
    id: "c1",
    type: "character",
    characterId: "char1",
    monsterSlug: null,
    name: "Test",
    initiative: 10,
    initiativeOrder: 0,
    maxHp: 20,
    currentHp: 20,
    conditions: [],
    removed: false,
    ...overrides,
  };
}

function makeEncounter(overrides: Record<string, unknown> = {}) {
  return {
    id: "enc1",
    campaignId: "camp1",
    name: "Test Encounter",
    status: "active",
    round: 1,
    currentTurnIndex: 0,
    allowPlayerHpEdit: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as import("@prisma/client").Encounter;
}

function makeDbCombatant(overrides: Record<string, unknown> = {}) {
  return {
    id: "c1",
    encounterId: "enc1",
    campaignId: "camp1",
    type: "character",
    characterId: "char1",
    monsterSlug: null,
    name: "Test",
    initiative: 10,
    initiativeOrder: 0,
    maxHp: 20,
    currentHp: 20,
    conditionsJson: "[]",
    removed: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as import("@prisma/client").Combatant;
}

// ── validateInitiative ────────────────────────────────────────────────────

describe("validateInitiative", () => {
  it("accepts 1 (lower bound)", () => expect(validateInitiative(1)).toBe(true));
  it("accepts 30 (upper bound)", () => expect(validateInitiative(30)).toBe(true));
  it("accepts 15 (mid range)", () => expect(validateInitiative(15)).toBe(true));
  it("rejects 0 — below range (edge 5.11)", () => expect(validateInitiative(0)).toBe(false));
  it("rejects 31 — above range (edge 5.11)", () => expect(validateInitiative(31)).toBe(false));
  it("rejects -1", () => expect(validateInitiative(-1)).toBe(false));
  it("rejects float 10.5", () => expect(validateInitiative(10.5)).toBe(false));
  it("rejects string '10'", () => expect(validateInitiative("10")).toBe(false));
  it("rejects null", () => expect(validateInitiative(null)).toBe(false));
  it("rejects undefined", () => expect(validateInitiative(undefined)).toBe(false));
});

// ── validateHpDelta ───────────────────────────────────────────────────────

describe("validateHpDelta", () => {
  it("accepts 1", () => expect(validateHpDelta(1)).toBe(true));
  it("accepts 999 (large value)", () => expect(validateHpDelta(999)).toBe(true));
  it("rejects 0 — not positive (edge 5.4)", () => expect(validateHpDelta(0)).toBe(false));
  it("rejects -5 — negative (edge 5.4)", () => expect(validateHpDelta(-5)).toBe(false));
  it("rejects float 2.5", () => expect(validateHpDelta(2.5)).toBe(false));
  it("rejects string '5'", () => expect(validateHpDelta("5")).toBe(false));
  it("rejects null", () => expect(validateHpDelta(null)).toBe(false));
});

// ── applyDamage ───────────────────────────────────────────────────────────

describe("applyDamage", () => {
  it("subtracts damage normally", () => expect(applyDamage(20, 5)).toBe(15));
  it("returns 0 when damage equals HP", () => expect(applyDamage(10, 10)).toBe(0));
  it("clamps at 0 when damage exceeds HP (edge 5.2)", () => expect(applyDamage(5, 100)).toBe(0));
  it("HP already 0 stays 0", () => expect(applyDamage(0, 10)).toBe(0));
  it("subtracts 1 damage correctly", () => expect(applyDamage(1, 1)).toBe(0));
});

// ── applyHealing ──────────────────────────────────────────────────────────

describe("applyHealing", () => {
  it("adds healing normally", () => expect(applyHealing(10, 5, 20)).toBe(15));
  it("clamps at maxHp (edge 5.3)", () => expect(applyHealing(18, 10, 20)).toBe(20));
  it("exact fill to maxHp", () => expect(applyHealing(15, 5, 20)).toBe(20));
  it("heals from 0 HP", () => expect(applyHealing(0, 5, 20)).toBe(5));
  it("over-healing clamps", () => expect(applyHealing(0, 999, 20)).toBe(20));
});

// ── parseConditions ───────────────────────────────────────────────────────

describe("parseConditions", () => {
  it("parses empty array", () => expect(parseConditions("[]")).toEqual([]));
  it("parses single condition", () =>
    expect(parseConditions('[{"name":"Poisoned"}]')).toEqual([{ name: "Poisoned" }]));
  it("parses Exhaustion with level", () =>
    expect(parseConditions('[{"name":"Exhaustion","level":3}]')).toEqual([
      { name: "Exhaustion", level: 3 },
    ]));
  it("returns [] on invalid JSON (corrupted data fallback)", () =>
    expect(parseConditions("INVALID")).toEqual([]));
  it("returns [] on null JSON string", () => expect(parseConditions("null")).toEqual([]));
});

// ── applyCondition ────────────────────────────────────────────────────────

describe("applyCondition", () => {
  it("adds a new non-Exhaustion condition", () => {
    const result = applyCondition([], "Poisoned");
    expect(result).toEqual([{ name: "Poisoned" }]);
  });

  it("is idempotent for non-Exhaustion — no duplicate (edge 5.10)", () => {
    const existing = [{ name: "Poisoned" as const }];
    const result = applyCondition(existing, "Poisoned");
    expect(result).toHaveLength(1);
    expect(result).toEqual(existing);
  });

  it("adds Exhaustion at level 1 when not present", () => {
    const result = applyCondition([], "Exhaustion");
    expect(result).toEqual([{ name: "Exhaustion", level: 1 }]);
  });

  it("increments Exhaustion level when already present", () => {
    const existing = [{ name: "Exhaustion" as const, level: 2 as const }];
    const result = applyCondition(existing, "Exhaustion");
    expect(result).toEqual([{ name: "Exhaustion", level: 3 }]);
  });

  it("clamps Exhaustion at level 6 (edge 5.9)", () => {
    const existing = [{ name: "Exhaustion" as const, level: 6 as const }];
    const result = applyCondition(existing, "Exhaustion");
    expect(result).toEqual([{ name: "Exhaustion", level: 6 }]);
  });

  it("preserves other conditions when adding new one", () => {
    const existing = [{ name: "Blinded" as const }];
    const result = applyCondition(existing, "Poisoned");
    expect(result).toHaveLength(2);
  });
});

// ── removeCondition ───────────────────────────────────────────────────────

describe("removeCondition", () => {
  it("removes a non-Exhaustion condition", () => {
    const conditions = [{ name: "Poisoned" as const }];
    expect(removeCondition(conditions, "Poisoned")).toEqual([]);
  });

  it("is no-op when condition not present", () => {
    const conditions = [{ name: "Blinded" as const }];
    const result = removeCondition(conditions, "Poisoned");
    expect(result).toEqual(conditions);
  });

  it("decrements Exhaustion from 3 to 2", () => {
    const conditions = [{ name: "Exhaustion" as const, level: 3 as const }];
    const result = removeCondition(conditions, "Exhaustion");
    expect(result).toEqual([{ name: "Exhaustion", level: 2 }]);
  });

  it("removes Exhaustion entirely when level is 1", () => {
    const conditions = [{ name: "Exhaustion" as const, level: 1 as const }];
    const result = removeCondition(conditions, "Exhaustion");
    expect(result).toEqual([]);
  });

  it("no-op when removing Exhaustion that doesn't exist", () => {
    expect(removeCondition([], "Exhaustion")).toEqual([]);
  });

  it("preserves other conditions when removing one", () => {
    const conditions = [{ name: "Poisoned" as const }, { name: "Blinded" as const }];
    const result = removeCondition(conditions, "Poisoned");
    expect(result).toEqual([{ name: "Blinded" }]);
  });
});

// ── shouldAutoUnconsciousOnKO ─────────────────────────────────────────────

describe("shouldAutoUnconsciousOnKO", () => {
  it("true when HP=0 and no Unconscious (edge 5.2)", () =>
    expect(shouldAutoUnconsciousOnKO([], 0)).toBe(true));

  it("false when HP=0 but Unconscious already present", () => {
    const conditions = [{ name: "Unconscious" as const }];
    expect(shouldAutoUnconsciousOnKO(conditions, 0)).toBe(false);
  });

  it("false when HP > 0", () =>
    expect(shouldAutoUnconsciousOnKO([], 5)).toBe(false));

  it("false when HP > 0 even with conditions present", () => {
    const conditions = [{ name: "Poisoned" as const }];
    expect(shouldAutoUnconsciousOnKO(conditions, 1)).toBe(false);
  });
});

// ── sortCombatants ────────────────────────────────────────────────────────

describe("sortCombatants", () => {
  it("sorts descending by initiative", () => {
    const combatants = [
      makeCombatant({ id: "c1", initiative: 10 }),
      makeCombatant({ id: "c2", initiative: 18 }),
      makeCombatant({ id: "c3", initiative: 5 }),
    ];
    const sorted = sortCombatants(combatants);
    expect(sorted.map((c) => c.id)).toEqual(["c2", "c1", "c3"]);
  });

  it("uses initiativeOrder as tie-breaker (ascending)", () => {
    const combatants = [
      makeCombatant({ id: "c1", initiative: 14, initiativeOrder: 1 }),
      makeCombatant({ id: "c2", initiative: 14, initiativeOrder: 0 }),
    ];
    const sorted = sortCombatants(combatants);
    expect(sorted.map((c) => c.id)).toEqual(["c2", "c1"]);
  });

  it("excludes removed combatants (edge 5.20)", () => {
    const combatants = [
      makeCombatant({ id: "c1", initiative: 10 }),
      makeCombatant({ id: "c2", initiative: 15, removed: true }),
    ];
    const sorted = sortCombatants(combatants);
    expect(sorted.map((c) => c.id)).toEqual(["c1"]);
  });

  it("excludes combatants with null initiative (edge 5.20 — Waiting section)", () => {
    const combatants = [
      makeCombatant({ id: "c1", initiative: 10 }),
      makeCombatant({ id: "c2", initiative: null }),
    ];
    const sorted = sortCombatants(combatants);
    expect(sorted.map((c) => c.id)).toEqual(["c1"]);
  });

  it("returns empty array when all removed or waiting", () => {
    const combatants = [
      makeCombatant({ removed: true }),
      makeCombatant({ initiative: null }),
    ];
    expect(sortCombatants(combatants)).toHaveLength(0);
  });
});

// ── advanceTurn ───────────────────────────────────────────────────────────

describe("advanceTurn", () => {
  it("advances from index 0 to 1 in 3-combatant list", () => {
    expect(advanceTurn(0, 3)).toEqual({ nextIndex: 1, roundIncrement: false });
  });

  it("advances from index 1 to 2", () => {
    expect(advanceTurn(1, 3)).toEqual({ nextIndex: 2, roundIncrement: false });
  });

  it("wraps from last to 0 and increments round", () => {
    expect(advanceTurn(2, 3)).toEqual({ nextIndex: 0, roundIncrement: true });
  });

  it("handles single-combatant list (index 0 → 0, roundIncrement)", () => {
    expect(advanceTurn(0, 1)).toEqual({ nextIndex: 0, roundIncrement: true });
  });

  it("returns 0 for count=0 (edge 5.19 guard)", () => {
    expect(advanceTurn(0, 0)).toEqual({ nextIndex: 0, roundIncrement: false });
  });
});

// ── buildSnapshot ─────────────────────────────────────────────────────────

describe("buildSnapshot", () => {
  it("maps encounter fields correctly", () => {
    const enc = makeEncounter({ round: 3, currentTurnIndex: 1, allowPlayerHpEdit: true });
    const snap = buildSnapshot(enc, []);
    expect(snap.round).toBe(3);
    expect(snap.currentTurnIndex).toBe(1);
    expect(snap.allowPlayerHpEdit).toBe(true);
    expect(snap.status).toBe("active");
  });

  it("orders: active (sorted desc initiative) → waiting (null initiative) → removed", () => {
    const combatants = [
      makeDbCombatant({ id: "removed", removed: true, initiative: 20 }),
      makeDbCombatant({ id: "waiting", initiative: null, removed: false }),
      makeDbCombatant({ id: "active-low", initiative: 5, removed: false }),
      makeDbCombatant({ id: "active-high", initiative: 18, removed: false }),
    ];
    const snap = buildSnapshot(makeEncounter(), combatants);
    const ids = snap.combatants.map((c) => c.id);
    expect(ids).toEqual(["active-high", "active-low", "waiting", "removed"]);
  });

  it("parses conditionsJson into conditions array", () => {
    const c = makeDbCombatant({ conditionsJson: '[{"name":"Poisoned"}]' });
    const snap = buildSnapshot(makeEncounter(), [c]);
    expect(snap.combatants[0].conditions).toEqual([{ name: "Poisoned" }]);
  });

  it("handles empty combatant list", () => {
    const snap = buildSnapshot(makeEncounter(), []);
    expect(snap.combatants).toHaveLength(0);
  });
});
