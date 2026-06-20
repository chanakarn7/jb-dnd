import { describe, it, expect, vi, beforeEach } from "vitest";

// Combat service tests (Sprint 4 QA).
// Mocks: lib/db (Prisma), lib/combat/repo.
// No DB is touched — tests verify orchestration: authz, rules, repo calls.

const dbMock = vi.hoisted(() => ({
  playerSession: { findUnique: vi.fn() },
  character: { findFirst: vi.fn() },
  monster: { findUnique: vi.fn() },
}));

const repoMock = vi.hoisted(() => ({
  getActiveEncounter: vi.fn(),
  getEncounterById: vi.fn(),
  createEncounter: vi.fn(),
  updateEncounter: vi.fn(),
  createCombatant: vi.fn(),
  getCombatant: vi.fn(),
  updateCombatant: vi.fn(),
  updateManyCombatantOrders: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: dbMock }));
vi.mock("@/lib/combat/repo", () => repoMock);

import {
  startEncounter,
  endEncounter,
  addCombatant,
  removeCombatant,
  setInitiative,
  applyDamageAction,
  applyHealingAction,
  addConditionAction,
  removeConditionAction,
  nextTurnAction,
  setTurnAction,
  requestSnapshotAction,
} from "@/lib/combat/service";
import type { Session } from "@/lib/characters/service";

// ── Fixture sessions ──────────────────────────────────────────────────────
const dm: Session = { sessionId: "dm1", campaignId: "camp1", role: "dm" };
const player: Session = { sessionId: "p1", campaignId: "camp1", role: "player" };

// ── Fixture DB rows ───────────────────────────────────────────────────────
function makeEncounterRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "enc1",
    campaignId: "camp1",
    name: "Test",
    status: "active",
    round: 1,
    currentTurnIndex: 0,
    allowPlayerHpEdit: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    combatants: [],
    ...overrides,
  };
}

function makeCombatantRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "cb1",
    encounterId: "enc1",
    campaignId: "camp1",
    type: "character",
    characterId: "char1",
    monsterSlug: null,
    name: "Aria",
    initiative: 15,
    initiativeOrder: 0,
    maxHp: 30,
    currentHp: 30,
    conditionsJson: "[]",
    removed: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  repoMock.getActiveEncounter.mockResolvedValue(null);
  repoMock.getEncounterById.mockResolvedValue(null);
  repoMock.createEncounter.mockResolvedValue(makeEncounterRow());
  repoMock.updateEncounter.mockResolvedValue(undefined);
  repoMock.createCombatant.mockResolvedValue(makeCombatantRow());
  repoMock.getCombatant.mockResolvedValue(makeCombatantRow());
  repoMock.updateCombatant.mockResolvedValue(undefined);
  repoMock.updateManyCombatantOrders.mockResolvedValue(undefined);
  dbMock.playerSession.findUnique.mockResolvedValue(null);
  dbMock.character.findFirst.mockResolvedValue(null);
  dbMock.monster.findUnique.mockResolvedValue(null);
});

// ── startEncounter ────────────────────────────────────────────────────────

describe("startEncounter", () => {
  it("DM can start encounter", async () => {
    const result = await startEncounter(dm, {});
    expect(result).not.toHaveProperty("error");
  });

  it("returns forbidden for player (edge 5.16 authz)", async () => {
    const result = await startEncounter(player, {});
    expect(result).toEqual({ error: "forbidden" });
  });

  it("returns encounter_already_active when one exists (edge 5.17)", async () => {
    repoMock.getActiveEncounter.mockResolvedValue(makeEncounterRow());
    const result = await startEncounter(dm, {});
    expect(result).toEqual({ error: "encounter_already_active" });
  });

  it("passes optional name to repo", async () => {
    await startEncounter(dm, { name: "Goblin Ambush" });
    expect(repoMock.createEncounter).toHaveBeenCalledWith("camp1", "Goblin Ambush");
  });
});

// ── endEncounter ──────────────────────────────────────────────────────────

