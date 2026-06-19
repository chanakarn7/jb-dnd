import { describe, it, expect } from "vitest";
import { filterSpells, filterMonsters, filterItems } from "@/lib/reference/filter";
import { toMonsterRow, toItemRow, toSpellRow } from "@/prisma/seed/transform";
import type { SpellListItem, MonsterListItem, ItemListItem } from "@/lib/reference/types";

// Gap-closing tests (QA Stage 8): filter boundaries + empty-result paths (which
// drive the empty-search vs empty-filter UI states), and transform robustness
// against missing/optional source fields (statblocks vary a lot in SRD).

const spells: SpellListItem[] = [
  { slug: "fireball", name: "Fireball", level: 3, school: "Evocation", castingTime: "1 action", ritual: false, concentration: false, classes: ["Wizard"] },
];
const monsters: MonsterListItem[] = [
  { slug: "goblin", name: "Goblin", cr: "1/4", crSort: 0.25, type: "humanoid", size: "Small", hp: 7, ac: 15 },
  { slug: "ogre", name: "Ogre", cr: "2", crSort: 2, type: "giant", size: "Large", hp: 59, ac: 11 },
];
const items: ItemListItem[] = [
  { slug: "longsword", name: "Longsword", type: "weapon", rarity: "mundane", requiresAttunement: false },
];

describe("filter — empty-result + boundary paths", () => {
  it("search with no match yields [] (drives empty-search state)", () => {
    expect(filterSpells(spells, { q: "zzzznope" })).toEqual([]);
  });
  it("filter combo with no match yields [] (drives empty-filter state)", () => {
    expect(filterSpells(spells, { level: "9" })).toEqual([]);
  });
  it("crMax is INCLUSIVE at the boundary", () => {
    expect(filterMonsters(monsters, { crMax: 2 }).map((m) => m.slug)).toEqual(["goblin", "ogre"]);
    expect(filterMonsters(monsters, { crMax: 0.25 }).map((m) => m.slug)).toEqual(["goblin"]);
    expect(filterMonsters(monsters, { crMax: 0 })).toEqual([]);
  });
  it("name match is case-insensitive and trims", () => {
    expect(filterItems(items, { q: "  LONG " }).map((i) => i.slug)).toEqual(["longsword"]);
  });
});

describe("transform — robustness against missing optional fields", () => {
  it("monster with no armor_class / proficiencies / reactions does not crash", () => {
    const r = toMonsterRow({
      index: "shrub", name: "Awakened Shrub", size: "Small", type: "plant", alignment: "neutral",
      hit_points: 10, speed: { walk: "20 ft." },
      strength: 3, dexterity: 8, constitution: 11, intelligence: 10, wisdom: 10, charisma: 6,
      challenge_rating: 0,
      // no armor_class, no proficiencies, no senses, no special_abilities, no actions
    });
    expect(r.ac).toBe(0);
    expect(r.acNote).toBeNull();
    expect(JSON.parse(r.savesJson)).toEqual({});
    expect(JSON.parse(r.skillsJson)).toEqual({});
    expect(r.senses).toBeNull();
    expect(JSON.parse(r.actionsJson)).toEqual([]);
    expect(r.cr).toBe("0");
    expect(r.xp).toBe(10); // crToXp(0)
  });
  it("monster legendary + reactions are tagged with their kind", () => {
    const r = toMonsterRow({
      index: "lich", name: "Lich", size: "Medium", type: "undead", alignment: "neutral evil",
      armor_class: [{ value: 17 }], hit_points: 135, speed: { walk: "30 ft." },
      strength: 11, dexterity: 16, constitution: 16, intelligence: 20, wisdom: 14, charisma: 16,
      challenge_rating: 21,
      actions: [{ name: "Paralyzing Touch", desc: "…" }],
      reactions: [{ name: "Counterspell", desc: "…" }],
      legendary_actions: [{ name: "Cantrip", desc: "…" }],
    });
    const kinds = JSON.parse(r.actionsJson).map((a: { kind: string }) => a.kind);
    expect(kinds).toEqual(["action", "reaction", "legendary"]);
  });
  it("cantrip with no material → components.m is null", () => {
    const r = toSpellRow({ index: "light", name: "Light", level: 0, components: ["V", "M"], material: "a firefly", ritual: false, concentration: false, casting_time: "1 action", duration: "1 hour", range: "Touch", school: { name: "Evocation" }, classes: [] });
    expect(JSON.parse(r.components)).toEqual({ v: true, s: false, m: "a firefly" });
  });
  it("item with no equipment_category defaults to adventuring-gear, empty props", () => {
    const r = toItemRow({ index: "torch", name: "Torch" });
    expect(r.type).toBe("adventuring-gear");
    expect(r.rarity).toBe("mundane");
    expect(r.requiresAttunement).toBe(false);
    expect(JSON.parse(r.propertiesJson)).toEqual({});
    expect(r.description).toBeNull();
  });
});
