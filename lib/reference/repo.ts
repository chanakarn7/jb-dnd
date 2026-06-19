// Reference repository — the ONLY place that touches Prisma for reference data.
// Parses JSON columns into typed objects and caches each kind's full list in
// module memory (data is static after seed; single local host → safe).
// Route handlers call this, never Prisma directly. See SA_BLUEPRINT §4.3.
import { prisma } from "@/lib/db";
import { parseJson } from "./parse";
import type {
  SpellListItem, SpellDetail,
  MonsterListItem, MonsterDetail,
  ItemListItem, ItemDetail,
} from "./types";

// ---------- in-memory cache ----------
let spellCache: SpellDetail[] | null = null;
let monsterCache: MonsterDetail[] | null = null;
let itemCache: ItemDetail[] | null = null;

// ---------- mappers (DB row → typed detail) ----------
function mapSpell(r: {
  slug: string; name: string; level: number; school: string; castingTime: string; range: string;
  duration: string; components: string; ritual: boolean; concentration: boolean; description: string;
  higherLevels: string | null; classesJson: string; source: string;
}): SpellDetail {
  return {
    slug: r.slug, name: r.name, level: r.level, school: r.school, castingTime: r.castingTime,
    range: r.range, duration: r.duration, ritual: r.ritual, concentration: r.concentration,
    components: parseJson(r.components, { v: false, s: false, m: null }),
    description: r.description, higherLevels: r.higherLevels,
    classes: parseJson<string[]>(r.classesJson, []), source: r.source,
  };
}
function mapMonster(r: {
  slug: string; name: string; size: string; type: string; alignment: string; cr: string; crSort: number;
  xp: number; ac: number; acNote: string | null; hp: number; hpFormula: string | null; speed: string;
  abilityScores: string; savesJson: string; skillsJson: string; senses: string | null; languages: string | null;
  immunitiesJson: string; resistancesJson: string; traitsJson: string; actionsJson: string; source: string;
}): MonsterDetail {
  return {
    slug: r.slug, name: r.name, size: r.size, type: r.type, alignment: r.alignment, cr: r.cr, crSort: r.crSort,
    xp: r.xp, ac: r.ac, acNote: r.acNote, hp: r.hp, hpFormula: r.hpFormula, speed: r.speed,
    abilityScores: parseJson(r.abilityScores, { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }),
    saves: parseJson(r.savesJson, {}), skills: parseJson(r.skillsJson, {}),
    senses: r.senses, languages: r.languages,
    immunities: parseJson(r.immunitiesJson, { damage: [], condition: [] }),
    resistances: parseJson<string[]>(r.resistancesJson, []),
    traits: parseJson(r.traitsJson, []),
    actions: parseJson(r.actionsJson, []),
    source: r.source,
  };
}
function mapItem(r: {
  slug: string; name: string; type: string; rarity: string; requiresAttunement: boolean;
  propertiesJson: string; description: string | null; source: string;
}): ItemDetail {
  return {
    slug: r.slug, name: r.name, type: r.type, rarity: r.rarity, requiresAttunement: r.requiresAttunement,
    properties: parseJson(r.propertiesJson, {}), description: r.description, source: r.source,
  };
}

// ---------- loaders (cached) ----------
async function allSpells(): Promise<SpellDetail[]> {
  if (!spellCache) spellCache = (await prisma.spell.findMany({ orderBy: [{ level: "asc" }, { name: "asc" }] })).map(mapSpell);
  return spellCache;
}
async function allMonsters(): Promise<MonsterDetail[]> {
  if (!monsterCache) monsterCache = (await prisma.monster.findMany({ orderBy: [{ crSort: "asc" }, { name: "asc" }] })).map(mapMonster);
  return monsterCache;
}
async function allItems(): Promise<ItemDetail[]> {
  if (!itemCache) itemCache = (await prisma.item.findMany({ orderBy: [{ name: "asc" }] })).map(mapItem);
  return itemCache;
}

// ---------- public API ----------
export async function getSpells(): Promise<SpellListItem[]> {
  return (await allSpells()).map((s) => ({
    slug: s.slug, name: s.name, level: s.level, school: s.school,
    castingTime: s.castingTime, ritual: s.ritual, concentration: s.concentration, classes: s.classes,
  }));
}
export async function getSpell(slug: string): Promise<SpellDetail | null> {
  return (await allSpells()).find((s) => s.slug === slug) ?? null;
}
export async function getMonsters(): Promise<MonsterListItem[]> {
  return (await allMonsters()).map((m) => ({
    slug: m.slug, name: m.name, cr: m.cr, crSort: m.crSort, type: m.type, size: m.size, hp: m.hp, ac: m.ac,
  }));
}
export async function getMonster(slug: string): Promise<MonsterDetail | null> {
  return (await allMonsters()).find((m) => m.slug === slug) ?? null;
}
export async function getItems(): Promise<ItemListItem[]> {
  return (await allItems()).map((i) => ({
    slug: i.slug, name: i.name, type: i.type, rarity: i.rarity, requiresAttunement: i.requiresAttunement,
  }));
}
export async function getItem(slug: string): Promise<ItemDetail | null> {
  return (await allItems()).find((i) => i.slug === slug) ?? null;
}