describe("endEncounter", () => {
  it("DM can end encounter (edge 5.6)", async () => {
    repoMock.getEncounterById.mockResolvedValue(makeEncounterRow());
    const result = await endEncounter(dm, { encounterId: "enc1" });
    expect(result).not.toHaveProperty("error");
    expect(repoMock.updateEncounter).toHaveBeenCalledWith("enc1", { status: "ended" });
  });

  it("returns forbidden for player", async () => {
    const result = await endEncounter(player, { encounterId: "enc1" });
    expect(result).toEqual({ error: "forbidden" });
  });

  it("returns not_found when encounter missing", async () => {
    repoMock.getEncounterById.mockResolvedValue(null);
    const result = await endEncounter(dm, { encounterId: "bad" });
    expect(result).toEqual({ error: "not_found" });
  });
});

// ── addCombatant ──────────────────────────────────────────────────────────

describe("addCombatant — character", () => {
  beforeEach(() => {
    repoMock.getEncounterById.mockResolvedValue(makeEncounterRow());
    dbMock.character.findFirst.mockResolvedValue({
      id: "char1", name: "Aria", maxHp: 30, currentHp: 30, campaignId: "camp1",
    });
  });

  it("adds character combatant", async () => {
    const result = await addCombatant(dm, "enc1", { type: "character", characterId: "char1" });
    expect(result).not.toHaveProperty("error");
    expect(repoMock.createCombatant).toHaveBeenCalled();
  });

  it("returns forbidden for player", async () => {
    const result = await addCombatant(player, "enc1", { type: "character", characterId: "char1" });
    expect(result).toEqual({ error: "forbidden" });
  });

  it("returns character_not_found when character missing (edge 5.14)", async () => {
    dbMock.character.findFirst.mockResolvedValue(null);
    const result = await addCombatant(dm, "enc1", { type: "character", characterId: "bad" });
    expect(result).toEqual({ error: "character_not_found" });
  });

  it("returns duplicate_combatant on P2002 (edge 5.1)", async () => {
    repoMock.createCombatant.mockRejectedValue({ code: "P2002" });
    const result = await addCombatant(dm, "enc1", { type: "character", characterId: "char1" });
    expect(result).toEqual({ error: "duplicate_combatant" });
  });

  it("returns invalid_initiative for initiative < 1 (edge 5.11)", async () => {
    const result = await addCombatant(dm, "enc1", {
      type: "character", characterId: "char1", initiative: 0,
    });
    expect(result).toEqual({ error: "invalid_initiative" });
  });

  it("returns invalid_initiative for initiative > 30 (edge 5.11)", async () => {
    const result = await addCombatant(dm, "enc1", {
      type: "character", characterId: "char1", initiative: 31,
    });
    expect(result).toEqual({ error: "invalid_initiative" });
  });
});

describe("addCombatant — monster", () => {
  beforeEach(() => {
    repoMock.getEncounterById.mockResolvedValue(makeEncounterRow());
    dbMock.monster.findUnique.mockResolvedValue({ slug: "goblin", name: "Goblin", hp: 7 });
  });

  it("adds monster combatant", async () => {
    const result = await addCombatant(dm, "enc1", { type: "monster", monsterSlug: "goblin" });
    expect(result).not.toHaveProperty("error");
  });

  it("returns monster_not_found for unknown slug (edge 5.13)", async () => {
    dbMock.monster.findUnique.mockResolvedValue(null);
    const result = await addCombatant(dm, "enc1", { type: "monster", monsterSlug: "fake-slug" });
    expect(result).toEqual({ error: "monster_not_found" });
  });
});

// ── removeCombatant ───────────────────────────────────────────────────────

describe("removeCombatant", () => {
  it("DM can remove combatant", async () => {
    repoMock.getCombatant.mockResolvedValue(makeCombatantRow());
    repoMock.getEncounterById.mockResolvedValue(makeEncounterRow({ combatants: [makeCombatantRow()] }));
    const result = await removeCombatant(dm, { combatantId: "cb1" });
    expect(result).not.toHaveProperty("error");
    expect(repoMock.updateCombatant).toHaveBeenCalledWith("cb1", { removed: true });
  });

  it("returns forbidden for player", async () => {
    const result = await removeCombatant(player, { combatantId: "cb1" });
    expect(result).toEqual({ error: "forbidden" });
  });

  it("returns not_found when combatant missing", async () => {
    repoMock.getCombatant.mockResolvedValue(null);
    const result = await removeCombatant(dm, { combatantId: "bad" });
    expect(result).toEqual({ error: "not_found" });
  });
});

