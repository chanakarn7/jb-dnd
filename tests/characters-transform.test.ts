import { describe, it, expect } from "vitest";
import {
  toClassRow, toSubclassRow, toClassLevelRow, toFeatureRow, toRaceRow, toBackgroundRow,
  SUBCLASS_LEVEL, PRIMARY_ABILITY,
} from "@/prisma/seed/transform-characters";

// QA Stage 8 — coverage for the SRD→schema mappers (prisma/seed/transform-characters.ts).
// These convert the dnd5eapi shape into our row shape; derived values (prof bonus) are
// computed here, not trusted from source. Pure functions → tested directly.

describe("toClassRow", () => {
  const fighter = {
    index: "fighter", name: "Fighter", hit_die: 10,
    saving_throws: [{ index: "str", name: "STR" }, { index: "con", name: "CON" }],
    proficiencies: [
      { name: "All armor" }, { name: "Shields" },
      { name: "Simple Weapons" }, { name: "Martial Weapons" },
      { name: "Saving Throw: STR" }, { name: "Skill: Acrobatics" },
    ],
    proficiency_choices: [{ choose: 2, from: { options: [
      { item: { name: "Skill: Acrobatics" } }, { item: { name: "Skill: Athletics" } },
    ] } }],
    subclasses: [{ index: "champion", name: "Champion" }],
  };

  it("maps hit die, saves, and splits proficiencies into armor/weapon/tool (skips skills/saves)", () => {
    const r = toClassRow(fighter);
    expect(r.slug).toBe("fighter");
    expect(r.hitDie).toBe(10);
    expect(JSON.parse(r.savesJson)).toEqual(["str", "con"]);
    expect(JSON.parse(r.armorProfJson)).toEqual(["All armor", "Shields"]);
    expect(JSON.parse(r.weaponProfJson)).toEqual(["Simple Weapons", "Martial Weapons"]);
    expect(JSON.parse(r.toolProfJson)).toEqual([]);
  });
  it("extracts skill choices (count + stripped names) and marks non-caster", () => {
    const r = toClassRow(fighter);
    expect(JSON.parse(r.skillChoicesJson)).toEqual({ from: ["Acrobatics", "Athletics"], count: 2 });
    expect(r.spellcastingJson).toBeNull();
    expect(r.subclassLevel).toBe(SUBCLASS_LEVEL.fighter); // 3
    expect(r.primaryAbility).toBe(PRIMARY_ABILITY.fighter); // "str"
    expect(r.license).toBe("CC-BY-4.0");
  });
  it("marks a caster when spellcasting is present (Wizard, subclass at L2)", () => {
    const r = toClassRow({
      index: "wizard", name: "Wizard", hit_die: 6,
      saving_throws: [{ index: "int" }, { index: "wis" }],
      spellcasting: { spellcasting_ability: { index: "int", name: "INT" } },
    });
    expect(JSON.parse(r.spellcastingJson!)).toEqual({ ability: "int", type: "by-class" });
    expect(r.subclassLevel).toBe(2);
  });
});

describe("toClassLevelRow", () => {
  it("computes proficiency bonus from level (ignores a wrong source value) and keeps only >0 slots", () => {
    const r = toClassLevelRow({
      level: 5, class: { index: "wizard" }, prof_bonus: 99, // wrong on purpose
      features: [{ index: "feat-a" }, { index: "feat-b" }],
      spellcasting: { spell_slots_level_1: 4, spell_slots_level_2: 3, spell_slots_level_3: 2, spell_slots_level_4: 0 },
      class_specific: { arcane_recovery_levels: 3 },
    });
    expect(r.proficiencyBonus).toBe(3); // profBonusForLevel(5), NOT 99
    expect(JSON.parse(r.spellSlotsJson)).toEqual({ "1": 4, "2": 3, "3": 2 }); // level_4=0 dropped
    expect(JSON.parse(r.featuresJson)).toEqual(["feat-a", "feat-b"]);
    expect(JSON.parse(r.classCountersJson)).toEqual({ arcane_recovery_levels: 3 });
    expect(r.classSlug).toBe("wizard");
  });
  it("non-caster level → empty spell slots", () => {
    const r = toClassLevelRow({ level: 1, class: { index: "fighter" }, features: [] });
    expect(JSON.parse(r.spellSlotsJson)).toEqual({});
    expect(r.proficiencyBonus).toBe(2);
  });
});

