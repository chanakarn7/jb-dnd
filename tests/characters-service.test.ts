import { describe, it, expect, vi, beforeEach } from "vitest";

// QA Stage 8 — the heaviest logic (derive defaults, override/recompute, authz, spells)
// had ZERO coverage. We mock refRepo (GLOBAL reference), charRepo (persistence), and
// Prisma so no DB is touched — matching the Sprint 1 approach.

const refMock = vi.hoisted(() => ({
  getClass: vi.fn(), getRace: vi.fn(), getSubclass: vi.fn(),
  getBackground: vi.fn(), getFeatureMap: vi.fn(),
}));
const repoMock = vi.hoisted(() => ({
  update: vi.fn(), findInCampaign: vi.fn(), listByCampaign: vi.fn(),
  addSpell: vi.fn(), setPrepared: vi.fn(), removeSpell: vi.fn(),
}));
const dbMock = vi.hoisted(() => ({
  $transaction: vi.fn(),
  spell: { findMany: vi.fn() },
}));

vi.mock("@/lib/characters/refRepo", () => refMock);
vi.mock("@/lib/characters/charRepo", () => repoMock);
vi.mock("@/lib/db", () => ({ prisma: dbMock }));

import { createCharacter, updateCharacter, manageSpell, canWrite, type Session } from "@/lib/characters/service";

const FIGHTER = {
  slug: "fighter", name: "Fighter", hitDie: 10, primaryAbility: "str", isCaster: false, subclassLevel: 3,
  saves: ["str", "con"], armorProf: [], weaponProf: [], toolProf: [],
  skillChoices: { from: ["Athletics", "Intimidation"], count: 2 }, spellcasting: null,
  levels: Array.from({ length: 20 }, (_, i) => ({ level: i + 1, proficiencyBonus: 2 + Math.floor(i / 4), features: [], spellSlots: {}, counters: {} })),
};
const WIZARD = {
  ...FIGHTER, slug: "wizard", name: "Wizard", hitDie: 6, isCaster: true, subclassLevel: 2,
  saves: ["int", "wis"], spellcasting: { ability: "int", type: "by-class" },
  levels: Array.from({ length: 20 }, (_, i) => ({ level: i + 1, proficiencyBonus: 2 + Math.floor(i / 4), features: [], spellSlots: i + 1 >= 5 ? { "1": 4, "2": 3, "3": 2 } : { "1": 2 }, counters: {} })),
};
const DWARF = { slug: "dwarf", name: "Dwarf", parentRaceSlug: null, size: "Medium", speed: 25, abilityBonuses: { con: 2 }, traits: [{ name: "Darkvision" }], proficiencies: [], languages: [] };
const ACOLYTE = { slug: "acolyte", name: "Acolyte", skillProficiencies: ["Insight", "Religion"], toolProficiencies: [], languages: [], feature: { name: "Shelter of the Faithful", desc: "…" }, startingEquipment: null };

const player: Session = { sessionId: "sess-1", campaignId: "camp-1", role: "player" };

beforeEach(() => {
  vi.clearAllMocks();
  refMock.getClass.mockResolvedValue(FIGHTER);
  refMock.getRace.mockResolvedValue(DWARF);
  refMock.getSubclass.mockResolvedValue(null);
  refMock.getBackground.mockResolvedValue(ACOLYTE);
  refMock.getFeatureMap.mockResolvedValue(new Map());
  dbMock.spell.findMany.mockResolvedValue([]);
  // interactive $transaction: run the callback with a tx that echoes the created row
  dbMock.$transaction.mockImplementation(async (cb: (tx: unknown) => unknown) =>
    cb({
      character: { create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: "char-1", ...data, spells: [] })) },
      playerSession: { update: vi.fn(async () => ({})) },
    }),
  );
});