// ── setInitiative ─────────────────────────────────────────────────────────

describe("setInitiative", () => {
  it("DM can set valid initiative", async () => {
    const result = await setInitiative(dm, { combatantId: "cb1", initiative: 18 });
    expect(result).not.toHaveProperty("error");
  });

  it("returns forbidden for player", async () => {
    const result = await setInitiative(player, { combatantId: "cb1", initiative: 18 });
    expect(result).toEqual({ error: "forbidden" });
  });

  it("returns invalid_initiative for 0 (edge 5.11)", async () => {
    const result = await setInitiative(dm, { combatantId: "cb1", initiative: 0 });
    expect(result).toEqual({ error: "invalid_initiative" });
  });

  it("returns invalid_initiative for 31 (edge 5.11)", async () => {
    const result = await setInitiative(dm, { combatantId: "cb1", initiative: 31 });
    expect(result).toEqual({ error: "invalid_initiative" });
  });

  it("returns not_found when combatant missing", async () => {
    repoMock.getCombatant.mockResolvedValue(null);
    const result = await setInitiative(dm, { combatantId: "bad", initiative: 10 });
    expect(result).toEqual({ error: "not_found" });
  });
});

// ── applyDamageAction ─────────────────────────────────────────────────────

describe("applyDamageAction", () => {
  beforeEach(() => {
    repoMock.getCombatant.mockResolvedValue(makeCombatantRow({ currentHp: 20, maxHp: 30 }));
    repoMock.getEncounterById.mockResolvedValue(makeEncounterRow({ allowPlayerHpEdit: false }));
  });

  it("DM can apply damage", async () => {
    const result = await applyDamageAction(dm, { combatantId: "cb1", amount: 5 });
    expect(result).not.toHaveProperty("error");
    expect((result as { hpChanged: { currentHp: number } }).hpChanged.currentHp).toBe(15);
  });

  it("returns invalid_hp_delta for amount=0 (edge 5.4)", async () => {
    const result = await applyDamageAction(dm, { combatantId: "cb1", amount: 0 });
    expect(result).toEqual({ error: "invalid_hp_delta" });
  });

  it("returns invalid_hp_delta for negative amount (edge 5.4)", async () => {
    const result = await applyDamageAction(dm, { combatantId: "cb1", amount: -5 });
    expect(result).toEqual({ error: "invalid_hp_delta" });
  });

  it("clamps HP to 0 (edge 5.2)", async () => {
    repoMock.getCombatant.mockResolvedValue(makeCombatantRow({ currentHp: 5, maxHp: 30 }));
    const result = await applyDamageAction(dm, { combatantId: "cb1", amount: 999 });
    expect((result as { hpChanged: { currentHp: number } }).hpChanged.currentHp).toBe(0);
  });

  it("auto-applies Unconscious when HP hits 0 (edge 5.2)", async () => {
    repoMock.getCombatant.mockResolvedValue(
      makeCombatantRow({ currentHp: 5, maxHp: 30, conditionsJson: "[]" }),
    );
    const result = await applyDamageAction(dm, { combatantId: "cb1", amount: 5 });
    const typed = result as { hpChanged: unknown; conditionsChanged?: { conditions: Array<{ name: string }> } };
    expect(typed.conditionsChanged?.conditions.some((c) => c.name === "Unconscious")).toBe(true);
  });

  it("does NOT re-apply Unconscious if already present (edge 5.2)", async () => {
    repoMock.getCombatant.mockResolvedValue(
      makeCombatantRow({ currentHp: 5, conditionsJson: '[{"name":"Unconscious"}]' }),
    );
    const result = await applyDamageAction(dm, { combatantId: "cb1", amount: 5 });
    const typed = result as { hpChanged: unknown; conditionsChanged?: unknown };
    expect(typed.conditionsChanged).toBeUndefined();
  });

  it("player forbidden when allowPlayerHpEdit=false (edge 5.18)", async () => {
    repoMock.getEncounterById.mockResolvedValue(makeEncounterRow({ allowPlayerHpEdit: false }));
    const result = await applyDamageAction(player, { combatantId: "cb1", amount: 5 });
    expect(result).toEqual({ error: "forbidden" });
  });

  it("player forbidden when editing another's character (edge 5.7)", async () => {
    repoMock.getCombatant.mockResolvedValue(makeCombatantRow({ characterId: "char-other" }));
    repoMock.getEncounterById.mockResolvedValue(makeEncounterRow({ allowPlayerHpEdit: true }));
    dbMock.playerSession.findUnique.mockResolvedValue({ characterId: "char1" });
    const result = await applyDamageAction(player, { combatantId: "cb1", amount: 5 });
    expect(result).toEqual({ error: "forbidden" });
  });

  it("player allowed on own character when flag=true", async () => {
    repoMock.getCombatant.mockResolvedValue(makeCombatantRow({ characterId: "char1" }));
    repoMock.getEncounterById.mockResolvedValue(makeEncounterRow({ allowPlayerHpEdit: true }));
    dbMock.playerSession.findUnique.mockResolvedValue({ characterId: "char1" });
    const result = await applyDamageAction(player, { combatantId: "cb1", amount: 3 });
    expect(result).not.toHaveProperty("error");
  });
});

