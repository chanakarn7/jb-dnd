import { describe, it, expect } from "vitest";
import { filterSpells, filterMonsters, filterItems } from "@/lib/reference/filter";
import type { SpellListItem, MonsterListItem, ItemListItem } from "@/lib/reference/types";

const spells: SpellListItem[] = [
  { slug: "fireball", name: "Fireball", level: 3, school: "Evocation", castingTime: "1 action", ritual: false, concentration: false, classes: ["Sorcerer", "Wizard"] },
  { slug: "fire-bolt", name: "Fire Bolt", level: 0, school: "Evocation", castingTime: "1 action", ritual: false, concentration: false, classes: ["Wizard"] },
  { slug: "detect-magic", name: "Detect Magic", level: 1, school: "Divination", castingTime: "1 action", ritual: true, concentration: true, classes: ["Cleric", "Wizard"] },
];

describe("filterSpells", () => {
  it("matches name case-insensitively (plain substring, not regex)", () => {
    expect(filterSpells(spells, { q: "fire" }).map((s) => s.slug)).toEqual(["fireball", "fire-bolt"]);
    expect(filterSpells(spells, { q: "(" })).toEqual([]); // regex-special char treated literally, no throw
  });
  it("filters by level (string from <select>), school, class, and toggles, ANDed", () => {
    expect(filterSpells(spells, { level: "0" }).map((s) => s.slug)).toEqual(["fire-bolt"]);
    expect(filterSpells(spells, { school: "Divination" }).map((s) => s.slug)).toEqual(["detect-magic"]);
    expect(filterSpells(spells, { klass: "Sorcerer" }).map((s) => s.slug)).toEqual(["fireball"]);
    expect(filterSpells(spells, { ritual: true }).map((s) => s.slug)).toEqual(["detect-magic"]);
    expect(filterSpells(spells, { concentration: true, q: "fire" })).toEqual([]);
  });
  it("treats empty/undefined filters as no-ops", () => {
    expect(filterSpells(spells, { q: "", level: "", school: "" })).toHaveLength(3);
    expect(filterSpells(spells, {})).toHaveLength(3);
  });
});

const monsters: MonsterListItem[] = [
  { slug: "goblin", name: "Goblin", cr: "1/4", crSort: 0.25, type: "humanoid", size: "Small", hp: 7, ac: 15 },
  { slug: "owlbear", name: "Owlbear", cr: "3", crSort: 3, type: "monstrosity", size: "Large", hp: 59, ac: 13 },
  { slug: "adult-red-dragon", name: "Adult Red Dragon", cr: "17", crSort: 17, type: "dragon", size: "Huge", hp: 256, ac: 19 },
];

describe("filterMonsters", () => {
  it("filters by type, size, and CR max (numeric range)", () => {
    expect(filterMonsters(monsters, { type: "dragon" }).map((m) => m.slug)).toEqual(["adult-red-dragon"]);
    expect(filterMonsters(monsters, { size: "Small" }).map((m) => m.slug)).toEqual(["goblin"]);
    expect(filterMonsters(monsters, { crMax: 3 }).map((m) => m.slug)).toEqual(["goblin", "owlbear"]);
  });
  it("matches name and ANDs filters", () => {
    expect(filterMonsters(monsters, { q: "dragon", crMax: 5 })).toEqual([]);
  });
});

const items: ItemListItem[] = [
  { slug: "longsword", name: "Longsword", type: "weapon", rarity: "mundane", requiresAttunement: false },
  { slug: "flame-tongue", name: "Flame Tongue", type: "weapon", rarity: "rare", requiresAttunement: true },
  { slug: "potion-of-healing", name: "Potion of Healing", type: "potion", rarity: "common", requiresAttunement: false },
];

describe("filterItems", () => {
  it("filters by type, rarity, and attunement toggle", () => {
    expect(filterItems(items, { type: "weapon" }).map((i) => i.slug)).toEqual(["longsword", "flame-tongue"]);
    expect(filterItems(items, { rarity: "rare" }).map((i) => i.slug)).toEqual(["flame-tongue"]);
    expect(filterItems(items, { attune: true }).map((i) => i.slug)).toEqual(["flame-tongue"]);
  });
});
