import { describe, it, expect } from "vitest";
import { toSpellRow, toMonsterRow, toItemRow } from "@/prisma/seed/transform";

describe("toSpellRow", () => {
  const src = {
    index: "fireball",
    name: "Fireball",
    level: 3,
    desc: ["A bright streak…", "The fire spreads…"],
    higher_level: ["When you cast this spell using a spell slot of 4th level or higher…"],
    range: "150 feet",
    components: ["V", "S", "M"],
    material: "A tiny ball of bat guano and sulfur.",
    ritual: false,
    concentration: false,
    casting_time: "1 action",
    duration: "Instantaneous",
    school: { name: "Evocation" },
    classes: [{ name: "Sorcerer" }, { name: "Wizard" }],
  };
  it("maps core fields and joins multi-paragraph desc", () => {
    const r = toSpellRow(src);
    expect(r.slug).toBe("fireball");
    expect(r.level).toBe(3);
    expect(r.school).toBe("Evocation");
    expect(r.description).toContain("bright streak");
    expect(r.description).toContain("fire spreads");
  });
  it("encodes components + classes as JSON strings", () => {
    const r = toSpellRow(src);
    expect(JSON.parse(r.components)).toEqual({ v: true, s: true, m: "A tiny ball of bat guano and sulfur." });
    expect(JSON.parse(r.classesJson)).toEqual(["Sorcerer", "Wizard"]);
    expect(r.higherLevels).toContain("4th level");
  });
  it("handles a cantrip with no material/higher-level", () => {
    const r = toSpellRow({ index: "fire-bolt", name: "Fire Bolt", level: 0, desc: ["x"], range: "120 feet", components: ["V", "S"], ritual: false, concentration: false, casting_time: "1 action", duration: "Instantaneous", school: { name: "Evocation" }, classes: [{ name: "Wizard" }] });
    expect(JSON.parse(r.components)).toEqual({ v: true, s: true, m: null });
    expect(r.higherLevels).toBeNull();
  });
});

describe("toMonsterRow", () => {
  const goblin = {
    index: "goblin", name: "Goblin", size: "Small", type: "humanoid", subtype: "goblinoid", alignment: "neutral evil",
    armor_class: [{ type: "armor", value: 15, armor: [{ name: "Leather Armor" }, { name: "Shield" }] }],
    hit_points: 7, hit_points_roll: "2d6", speed: { walk: "30 ft." },
    strength: 8, dexterity: 14, constitution: 10, intelligence: 10, wisdom: 8, charisma: 8,
    proficiencies: [{ value: 6, proficiency: { name: "Skill: Stealth" } }],
    damage_immunities: [], condition_immunities: [], damage_resistances: [],
    senses: { darkvision: "60 ft.", passive_perception: 9 }, languages: "Common, Goblin",
    challenge_rating: 0.25, xp: 50,
    special_abilities: [{ name: "Nimble Escape", desc: "The goblin can take the Disengage…" }],
    actions: [{ name: "Scimitar", desc: "Melee Weapon Attack…" }],
  };
  it("derives cr display + crSort + xp deterministically", () => {
    const r = toMonsterRow(goblin);
    expect(r.cr).toBe("1/4");
    expect(r.crSort).toBe(0.25);
    expect(r.xp).toBe(50); // crToXp(0.25)
  });
  it("flattens ac/hp/ability scores", () => {
    const r = toMonsterRow(goblin);
    expect(r.ac).toBe(15);
    expect(r.acNote).toContain("Leather Armor");
    expect(r.hp).toBe(7);
    expect(r.hpFormula).toBe("2d6");
    expect(JSON.parse(r.abilityScores)).toEqual({ str: 8, dex: 14, con: 10, int: 10, wis: 8, cha: 8 });
  });
  it("splits proficiencies into skills vs saves", () => {
    const r = toMonsterRow(goblin);
    expect(JSON.parse(r.skillsJson)).toEqual({ Stealth: "+6" });
    expect(JSON.parse(r.savesJson)).toEqual({});
  });
  it("encodes traits + actions with kind", () => {
    const r = toMonsterRow(goblin);
    const actions = JSON.parse(r.actionsJson);
    expect(actions[0]).toMatchObject({ name: "Scimitar", kind: "action" });
    expect(JSON.parse(r.traitsJson)[0].name).toBe("Nimble Escape");
  });
});

describe("toItemRow", () => {
  it("maps a mundane weapon from Equipment", () => {
    const r = toItemRow({
      index: "longsword", name: "Longsword", equipment_category: { index: "weapon", name: "Weapon" },
      weapon_category: "Martial", weapon_range: "Melee",
      cost: { quantity: 15, unit: "gp" }, damage: { damage_dice: "1d8", damage_type: { name: "Slashing" } },
      two_handed_damage: { damage_dice: "1d10", damage_type: { name: "Slashing" } },
      weight: 3, properties: [{ name: "Versatile" }],
    });
    expect(r.slug).toBe("longsword");
    expect(r.type).toBe("weapon");
    expect(r.rarity).toBe("mundane");
    expect(r.requiresAttunement).toBe(false);
    const props = JSON.parse(r.propertiesJson);
    expect(props.damage).toBe("1d8 slashing");
    expect(props.versatile).toContain("1d10");
    expect(props.cost).toBe("15 gp");
  });
  it("maps a magic item rarity + attunement parsed from desc", () => {
    const r = toItemRow({
      index: "flame-tongue", name: "Flame Tongue", equipment_category: { index: "weapon", name: "Weapon" },
      rarity: { name: "Rare" }, desc: ["Weapon (any sword), rare (requires attunement)", "While the sword is ablaze…"],
    });
    expect(r.rarity).toBe("rare");
    expect(r.requiresAttunement).toBe(true);
    expect(r.description).toContain("ablaze");
  });
  it("normalizes 'Very Rare' and 'Wondrous Items'", () => {
    const r = toItemRow({ index: "x", name: "X", equipment_category: { index: "wondrous-items", name: "Wondrous Items" }, rarity: { name: "Very Rare" }, desc: ["no attune here"] });
    expect(r.rarity).toBe("very-rare");
    expect(r.type).toBe("wondrous");
    expect(r.requiresAttunement).toBe(false);
  });
});