// ── applyHealingAction ────────────────────────────────────────────────────

describe("applyHealingAction", () => {
  beforeEach(() => {
    repoMock.getCombatant.mockResolvedValue(makeCombatantRow({ currentHp: 10, maxHp: 30 }));
    repoMock.getEncounterById.mockResolvedValue(makeEncounterRow());
  });

  it("DM can apply healing", async () => {
    const result = await applyHealingAction(dm, { combatantId: "cb1", amount: 5 });
    expect(result).not.toHaveProperty("error");
    expect((result as { hpChanged: { currentHp: number } }).hpChanged.currentHp).toBe(15);
  });

  it("clamps healing at maxHp (edge 5.3)", async () => {
    const result = await applyHealingAction(dm, { combatantId: "cb1", amount: 999 });
    expect((result as { hpChanged: { currentHp: number } }).hpChanged.currentHp).toBe(30);
  });

  it("returns invalid_hp_delta for amount=0 (edge 5.4)", async () => {
    const result = await applyHealingAction(dm, { combatantId: "cb1", amount: 0 });
    expect(result).toEqual({ error: "invalid_hp_delta" });
  });
});

// ── addConditionAction ────────────────────────────────────────────────────

describe("addConditionAction", () => {
  it("DM can add condition", async () => {
    const result = await addConditionAction(dm, { combatantId: "cb1", condition: "Poisoned" });
    expect(result).not.toHaveProperty("error");
  });

  it("returns forbidden for player (player cannot add conditions)", async () => {
    const result = await addConditionAction(player, { combatantId: "cb1", condition: "Poisoned" });
    expect(result).toEqual({ error: "forbidden" });
  });

  it("returns not_found for unknown combatant", async () => {
    repoMock.getCombatant.mockResolvedValue(null);
    const result = await addConditionAction(dm, { combatantId: "bad", condition: "Poisoned" });
    expect(result).toEqual({ error: "not_found" });
  });
});

// ── removeConditionAction ─────────────────────────────────────────────────

describe("removeConditionAction", () => {
  it("DM can remove condition", async () => {
    repoMock.getCombatant.mockResolvedValue(
      makeCombatantRow({ conditionsJson: '[{"name":"Poisoned"}]' }),
    );
    const result = await removeConditionAction(dm, { combatantId: "cb1", condition: "Poisoned" });
    expect(result).not.toHaveProperty("error");
  });

  it("returns forbidden for player", async () => {
    const result = await removeConditionAction(player, { combatantId: "cb1", condition: "Poisoned" });
    expect(result).toEqual({ error: "forbidden" });
  });
});

// ── nextTurnAction ────────────────────────────────────────────────────────

