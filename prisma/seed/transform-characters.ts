// File: prisma/seed/transform-characters.ts
// Maps the open SRD 5.1 dataset (5e-bits/5e-database, dnd5eapi shape) into our
// character-reference row shapes. Pure + testable; nested fields → JSON strings.
// Deterministic derived values (proficiency bonus) computed here, not trusted from source.
import { slugify } from "@/lib/reference/srd";
import { profBonusForLevel } from "@/lib/characters/rules";

type Ref = { index?: string; name?: string };
const name = (r?: Ref): string => r?.name ?? "";
const idx = (r?: Ref): string => r?.index ?? slugify(r?.name ?? "");

// Subclass is chosen at this class level (PHB). Source data doesn't expose it cleanly.
export const SUBCLASS_LEVEL: Record<string, number> = {
  cleric: 1, sorcerer: 1, warlock: 1, wizard: 2, druid: 2,
  barbarian: 3, bard: 3, fighter: 3, monk: 3, paladin: 3, ranger: 3, rogue: 3,
};
// Primary ability hint per class (display only).
export const PRIMARY_ABILITY: Record<string, string> = {
  barbarian: "str", fighter: "str", paladin: "str",
  monk: "dex", ranger: "dex", rogue: "dex",
  wizard: "int", cleric: "wis", druid: "wis",
  bard: "cha", sorcerer: "cha", warlock: "cha",
};

// ---------- Class ----------
interface SrcClass {
  index?: string; name: string; hit_die?: number;
  saving_throws?: Ref[]; proficiencies?: Ref[];
  proficiency_choices?: { choose?: number; from?: { options?: { item?: Ref }[] } }[];
  spellcasting?: { spellcasting_ability?: Ref };
  subclasses?: Ref[];
}
export interface ClassRow {
  slug: string; name: string; hitDie: number; primaryAbility: string; savesJson: string;
  armorProfJson: string; weaponProfJson: string; toolProfJson: string; skillChoicesJson: string;
  spellcastingJson: string | null; subclassLevel: number; source: string; license: string;
}
function categorizeProf(profs: Ref[]): { armor: string[]; weapon: string[]; tool: string[] } {
  const armor: string[] = [], weapon: string[] = [], tool: string[] = [];
  for (const p of profs) {
    const n = name(p);
    const low = n.toLowerCase();
    if (low.startsWith("skill:") || low.startsWith("saving throw:")) continue;
    if (low.includes("armor") || low.includes("shield")) armor.push(n);
    else if (low.includes("weapon")) weapon.push(n);
    else if (/tools?|kit|instrument|supplies|vehicles/.test(low)) tool.push(n);
  }
  return { armor, weapon, tool };
}
export function toClassRow(c: SrcClass): ClassRow {
  const slug = c.index ?? slugify(c.name);
  const { armor, weapon, tool } = categorizeProf(c.proficiencies ?? []);
  const choice = c.proficiency_choices?.[0];
  const skillFrom = (choice?.from?.options ?? [])
    .map((o) => name(o.item).replace(/^Skill:\s*/i, ""))
    .filter(Boolean);
  const castAbility = c.spellcasting?.spellcasting_ability?.index ?? null;
  return {
    slug,
    name: c.name,
    hitDie: c.hit_die ?? 8,
    primaryAbility: PRIMARY_ABILITY[slug] ?? "str",
    savesJson: JSON.stringify((c.saving_throws ?? []).map((s) => s.index ?? "").filter(Boolean)),
    armorProfJson: JSON.stringify(armor),
    weaponProfJson: JSON.stringify(weapon),
    toolProfJson: JSON.stringify(tool),
    skillChoicesJson: JSON.stringify({ from: skillFrom, count: choice?.choose ?? 0 }),
    spellcastingJson: castAbility ? JSON.stringify({ ability: castAbility, type: "by-class" }) : null,
    subclassLevel: SUBCLASS_LEVEL[slug] ?? 3,
    source: "SRD 5.1",
    license: "CC-BY-4.0",
  };
}

// ---------- Subclass ----------
interface SrcSubclass {
  index?: string; name: string; class?: Ref; subclass_flavor?: string; desc?: string[];
}
export interface SubclassRow {
  slug: string; classSlug: string; name: string; flavor: string | null;
  description: string | null; featuresByLevelJson: string; source: string; license: string;
}
export function toSubclassRow(
  s: SrcSubclass,
  featuresByLevel: Record<string, string[]> = {},
  opts: { source?: string; license?: string } = {},
): SubclassRow {
  return {
    slug: s.index ?? slugify(s.name),
    classSlug: idx(s.class),
    name: s.name,
    flavor: s.subclass_flavor ?? null,
    description: s.desc && s.desc.length ? s.desc.join("\n\n") : null,
    featuresByLevelJson: JSON.stringify(featuresByLevel),
    source: opts.source ?? "SRD 5.1",
    license: opts.license ?? "CC-BY-4.0",
  };
}

