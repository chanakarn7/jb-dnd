import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

// QA Stage 8 — refRepo parses JSON columns into typed objects, caches each kind in
// memory (static after seed), and degrades gracefully on a malformed column (PRD 5.10).

const m = vi.hoisted(() => ({
  classFind: vi.fn(), classLevelFind: vi.fn(), subclassFind: vi.fn(),
  raceFind: vi.fn(), backgroundFind: vi.fn(), featureFind: vi.fn(),
}));
vi.mock("@/lib/db", () => ({
  prisma: {
    class: { findMany: m.classFind },
    classLevel: { findMany: m.classLevelFind },
    subclass: { findMany: m.subclassFind },
    race: { findMany: m.raceFind },
    background: { findMany: m.backgroundFind },
    feature: { findMany: m.featureFind },
  },
}));

import * as ref from "@/lib/characters/refRepo";

beforeEach(() => {
  vi.clearAllMocks();
  ref.__resetRefCache();
  m.classFind.mockResolvedValue([
    { slug: "wizard", name: "Wizard", hitDie: 6, primaryAbility: "int",
      savesJson: '["int","wis"]', armorProfJson: "[]", weaponProfJson: "[]", toolProfJson: "[]",
      skillChoicesJson: '{"from":["Arcana","History"],"count":2}',
      spellcastingJson: '{"ability":"int","type":"by-class"}', subclassLevel: 2, source: "SRD 5.1", license: "CC-BY-4.0" },
    { slug: "fighter", name: "Fighter", hitDie: 10, primaryAbility: "str",
      savesJson: "{BROKEN", armorProfJson: "[]", weaponProfJson: "[]", toolProfJson: "[]", // malformed on purpose
      skillChoicesJson: "{}", spellcastingJson: null, subclassLevel: 3, source: "SRD 5.1", license: "CC-BY-4.0" },
  ]);
  m.classLevelFind.mockResolvedValue([
    { classSlug: "wizard", level: 1, proficiencyBonus: 2, featuresJson: '["spellcasting"]', spellSlotsJson: '{"1":2}', classCountersJson: "{}" },
  ]);
  m.subclassFind.mockResolvedValue([
    { slug: "evocation", classSlug: "wizard", name: "Evocation", flavor: "Arcane Tradition", description: "Boom.", featuresByLevelJson: '{"2":["sculpt-spells"]}', source: "SRD 5.1", license: "CC-BY-4.0" },
    { slug: "oss-x", classSlug: "wizard", name: "Community X", flavor: null, description: null, featuresByLevelJson: "{}", source: "Open5e", license: "OGL-1.0a" },
  ]);
  m.raceFind.mockResolvedValue([
    { slug: "dwarf", name: "Dwarf", parentRaceSlug: null, abilityBonusesJson: '{"con":2}', size: "Medium", speed: 25, traitsJson: '[{"name":"Darkvision"}]', proficienciesJson: "{}", languagesJson: "[]" },
  ]);
  m.backgroundFind.mockResolvedValue([
    { slug: "acolyte", name: "Acolyte", skillProficienciesJson: '["Insight","Religion"]', toolProficienciesJson: "[]", languagesJson: "[]", featureJson: '{"name":"Shelter","desc":"x"}', startingEquipment: null },
  ]);
});

describe("refRepo — parsing + shapes", () => {
  it("getClass parses saves/skillChoices/spellcasting + embeds level progression", async () => {
    const c = await ref.getClass("wizard");
    expect(c?.saves).toEqual(["int", "wis"]);
    expect(c?.skillChoices).toEqual({ from: ["Arcana", "History"], count: 2 });
    expect(c?.spellcasting).toEqual({ ability: "int", type: "by-class" });
    expect(c?.isCaster).toBe(true);
    expect(c?.levels[0]).toMatchObject({ level: 1, proficiencyBonus: 2, spellSlots: { "1": 2 } });
  });
  it("a malformed JSON column degrades to the fallback, never throws (edge 5.10)", async () => {
    const c = await ref.getClass("fighter");
    expect(c?.saves).toEqual([]); // broken savesJson → []
    expect(c?.isCaster).toBe(false); // spellcastingJson null
  });
  it("getClasses returns a lean list (isCaster derived, no levels array)", async () => {
    const list = await ref.getClasses();
    expect(list).toHaveLength(2);
    expect(list[0]).not.toHaveProperty("levels");
    expect(list.find((x) => x.slug === "wizard")?.isCaster).toBe(true);
  });
  it("getSubclasses filters by class and carries per-row license", async () => {
    const subs = await ref.getSubclasses("wizard");
    expect(subs).toHaveLength(2);
    expect(subs.find((s) => s.slug === "oss-x")?.license).toBe("OGL-1.0a");
    expect(subs.find((s) => s.slug === "evocation")?.license).toBe("CC-BY-4.0");
  });
  it("getRace parses ability bonuses; getBackground parses skills", async () => {
    expect((await ref.getRace("dwarf"))?.abilityBonuses).toEqual({ con: 2 });
    expect((await ref.getBackground("acolyte"))?.skillProficiencies).toEqual(["Insight", "Religion"]);
  });
  it("returns null for an unknown slug (drives the 404 route)", async () => {
    expect(await ref.getClass("nope")).toBeNull();
    expect(await ref.getSubclass("nope")).toBeNull();
  });
});

describe("refRepo — in-memory cache", () => {
  it("queries each table once even across many reads", async () => {
    await ref.getClasses();
    await ref.getClass("wizard");
    await ref.getClass("fighter");
    await ref.getSubclasses("wizard");
    await ref.getSubclass("evocation");
    await ref.getRaces();
    await ref.getBackground("acolyte");
    expect((m.classFind as Mock).mock.calls.length).toBe(1);
    expect((m.subclassFind as Mock).mock.calls.length).toBe(1);
    expect((m.raceFind as Mock).mock.calls.length).toBe(1);
    expect((m.backgroundFind as Mock).mock.calls.length).toBe(1);
  });
});
