// File: lib/characters/refRepo.ts
// Read layer for the GLOBAL character-reference tables. Static after seed, so each
// kind is queried once and cached in-module (mirrors lib/reference/repo.ts). Parses
// JSON columns into typed objects. Route handlers + service call this, never Prisma directly.
import { prisma } from "@/lib/db";
import { parseJson } from "@/lib/reference/parse";
import type {
  ClassListItem, ClassDetail, SubclassListItem, SubclassDetail,
  RaceListItem, RaceDetail, BackgroundListItem, BackgroundDetail,
} from "./types";
import type { AbilityKey } from "./rules";

type Cache<T> = T[] | undefined;
let classCache: Cache<ClassDetail>;
let subclassCache: Cache<SubclassDetail>;
let raceCache: Cache<RaceDetail>;
let bgCache: Cache<BackgroundDetail>;

export interface FeatureRef { slug: string; name: string; level: number; desc: string }
let featureMapCache: Map<string, FeatureRef> | undefined;

// Allow tests to reset the module cache between cases.
export function __resetRefCache() {
  classCache = subclassCache = raceCache = bgCache = undefined;
  featureMapCache = undefined;
}

export async function getFeatureMap(): Promise<Map<string, FeatureRef>> {
  if (featureMapCache) return featureMapCache;
  const rows = await prisma.feature.findMany();
  featureMapCache = new Map(rows.map((f) => [f.slug, { slug: f.slug, name: f.name, level: f.level, desc: f.description }]));
  return featureMapCache;
}

async function loadClasses(): Promise<ClassDetail[]> {
  if (classCache) return classCache;
  const [classes, levels] = await Promise.all([
    prisma.class.findMany({ orderBy: { name: "asc" } }),
    prisma.classLevel.findMany({ orderBy: [{ classSlug: "asc" }, { level: "asc" }] }),
  ]);
  const byClass = new Map<string, typeof levels>();
  for (const l of levels) (byClass.get(l.classSlug) ?? byClass.set(l.classSlug, []).get(l.classSlug)!).push(l);
  classCache = classes.map((c) => ({
    slug: c.slug, name: c.name, hitDie: c.hitDie, primaryAbility: c.primaryAbility,
    isCaster: c.spellcastingJson != null, subclassLevel: c.subclassLevel,
    saves: parseJson<AbilityKey[]>(c.savesJson, []),
    armorProf: parseJson<string[]>(c.armorProfJson, []),
    weaponProf: parseJson<string[]>(c.weaponProfJson, []),
    toolProf: parseJson<string[]>(c.toolProfJson, []),
    skillChoices: parseJson<{ from: string[]; count: number }>(c.skillChoicesJson, { from: [], count: 0 }),
    spellcasting: c.spellcastingJson ? parseJson<{ ability: string; type: string }>(c.spellcastingJson, null as never) : null,
    levels: (byClass.get(c.slug) ?? []).map((l) => ({
      level: l.level, proficiencyBonus: l.proficiencyBonus,
      features: parseJson<string[]>(l.featuresJson, []),
      spellSlots: parseJson<Record<string, number>>(l.spellSlotsJson, {}),
      counters: parseJson<Record<string, number>>(l.classCountersJson, {}),
    })),
  }));
  return classCache;
}

async function loadSubclasses(): Promise<SubclassDetail[]> {
  if (subclassCache) return subclassCache;
  const rows = await prisma.subclass.findMany({ orderBy: { name: "asc" } });
  subclassCache = rows.map((s) => ({
    slug: s.slug, classSlug: s.classSlug, name: s.name, flavor: s.flavor,
    source: s.source, license: s.license, description: s.description,
    featuresByLevel: parseJson<Record<string, string[]>>(s.featuresByLevelJson, {}),
  }));
  return subclassCache;
}

async function loadRaces(): Promise<RaceDetail[]> {
  if (raceCache) return raceCache;
  const rows = await prisma.race.findMany({ orderBy: { name: "asc" } });
  raceCache = rows.map((r) => ({
    slug: r.slug, name: r.name, parentRaceSlug: r.parentRaceSlug, size: r.size, speed: r.speed,
    abilityBonuses: parseJson<Record<string, number>>(r.abilityBonusesJson, {}),
    traits: parseJson<{ name: string }[]>(r.traitsJson, []),
    proficiencies: parseJson<string[]>(r.proficienciesJson, []),
    languages: parseJson<string[]>(r.languagesJson, []),
  }));
  return raceCache;
}

async function loadBackgrounds(): Promise<BackgroundDetail[]> {
  if (bgCache) return bgCache;
  const rows = await prisma.background.findMany({ orderBy: { name: "asc" } });
  bgCache = rows.map((b) => ({
    slug: b.slug, name: b.name,
    skillProficiencies: parseJson<string[]>(b.skillProficienciesJson, []),
    toolProficiencies: parseJson<string[]>(b.toolProficienciesJson, []),
    languages: parseJson<string[]>(b.languagesJson, []),
    feature: parseJson<{ name: string; desc: string }>(b.featureJson, { name: "", desc: "" }),
    startingEquipment: b.startingEquipment,
  }));
  return bgCache;
}

const lean = (c: ClassDetail): ClassListItem => ({
  slug: c.slug, name: c.name, hitDie: c.hitDie, primaryAbility: c.primaryAbility,
  isCaster: c.isCaster, subclassLevel: c.subclassLevel,
});
const subLean = (s: SubclassDetail): SubclassListItem => ({
  slug: s.slug, classSlug: s.classSlug, name: s.name, flavor: s.flavor, source: s.source, license: s.license,
});
const raceLean = (r: RaceDetail): RaceListItem => ({
  slug: r.slug, name: r.name, parentRaceSlug: r.parentRaceSlug, size: r.size, speed: r.speed,
});

export async function getClasses(): Promise<ClassListItem[]> { return (await loadClasses()).map(lean); }
export async function getClass(slug: string): Promise<ClassDetail | null> {
  return (await loadClasses()).find((c) => c.slug === slug) ?? null;
}
export async function getSubclasses(classSlug?: string): Promise<SubclassListItem[]> {
  const all = await loadSubclasses();
  return (classSlug ? all.filter((s) => s.classSlug === classSlug) : all).map(subLean);
}
export async function getSubclass(slug: string): Promise<SubclassDetail | null> {
  return (await loadSubclasses()).find((s) => s.slug === slug) ?? null;
}
export async function getRaces(): Promise<RaceListItem[]> { return (await loadRaces()).map(raceLean); }
export async function getRace(slug: string): Promise<RaceDetail | null> {
  return (await loadRaces()).find((r) => r.slug === slug) ?? null;
}
export async function getBackgrounds(): Promise<BackgroundListItem[]> {
  return (await loadBackgrounds()).map((b) => ({ slug: b.slug, name: b.name }));
}
export async function getBackground(slug: string): Promise<BackgroundDetail | null> {
  return (await loadBackgrounds()).find((b) => b.slug === slug) ?? null;
}