// ---------- ClassLevel ----------
interface SrcLevel {
  level: number; class?: Ref; subclass?: Ref; prof_bonus?: number;
  features?: Ref[]; spellcasting?: Record<string, number>; class_specific?: Record<string, number>;
}
export interface ClassLevelRow {
  classSlug: string; level: number; proficiencyBonus: number;
  featuresJson: string; spellSlotsJson: string; classCountersJson: string; source: string;
}
export function toClassLevelRow(l: SrcLevel): ClassLevelRow {
  const slots: Record<string, number> = {};
  for (let i = 1; i <= 9; i++) {
    const v = l.spellcasting?.[`spell_slots_level_${i}`];
    if (typeof v === "number" && v > 0) slots[String(i)] = v;
  }
  return {
    classSlug: idx(l.class),
    level: l.level,
    proficiencyBonus: profBonusForLevel(l.level), // computed, not trusted from source
    featuresJson: JSON.stringify((l.features ?? []).map((f) => f.index ?? "").filter(Boolean)),
    spellSlotsJson: JSON.stringify(slots),
    classCountersJson: JSON.stringify(l.class_specific ?? {}),
    source: "SRD 5.1",
  };
}

// ---------- Feature ----------
interface SrcFeature {
  index?: string; name: string; class?: Ref; subclass?: Ref; level?: number; desc?: string[];
}
export interface FeatureRow {
  slug: string; name: string; classSlug: string | null; subclassSlug: string | null;
  level: number; description: string; source: string; license: string;
}
export function toFeatureRow(f: SrcFeature): FeatureRow {
  return {
    slug: f.index ?? slugify(f.name),
    name: f.name,
    classSlug: f.class?.index ?? null,
    subclassSlug: f.subclass?.index ?? null,
    level: f.level ?? 1,
    description: (f.desc ?? []).join("\n\n"),
    source: "SRD 5.1",
    license: "CC-BY-4.0",
  };
}

// ---------- Race / Subrace ----------
interface SrcRace {
  index?: string; name: string; speed?: number; size?: string;
  ability_bonuses?: { ability_score?: Ref; bonus?: number }[];
  race?: Ref; traits?: Ref[]; starting_proficiencies?: Ref[]; languages?: Ref[];
}
export interface RaceRow {
  slug: string; name: string; parentRaceSlug: string | null; abilityBonusesJson: string;
  size: string; speed: number; traitsJson: string; proficienciesJson: string;
  languagesJson: string; source: string; license: string;
}
function abilityBonuses(src?: { ability_score?: Ref; bonus?: number }[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const b of src ?? []) {
    const k = b.ability_score?.index;
    if (k) out[k] = b.bonus ?? 0;
  }
  return out;
}
export function toRaceRow(r: SrcRace, isSubrace = false): RaceRow {
  return {
    slug: r.index ?? slugify(r.name),
    name: r.name,
    parentRaceSlug: isSubrace ? idx(r.race) : null,
    abilityBonusesJson: JSON.stringify(abilityBonuses(r.ability_bonuses)),
    size: r.size ?? "Medium",
    speed: r.speed ?? 0, // subraces inherit the parent's speed (0 = inherit)
    traitsJson: JSON.stringify((r.traits ?? []).map((t) => ({ name: name(t) }))),
    proficienciesJson: JSON.stringify((r.starting_proficiencies ?? []).map((p) => name(p))),
    languagesJson: JSON.stringify((r.languages ?? []).map((l) => name(l))),
    source: "SRD 5.1",
    license: "CC-BY-4.0",
  };
}

// ---------- Background ----------
interface SrcBackground {
  index?: string; name: string;
  starting_proficiencies?: Ref[]; language_options?: { choose?: number };
  feature?: { name?: string; desc?: string[] }; starting_equipment?: { equipment?: Ref }[];
}
export interface BackgroundRow {
  slug: string; name: string; skillProficienciesJson: string; toolProficienciesJson: string;
  languagesJson: string; featureJson: string; startingEquipment: string | null; source: string; license: string;
}
export function toBackgroundRow(b: SrcBackground): BackgroundRow {
  const skills: string[] = [], tools: string[] = [];
  for (const p of b.starting_proficiencies ?? []) {
    const n = name(p);
    if (/^skill:/i.test(n)) skills.push(n.replace(/^Skill:\s*/i, ""));
    else tools.push(n);
  }
  const equip = (b.starting_equipment ?? []).map((e) => name(e.equipment)).filter(Boolean).join(", ");
  return {
    slug: b.index ?? slugify(b.name),
    name: b.name,
    skillProficienciesJson: JSON.stringify(skills),
    toolProficienciesJson: JSON.stringify(tools),
    languagesJson: JSON.stringify(b.language_options?.choose ? [`${b.language_options.choose} of your choice`] : []),
    featureJson: JSON.stringify({ name: b.feature?.name ?? "", desc: (b.feature?.desc ?? []).join("\n\n") }),
    startingEquipment: equip || null,
    source: "SRD 5.1",
    license: "CC-BY-4.0",
  };
}