describe("nextTurnAction", () => {
  it("advances turn index", async () => {
    repoMock.getEncounterById.mockResolvedValue(
      makeEncounterRow({
        currentTurnIndex: 0,
        round: 1,
        combatants: [
          makeCombatantRow({ id: "c1", initiative: 18 }),
          makeCombatantRow({ id: "c2", initiative: 10, initiativeOrder: 1 }),
        ],
      }),
    );
    const result = await nextTurnAction(dm, { encounterId: "enc1" });
    expect(result).not.toHaveProperty("error");
    expect((result as { currentTurnIndex: number }).currentTurnIndex).toBe(1);
  });

  it("increments round when wrapping (last → first)", async () => {
    repoMock.getEncounterById.mockResolvedValue(
      makeEncounterRow({
        currentTurnIndex: 1,
        round: 2,
        combatants: [
          makeCombatantRow({ id: "c1", initiative: 18 }),
          makeCombatantRow({ id: "c2", initiative: 10 }),
        ],
      }),
    );
    const result = await nextTurnAction(dm, { encounterId: "enc1" });
    const typed = result as { round: number; currentTurnIndex: number };
    expect(typed.currentTurnIndex).toBe(0);
    expect(typed.round).toBe(3);
  });

  it("returns no_active_combatants when all removed/waiting (edge 5.19)", async () => {
    repoMock.getEncounterById.mockResolvedValue(
      makeEncounterRow({
        combatants: [makeCombatantRow({ initiative: null })],
      }),
    );
    const result = await nextTurnAction(dm, { encounterId: "enc1" });
    expect(result).toEqual({ error: "no_active_combatants" });
  });

  it("returns forbidden for player", async () => {
    const result = await nextTurnAction(player, { encounterId: "enc1" });
    expect(result).toEqual({ error: "forbidden" });
  });

  it("skips waiting (null initiative) combatants in turn cycle (edge 5.20)", async () => {
    repoMock.getEncounterById.mockResolvedValue(
      makeEncounterRow({
        currentTurnIndex: 0,
        combatants: [
          makeCombatantRow({ id: "active", initiative: 10 }),
          makeCombatantRow({ id: "waiting", initiative: null }),
        ],
      }),
    );
    const result = await nextTurnAction(dm, { encounterId: "enc1" });
    // only 1 active combatant → wraps back to index 0
    expect((result as { currentTurnIndex: number }).currentTurnIndex).toBe(0);
  });
});

// ── setTurnAction ─────────────────────────────────────────────────────────

describe("setTurnAction", () => {
  it("DM can jump to a specific combatant", async () => {
    repoMock.getEncounterById.mockResolvedValue(
      makeEncounterRow({
        combatants: [
          makeCombatantRow({ id: "c1", initiative: 18 }),
          makeCombatantRow({ id: "c2", initiative: 10 }),
        ],
      }),
    );
    const result = await setTurnAction(dm, { encounterId: "enc1", combatantId: "c2" });
    expect((result as { currentTurnIndex: number }).currentTurnIndex).toBe(1);
  });

  it("returns forbidden for player", async () => {
    const result = await setTurnAction(player, { encounterId: "enc1", combatantId: "c1" });
    expect(result).toEqual({ error: "forbidden" });
  });
});

// ── requestSnapshotAction ─────────────────────────────────────────────────

describe("requestSnapshotAction", () => {
  it("returns encounter: null when no active encounter (edge 5.8)", async () => {
    repoMock.getActiveEncounter.mockResolvedValue(null);
    const result = await requestSnapshotAction(dm, {});
    expect(result).toEqual({ encounter: null });
  });

  it("returns active encounter snapshot", async () => {
    repoMock.getActiveEncounter.mockResolvedValue(makeEncounterRow({ combatants: [] }));
    const result = await requestSnapshotAction(dm, {});
    expect(result).not.toHaveProperty("error");
    expect((result as { encounter: { id: string } }).encounter.id).toBe("enc1");
  });

  it("looks up by encounterId when provided", async () => {
    repoMock.getEncounterById.mockResolvedValue(makeEncounterRow({ combatants: [] }));
    const result = await requestSnapshotAction(dm, { encounterId: "enc1" });
    expect(repoMock.getEncounterById).toHaveBeenCalledWith("camp1", "enc1");
    expect(result).not.toHaveProperty("error");
  });
});
