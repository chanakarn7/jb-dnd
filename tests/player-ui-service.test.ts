// File: tests/player-ui-service.test.ts
// Sprint 6 Player UI service tests (Stage 8 QA gap-close).
// Mocks: lib/db (prisma) + lib/player-ui/repo — no DB, no RNG dependency for assertions.
// Covers: dice authz + private gating + client-face trust boundary, search bounds,
// dashboard DM-gate, quick-view/HP/spell-slot ownership authz + validation.

import { describe, it, expect, vi, beforeEach } from "vitest";

const prismaMock = vi.hoisted(() => ({
  prisma: {
    playerSession: { findUnique: vi.fn() },
    character: { findFirst: vi.fn() },
  },
}));
const repoMock = vi.hoisted(() => ({
  saveDiceRoll: vi.fn(),
  getRecentRolls: vi.fn(),
  searchAll: vi.fn(),
  getDashboardData: vi.fn(),
  getQuickViewData: vi.fn(),
  updateCharacterHp: vi.fn(),
  updateSpellSlotsUsed: vi.fn(),
}));

vi.mock("@/lib/db", () => prismaMock);
vi.mock("@/lib/player-ui/repo", () => repoMock);

import {
  rollDiceAction,
  searchAction,
  getDashboardAction,
  getQuickViewAction,
  updateHpAction,
  updateSpellSlotsAction,
} from "@/lib/player-ui/service";
import type { Session } from "@/lib/characters/service";

const dm: Session = { sessionId: "dm1", campaignId: "camp1", role: "dm" };
const owner: Session = { sessionId: "p1", campaignId: "camp1", role: "player" };
const intruder: Session = { sessionId: "p2", campaignId: "camp1", role: "player" };

const ownedChar = { campaignId: "camp1", ownerSessionId: "p1" };

beforeEach(() => {
  vi.clearAllMocks();
  repoMock.saveDiceRoll.mockImplementation((d: Record<string, unknown>) =>
    Promise.resolve({ id: "roll1", createdAt: new Date().toISOString(), playerName: "P", ...d }),
  );
});

// ── Dice ───────────────────────────────────────────────────────────────────────
describe("rollDiceAction", () => {
  it("rejects an invalid formula", async () => {
    const r = await rollDiceAction(owner, { formula: "abc" });
    expect(r).toEqual({ error: "invalid_formula" });
  });

  it("forbids a private roll for a non-DM (DM-only secret rolls)", async () => {
    const r = await rollDiceAction(owner, { formula: "d20", isPrivate: true });
    expect(r).toEqual({ error: "forbidden" });
  });

  it("trusts valid client faces and recomputes the total server-side", async () => {
    const r = await rollDiceAction(owner, { formula: "2d6+3", clientRolls: [4, 5] });
    expect("view" in r && r.persisted).toBe(true);
    expect(repoMock.saveDiceRoll).toHaveBeenCalledWith(
      expect.objectContaining({ result: 12, rolls: [4, 5] }),
    );
  });

  it("rejects forged client faces (anti-tamper → invalid_rolls)", async () => {
    const r = await rollDiceAction(owner, { formula: "1d6", clientRolls: [99] });
    expect(r).toEqual({ error: "invalid_rolls" });
    expect(repoMock.saveDiceRoll).not.toHaveBeenCalled();
  });

  it("server-rolls a normal formula when no client faces (RNG path), persists in range", async () => {
    const r = await rollDiceAction(owner, { formula: "2d6" });
    expect("view" in r && r.persisted).toBe(true);
    const arg = repoMock.saveDiceRoll.mock.calls[0][0];
    expect(arg.rolls).toHaveLength(2);
    for (const face of arg.rolls) {
      expect(face).toBeGreaterThanOrEqual(1);
      expect(face).toBeLessThanOrEqual(6);
    }
    expect(arg.result).toBe(arg.rolls[0] + arg.rolls[1]);
  });

  it("advantage RNG keeps two d20 faces", async () => {
    await rollDiceAction(owner, { formula: "d20", mode: "advantage" });
    const arg = repoMock.saveDiceRoll.mock.calls[0][0];
    expect(arg.rolls).toHaveLength(2);
    expect(arg.keptRoll).toBe(Math.max(arg.rolls[0], arg.rolls[1]));
  });

  it("private DM roll is NOT persisted and carries no id", async () => {
    prismaMock.prisma.playerSession.findUnique.mockResolvedValue({ displayName: "The DM" });
    const r = await rollDiceAction(dm, { formula: "d20", isPrivate: true });
    expect("persisted" in r && r.persisted).toBe(false);
    expect(repoMock.saveDiceRoll).not.toHaveBeenCalled();
    if ("view" in r) expect(r.view).not.toHaveProperty("id");
  });

  it("truncates an over-long context to 80 chars", async () => {
    await rollDiceAction(owner, { formula: "d20", context: "x".repeat(200) });
    expect(repoMock.saveDiceRoll.mock.calls[0][0].context).toHaveLength(80);
  });
});

// ── Search ───────────────────────────────────────────────────────────────────
describe("searchAction", () => {
  it("rejects a query shorter than 2 chars", async () => {
    expect(await searchAction(owner, "a")).toEqual({ error: "query_too_short" });
    expect(await searchAction(owner, "")).toEqual({ error: "query_too_short" });
  });
  it("rejects a query longer than 200 chars", async () => {
    expect(await searchAction(owner, "x".repeat(201))).toEqual({ error: "query_too_long" });
  });
  it("runs a scoped search for a valid query", async () => {
    repoMock.searchAll.mockResolvedValue({ spells: [], items: [], monsters: [], characters: [], quests: [], npcs: [], journalEntries: [] });
    await searchAction(owner, "fire");
    expect(repoMock.searchAll).toHaveBeenCalledWith("camp1", "fire");
  });
});