describe("createCharacter — auto-fill derive (Dwarf Fighter L1)", () => {
  it("applies race bonus, derives HP/AC/PB/saves/skills, hides slots for non-caster", async () => {
    const res = await createCharacter(player, {
      name: "Thorin", raceSlug: "dwarf", classSlug: "fighter", backgroundSlug: "acolyte",
      level: 1, abilityMethod: "standard-array",
      baseAbilities: { str: 15, dex: 13, con: 14, int: 10, wis: 12, cha: 8 },
      skills: ["Athletics", "Intimidation"],
    });
    if ("error" in res) throw new Error(res.error);
    expect(res.abilities.con).toBe(16); // 14 + 2 (Dwarf)
    expect(res.maxHp).toBe(13); // d10 max 10 + CON mod 3
    expect(res.currentHp).toBe(13);
    expect(res.ac).toBe(11); // 10 + DEX mod 1
    expect(res.proficiencyBonus).toBe(2);
    expect(res.speed).toBe(25);
    expect(res.saves.str).toEqual({ proficient: true, mod: 4 }); // +2 +2
    expect(res.saves.con).toEqual({ proficient: true, mod: 5 }); // +3 +2
    expect(res.skills.Athletics).toEqual({ proficient: true, mod: 4 });
    expect(res.skills.Insight.proficient).toBe(true); // from background
    expect(res.spellSlots).toBeNull(); // non-caster
    expect(res.ownedByMe).toBe(true);
  });

  it("a Wizard L5 gets caster slots; ability method recorded", async () => {
    refMock.getClass.mockResolvedValue(WIZARD);
    const res = await createCharacter(player, {
      name: "Gandalf", raceSlug: "dwarf", classSlug: "wizard", level: 5, abilityMethod: "point-buy",
      baseAbilities: { str: 8, dex: 14, con: 14, int: 15, wis: 12, cha: 10 }, skills: [],
    });
    if ("error" in res) throw new Error(res.error);
    expect(res.spellSlots).toEqual({ "1": 4, "2": 3, "3": 2 });
    expect(res.proficiencyBonus).toBe(3);
    expect(res.abilityMethod).toBe("point-buy");
  });

  it("picking a SUBRACE applies BOTH base-race and subrace bonuses/speed/name (QA fix)", async () => {
    const ELF = { slug: "elf", name: "Elf", parentRaceSlug: null, size: "Medium", speed: 30, abilityBonuses: { dex: 2 }, traits: [{ name: "Fey Ancestry" }], proficiencies: [], languages: [] };
    const HIGH_ELF = { slug: "high-elf", name: "High Elf", parentRaceSlug: "elf", size: "Medium", speed: 0, abilityBonuses: { int: 1 }, traits: [{ name: "Cantrip" }], proficiencies: [], languages: [] };
    refMock.getRace.mockImplementation(async (slug: string) => (slug === "elf" ? ELF : slug === "high-elf" ? HIGH_ELF : null));
    const res = await createCharacter(player, {
      name: "Gandalf", raceSlug: "high-elf", classSlug: "fighter", abilityMethod: "standard-array",
      baseAbilities: { str: 10, dex: 13, con: 14, int: 10, wis: 12, cha: 8 },
    });
    if ("error" in res) throw new Error(res.error);
    expect(res.abilities.dex).toBe(15); // 13 + 2 (base Elf)
    expect(res.abilities.int).toBe(11); // 10 + 1 (High Elf)
    expect(res.speed).toBe(30); // base Elf speed, not the subrace's 0
    expect(res.raceName).toBe("High Elf"); // displays the picked subrace
    expect(res.features.map((f) => f.name)).toEqual(expect.arrayContaining(["Fey Ancestry", "Cantrip"]));
  });

  it("returns an error when the class/race reference does not exist", async () => {
    refMock.getClass.mockResolvedValue(null);
    const res = await createCharacter(player, {
      name: "X", raceSlug: "dwarf", classSlug: "nope", abilityMethod: "standard-array",
      baseAbilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    });
    expect(res).toEqual({ error: "invalid_reference" });
  });

  it("DM creating an NPC leaves it unclaimed (ownerSessionId null, no session.update)", async () => {
    const dm: Session = { sessionId: "dm-1", campaignId: "camp-1", role: "dm" };
    let capturedData: Record<string, unknown> = {};
    dbMock.$transaction.mockImplementation(async (cb: (tx: unknown) => unknown) =>
      cb({
        character: { create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => { capturedData = data; return { id: "npc-1", ...data, spells: [] }; }) },
        playerSession: { update: vi.fn(async () => { throw new Error("should not claim an NPC"); }) },
      }),
    );
    const res = await createCharacter(dm, {
      name: "Town Guard", raceSlug: "dwarf", classSlug: "fighter", abilityMethod: "standard-array",
      baseAbilities: { str: 13, dex: 12, con: 14, int: 10, wis: 11, cha: 10 }, isNpc: true,
    });
    if ("error" in res) throw new Error(res.error);
    expect(capturedData.isNpc).toBe(true);
    expect(capturedData.ownerSessionId).toBeNull();
  });
});

