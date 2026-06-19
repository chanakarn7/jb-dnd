import { describe, it, expect, vi, type Mock } from "vitest";

// Gap-closing tests (QA Stage 8) for lib/reference/repo.ts:
// JSON-column parsing → typed objects, lean list vs full detail shapes,
// null-on-missing slug, malformed-JSON graceful fallback (PRD edge 5.6),
// and the in-memory cache (a second read must NOT re-query the DB).
// Prisma is mocked (no real DB), matching the Foundation test approach.

// vi.mock is hoisted above imports, so the mock fns must come from vi.hoisted.
const { findManySpell, findManyMonster, findManyItem } = vi.hoisted(() => ({
  findManySpell: vi.fn(),
  findManyMonster: vi.fn(),
  findManyItem: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    spell: { findMany: findManySpell },
    monster: { findMany: findManyMonster },
    item: { findMany: findManyItem },
  },
}));

import * as repo from "@/lib/reference/repo";

findManySpell.mockResolvedValue([
  {
    slug: "fireball", name: "Fireball", level: 3, school: "Evocation", castingTime: "1 action",
    range: "150 feet", duration: "Instantaneous",
    components: JSON.stringify({ v: true, s: true, m: "bat guano" }),
    ritual: false, concentration: false, description: "A bright streak…",
    higherLevels: "At higher levels…", classesJson: JSON.stringify(["Sorcerer", "Wizard"]), source: "SRD 5.1",
  },
]);
findManyMonster.mockResolvedValue([
  {
    slug: "goblin", name: "Goblin", size: "Small", type: "humanoid", alignment: "neutral evil",
    cr: "1/4", crSort: 0.25, xp: 50, ac: 15, acNote: "leather", hp: 7, hpFormula: "2d6", speed: "30 ft.",
    abilityScores: JSON.stringify({ str: 8, dex: 14, con: 10, int: 10, wis: 8, cha: 8 }),
    savesJson: JSON.stringify({}), skillsJson: JSON.stringify({ Stealth: "+6" }),
    senses: "darkvision 60 ft.", languages: "Common, Goblin",
    immunitiesJson: JSON.stringify({ damage: ["fire"], condition: ["charmed"] }),
    resistancesJson: JSON.stringify(["cold"]),
    traitsJson: "{ BROKEN json", // malformed on purpose → must fall back to [] (edge 5.6)
    actionsJson: JSON.stringify([{ name: "Scimitar", desc: "…", kind: "action" }]), source: "SRD 5.1",
  },
]);
findManyItem.mockResolvedValue([
  {
    slug: "longsword", name: "Longsword", type: "weapon", rarity: "mundane", requiresAttunement: false,
    propertiesJson: JSON.stringify({ damage: "1d8 slashing", cost: "15 gp" }), description: null, source: "SRD 5.1",
  },
]);

describe("repo — spells", () => {
  it("getSpells returns a LEAN list item (no detail-only fields) with classes parsed", async () => {
    const list = await repo.getSpells();
    expect(list).toHaveLength(1);
    expect(list[0]).toEqual({
      slug: "fireball", name: "Fireball", level: 3, school: "Evocation",
      castingTime: "1 action", ritual: false, concentration: false, classes: ["Sorcerer", "Wizard"],
    });
    expect(list[0]).not.toHaveProperty("description");
    expect(list[0]).not.toHaveProperty("range");
  });
  it("getSpell returns full detail with components object + higherLevels", async () => {
    const s = await repo.getSpell("fireball");
    expect(s?.components).toEqual({ v: true, s: true, m: "bat guano" });
    expect(s?.higherLevels).toBe("At higher levels…");
    expect(s?.description).toContain("bright streak");
  });
  it("getSpell returns null for an unknown slug (drives the 404 route)", async () => {
    expect(await repo.getSpell("does-not-exist")).toBeNull();
  });
});

describe("repo — monsters", () => {
  it("parses nested JSON columns into typed objects", async () => {
    const m = await repo.getMonster("goblin");
    expect(m?.abilityScores).toEqual({ str: 8, dex: 14, con: 10, int: 10, wis: 8, cha: 8 });
    expect(m?.skills).toEqual({ Stealth: "+6" });
    expect(m?.immunities).toEqual({ damage: ["fire"], condition: ["charmed"] });
    expect(m?.resistances).toEqual(["cold"]);
    expect(m?.actions[0]).toMatchObject({ name: "Scimitar", kind: "action" });
  });
  it("falls back gracefully when a JSON column is malformed (PRD edge 5.6)", async () => {
    const m = await repo.getMonster("goblin");
    expect(m?.traits).toEqual([]); // broken traitsJson → [] instead of throwing
  });
  it("getMonsters returns a lean list (no actions/traits)", async () => {
    const list = await repo.getMonsters();
    expect(list[0]).not.toHaveProperty("actions");
    expect(list[0]).toMatchObject({ slug: "goblin", cr: "1/4", crSort: 0.25, hp: 7, ac: 15 });
  });
});

describe("repo — items + cache", () => {
  it("maps item properties and null-on-missing", async () => {
    const it = await repo.getItem("longsword");
    expect(it?.properties).toEqual({ damage: "1d8 slashing", cost: "15 gp" });
    expect(await repo.getItem("nope")).toBeNull();
  });
  it("caches each kind in memory — repeated reads never re-query the DB", async () => {
    await repo.getSpells();
    await repo.getSpell("fireball");
    await repo.getMonsters();
    await repo.getItems();
    await repo.getItem("longsword");
    // Despite many calls above (and in earlier tests), each findMany ran exactly once.
    expect((findManySpell as Mock).mock.calls.length).toBe(1);
    expect((findManyMonster as Mock).mock.calls.length).toBe(1);
    expect((findManyItem as Mock).mock.calls.length).toBe(1);
  });
});