// ── Dashboard (DM-only) ───────────────────────────────────────────────────────
describe("getDashboardAction", () => {
  it("forbids a player", async () => {
    expect(await getDashboardAction(owner)).toEqual({ error: "forbidden" });
    expect(repoMock.getDashboardData).not.toHaveBeenCalled();
  });
  it("returns the snapshot for the DM", async () => {
    repoMock.getDashboardData.mockResolvedValue({ playerCount: 3 });
    const r = await getDashboardAction(dm);
    expect(r).toMatchObject({ playerCount: 3 });
    expect(repoMock.getDashboardData).toHaveBeenCalledWith("camp1");
  });
});

// ── Quick View (ownership) ────────────────────────────────────────────────────
describe("getQuickViewAction", () => {
  it("not_found when the character does not exist in the campaign", async () => {
    prismaMock.prisma.character.findFirst.mockResolvedValue(null);
    expect(await getQuickViewAction(owner, "cX")).toEqual({ error: "not_found" });
  });
  it("forbids a player who does not own the character", async () => {
    prismaMock.prisma.character.findFirst.mockResolvedValue(ownedChar);
    expect(await getQuickViewAction(intruder, "c1")).toEqual({ error: "forbidden" });
  });
  it("allows the owning player", async () => {
    prismaMock.prisma.character.findFirst.mockResolvedValue(ownedChar);
    repoMock.getQuickViewData.mockResolvedValue({ characterId: "c1", name: "Aria" });
    expect(await getQuickViewAction(owner, "c1")).toMatchObject({ name: "Aria" });
  });
  it("allows the DM for any character", async () => {
    prismaMock.prisma.character.findFirst.mockResolvedValue({ campaignId: "camp1", ownerSessionId: "p1" });
    repoMock.getQuickViewData.mockResolvedValue({ characterId: "c1", name: "Aria" });
    expect(await getQuickViewAction(dm, "c1")).toMatchObject({ name: "Aria" });
  });
});

// ── HP update ─────────────────────────────────────────────────────────────────
describe("updateHpAction", () => {
  it("rejects a non-integer HP value", async () => {
    expect(await updateHpAction(owner, "c1", 5.5)).toEqual({ error: "invalid_hp" });
    expect(await updateHpAction(owner, "c1", "10")).toEqual({ error: "invalid_hp" });
  });
  it("not_found for a missing character", async () => {
    prismaMock.prisma.character.findFirst.mockResolvedValue(null);
    expect(await updateHpAction(owner, "c1", 10)).toEqual({ error: "not_found" });
  });
  it("forbids a non-owner player", async () => {
    prismaMock.prisma.character.findFirst.mockResolvedValue(ownedChar);
    expect(await updateHpAction(intruder, "c1", 10)).toEqual({ error: "forbidden" });
  });
  it("delegates a valid update to the repo (clamping lives in repo)", async () => {
    prismaMock.prisma.character.findFirst.mockResolvedValue(ownedChar);
    repoMock.updateCharacterHp.mockResolvedValue({ currentHp: 10 });
    expect(await updateHpAction(owner, "c1", 10)).toEqual({ currentHp: 10 });
    expect(repoMock.updateCharacterHp).toHaveBeenCalledWith("camp1", "c1", 10);
  });
});

// ── Spell slots update ────────────────────────────────────────────────────────
describe("updateSpellSlotsAction", () => {
  const charWithSlots = { campaignId: "camp1", ownerSessionId: "p1", spellSlotsJson: '{"1":4,"2":3}' };

  it("rejects a non-object payload", async () => {
    expect(await updateSpellSlotsAction(owner, "c1", [1, 2])).toEqual({ error: "invalid_spell_slots" });
    expect(await updateSpellSlotsAction(owner, "c1", null)).toEqual({ error: "invalid_spell_slots" });
  });
  it("not_found for a missing character", async () => {
    prismaMock.prisma.character.findFirst.mockResolvedValue(null);
    expect(await updateSpellSlotsAction(owner, "c1", { "1": 1 })).toEqual({ error: "not_found" });
  });
  it("forbids a non-owner player", async () => {
    prismaMock.prisma.character.findFirst.mockResolvedValue(charWithSlots);
    expect(await updateSpellSlotsAction(intruder, "c1", { "1": 1 })).toEqual({ error: "forbidden" });
  });
  it("rejects a negative / non-integer slot value", async () => {
    prismaMock.prisma.character.findFirst.mockResolvedValue(charWithSlots);
    expect(await updateSpellSlotsAction(owner, "c1", { "1": -1 })).toEqual({ error: "invalid_value_for_level_1" });
    expect(await updateSpellSlotsAction(owner, "c1", { "2": 1.5 })).toEqual({ error: "invalid_value_for_level_2" });
  });
  it("rejects used > total at a level (boundary)", async () => {
    prismaMock.prisma.character.findFirst.mockResolvedValue(charWithSlots);
    expect(await updateSpellSlotsAction(owner, "c1", { "1": 5 })).toEqual({ error: "slots_exceed_total_at_level_1" });
  });
  it("accepts used == total (inclusive boundary) and persists validated map", async () => {
    prismaMock.prisma.character.findFirst.mockResolvedValue(charWithSlots);
    repoMock.updateSpellSlotsUsed.mockResolvedValue(undefined);
    expect(await updateSpellSlotsAction(owner, "c1", { "1": 4, "2": 0 })).toEqual({ ok: true });
    expect(repoMock.updateSpellSlotsUsed).toHaveBeenCalledWith("camp1", "c1", { "1": 4, "2": 0 });
  });
});