describe("updateCharacter — override + recompute", () => {
  const base = () => ({
    id: "char-1", campaignId: "camp-1", ownerSessionId: "sess-1", isNpc: false, name: "Thorin",
    raceSlug: "dwarf", subraceSlug: null, classSlug: "fighter", subclassSlug: null, backgroundSlug: "acolyte",
    level: 3, str: 15, dex: 13, con: 16, int: 10, wis: 12, cha: 8, abilityMethod: "standard-array",
    baseAbilitiesJson: "{}", proficiencyBonus: 2, maxHp: 28, currentHp: 28, tempHp: 0, ac: 11, speed: 25, initiative: 1,
    savesJson: '{"str":true,"con":true}', skillsJson: '{"Athletics":true}', spellSlotsJson: "{}",
    conditionsJson: "[]", overridesJson: "[]", currencyJson: "{}", notes: null, createdAt: new Date(), updatedAt: new Date(), spells: [],
  });

  it("editing a derived field records it as an override and persists the user value", async () => {
    repoMock.update.mockImplementation(async (_id: string, data: Record<string, unknown>) => ({ ...base(), ...data, spells: [] }));
    const res = await updateCharacter(base(), player, { maxHp: 99 });
    if ("error" in res) throw new Error(res.error);
    const data = repoMock.update.mock.calls[0][1];
    expect(data.maxHp).toBe(99);
    expect(JSON.parse(data.overridesJson)).toContain("maxHp");
  });

  it("a level change recomputes auto fields but does NOT overwrite an overridden field", async () => {
    repoMock.update.mockImplementation(async (_id: string, data: Record<string, unknown>) => ({ ...base(), ...data, spells: [] }));
    const overridden = { ...base(), maxHp: 99, overridesJson: '["maxHp"]' };
    const res = await updateCharacter(overridden, player, { level: 5 });
    if ("error" in res) throw new Error(res.error);
    const data = repoMock.update.mock.calls[0][1];
    expect(data.level).toBe(5);
    expect(data.proficiencyBonus).toBe(3); // recomputed (auto)
    expect(data.maxHp).toBe(99); // preserved (overridden)
  });

  it("resetAuto clears the override and recomputes that field", async () => {
    repoMock.update.mockImplementation(async (_id: string, data: Record<string, unknown>) => ({ ...base(), ...data, spells: [] }));
    const overridden = { ...base(), level: 3, maxHp: 99, overridesJson: '["maxHp"]' };
    const res = await updateCharacter(overridden, player, { resetAuto: ["maxHp"] });
    if ("error" in res) throw new Error(res.error);
    const data = repoMock.update.mock.calls[0][1];
    expect(JSON.parse(data.overridesJson)).not.toContain("maxHp");
    expect(data.maxHp).toBe(31); // recomputed: Fighter d10 L3, CON 16 (+3) → 13 + 2*(6+3) = 31
  });

  it("currentHp is clamped to maxHp + tempHp", async () => {
    repoMock.update.mockImplementation(async (_id: string, data: Record<string, unknown>) => ({ ...base(), ...data, spells: [] }));
    const res = await updateCharacter(base(), player, { currentHp: 999 });
    if ("error" in res) throw new Error(res.error);
    const data = repoMock.update.mock.calls[0][1];
    expect(data.currentHp).toBe(data.maxHp); // can't exceed max
  });
});