describe("toSubclassRow", () => {
  it("joins desc into description, keeps flavor, and carries community source/license", () => {
    const r = toSubclassRow(
      { index: "oss-warlord", name: "Warlord", class: { index: "fighter" }, subclass_flavor: "Battlefield Commander", desc: ["Leads the charge.", "Buffs allies."] },
      { "3": ["commanding-presence"] },
      { source: "Community OGL Pack", license: "OGL-1.0a" },
    );
    expect(r.classSlug).toBe("fighter");
    expect(r.flavor).toBe("Battlefield Commander");
    expect(r.description).toBe("Leads the charge.\n\nBuffs allies.");
    expect(JSON.parse(r.featuresByLevelJson)).toEqual({ "3": ["commanding-presence"] });
    expect(r.source).toBe("Community OGL Pack");
    expect(r.license).toBe("OGL-1.0a");
  });
  it("defaults to SRD source/license and null description when desc missing", () => {
    const r = toSubclassRow({ index: "champion", name: "Champion", class: { index: "fighter" } });
    expect(r.source).toBe("SRD 5.1");
    expect(r.license).toBe("CC-BY-4.0");
    expect(r.description).toBeNull();
  });
});

describe("toRaceRow / toFeatureRow / toBackgroundRow", () => {
  it("race: ability bonuses keyed by ability, base race has null parent", () => {
    const r = toRaceRow({
      index: "dwarf", name: "Dwarf", speed: 25, size: "Medium",
      ability_bonuses: [{ ability_score: { index: "con" }, bonus: 2 }],
      traits: [{ name: "Darkvision" }, { name: "Dwarven Resilience" }],
    });
    expect(r.parentRaceSlug).toBeNull();
    expect(r.speed).toBe(25);
    expect(JSON.parse(r.abilityBonusesJson)).toEqual({ con: 2 });
    expect(JSON.parse(r.traitsJson)).toEqual([{ name: "Darkvision" }, { name: "Dwarven Resilience" }]);
  });
  it("subrace: parentRaceSlug from race ref, speed 0 (inherits)", () => {
    const r = toRaceRow({ index: "hill-dwarf", name: "Hill Dwarf", race: { index: "dwarf" }, ability_bonuses: [{ ability_score: { index: "wis" }, bonus: 1 }] }, true);
    expect(r.parentRaceSlug).toBe("dwarf");
    expect(r.speed).toBe(0);
    expect(JSON.parse(r.abilityBonusesJson)).toEqual({ wis: 1 });
  });
  it("feature: class/subclass slugs + level + joined desc", () => {
    const r = toFeatureRow({ index: "sculpt-spells", name: "Sculpt Spells", subclass: { index: "evocation" }, level: 2, desc: ["Shape your spells."] });
    expect(r).toMatchObject({ slug: "sculpt-spells", subclassSlug: "evocation", classSlug: null, level: 2, description: "Shape your spells." });
  });
  it("background: strips 'Skill:' prefix into skillProficiencies, builds feature object", () => {
    const r = toBackgroundRow({
      index: "acolyte", name: "Acolyte",
      starting_proficiencies: [{ name: "Skill: Insight" }, { name: "Skill: Religion" }],
      feature: { name: "Shelter of the Faithful", desc: ["You command respect."] },
    });
    expect(JSON.parse(r.skillProficienciesJson)).toEqual(["Insight", "Religion"]);
    expect(JSON.parse(r.featureJson)).toEqual({ name: "Shelter of the Faithful", desc: "You command respect." });
  });
});