describe("canWrite — authorization (DoD #7)", () => {
  const npc = { campaignId: "camp-1", ownerSessionId: null };
  const mine = { campaignId: "camp-1", ownerSessionId: "sess-1" };
  const others = { campaignId: "camp-1", ownerSessionId: "sess-2" };
  const otherCampaign = { campaignId: "camp-2", ownerSessionId: "sess-1" };

  it("a player may write only their own character", () => {
    expect(canWrite(mine, player)).toBe(true);
    expect(canWrite(others, player)).toBe(false); // someone else's
    expect(canWrite(npc, player)).toBe(false); // DM-owned NPC
  });
  it("the DM may write any character in their campaign", () => {
    const dm: Session = { sessionId: "dm-1", campaignId: "camp-1", role: "dm" };
    expect(canWrite(others, dm)).toBe(true);
    expect(canWrite(npc, dm)).toBe(true);
  });
  it("never across campaigns, even for your own session id", () => {
    expect(canWrite(otherCampaign, player)).toBe(false);
    const dm: Session = { sessionId: "dm-1", campaignId: "camp-1", role: "dm" };
    expect(canWrite(otherCampaign, dm)).toBe(false);
  });
});

describe("manageSpell — known/prepared (DoD #5)", () => {
  const existing = { id: "char-1", campaignId: "camp-1", ownerSessionId: "sess-1", spells: [] } as never;
  beforeEach(() => {
    repoMock.findInCampaign.mockResolvedValue({
      id: "char-1", campaignId: "camp-1", ownerSessionId: "sess-1", classSlug: "wizard", raceSlug: "dwarf",
      subraceSlug: null, subclassSlug: null, backgroundSlug: null, level: 5, name: "G", isNpc: false,
      str: 8, dex: 14, con: 14, int: 15, wis: 12, cha: 10, abilityMethod: "point-buy", baseAbilitiesJson: "{}",
      proficiencyBonus: 3, maxHp: 22, currentHp: 22, tempHp: 0, ac: 12, speed: 25, initiative: 2,
      savesJson: "{}", skillsJson: "{}", spellSlotsJson: '{"1":4}', conditionsJson: "[]", overridesJson: "[]", currencyJson: "{}",
      notes: null, createdAt: new Date(), updatedAt: new Date(),
      spells: [{ spellSlug: "fireball", known: true, prepared: true, campaignId: "camp-1", characterId: "char-1", id: "cs1" }],
    });
    refMock.getClass.mockResolvedValue(WIZARD);
    dbMock.spell.findMany.mockResolvedValue([{ slug: "fireball", name: "Fireball", level: 3 }]);
  });

  it("add → upserts the CharacterSpell as known", async () => {
    await manageSpell(existing, player, "add", "fireball");
    expect(repoMock.addSpell).toHaveBeenCalledWith("camp-1", "char-1", "fireball");
  });
  it("prepare/unprepare → toggles the prepared flag", async () => {
    await manageSpell(existing, player, "prepare", "fireball");
    expect(repoMock.setPrepared).toHaveBeenCalledWith("char-1", "fireball", true);
    await manageSpell(existing, player, "unprepare", "fireball");
    expect(repoMock.setPrepared).toHaveBeenCalledWith("char-1", "fireball", false);
  });
  it("remove → deletes the join row; detail resolves real spell name/level", async () => {
    const res = await manageSpell(existing, player, "remove", "fireball");
    expect(repoMock.removeSpell).toHaveBeenCalledWith("char-1", "fireball");
    if ("error" in res) throw new Error(res.error);
    expect(res.spells[0]).toMatchObject({ name: "Fireball", level: 3, prepared: true });
  });
  it("an unknown action is rejected", async () => {
    const res = await manageSpell(existing, player, "explode", "fireball");
    expect(res).toEqual({ error: "bad_action" });
  });
});
