// File: lib/characters/service.ts
// Orchestrates refRepo + charRepo + rules into create/update/derive. Owns the
// auto-fill (defaults), the override model (overridesJson), the 1:1 claim, and the
// CharacterDetail/list response shape. Authz is enforced here + at the route.
import { prisma } from "@/lib/db";
import { parseJson } from "@/lib/reference/parse";
import * as ref from "./refRepo";
import * as repo from "./charRepo";
import {
  abilityMod, profBonusForLevel, maxHpFor, spellSlotsFor, effectiveAbilities,
  derivedSaves, derivedSkills, featuresFor, clampLevel, clampHp,
  type Abilities, type AbilityKey, type FeatureView,
} from "./rules";
import type { CharacterRow } from "./charRepo";
import type {
  CharacterDetail, CharacterListItem, CreateCharacterInput, UpdateCharacterInput,
} from "./types";

const ABILS: AbilityKey[] = ["str", "dex", "con", "int", "wis", "cha"];
// Derived scalar fields that can be individually overridden (kept across recompute).
const OVERRIDABLE = ["proficiencyBonus", "maxHp", "ac", "speed", "initiative"] as const;

export interface Session { sessionId: string; campaignId: string; role: "dm" | "player" }

export function canWrite(c: { campaignId: string; ownerSessionId: string | null }, s: Session): boolean {
  return c.campaignId === s.campaignId && (s.role === "dm" || c.ownerSessionId === s.sessionId);
}

interface Refs {
  cls: NonNullable<Awaited<ReturnType<typeof ref.getClass>>>;
  race: NonNullable<Awaited<ReturnType<typeof ref.getRace>>>;
  subrace: Awaited<ReturnType<typeof ref.getRace>>;
  subclass: Awaited<ReturnType<typeof ref.getSubclass>>;
  background: Awaited<ReturnType<typeof ref.getBackground>>;
  featureMap: Awaited<ReturnType<typeof ref.getFeatureMap>>;
}

async function loadRefs(c: {
  classSlug: string; raceSlug: string; subraceSlug: string | null;
  subclassSlug: string | null; backgroundSlug: string | null;
}): Promise<Refs | null> {
  const cls = await ref.getClass(c.classSlug);
  const picked = await ref.getRace(c.raceSlug);
  if (!cls || !picked) return null; // class + race are required and must exist

  // If the chosen "race" is actually a subrace (the UI lists both flat), resolve its
  // parent as the BASE race and treat the pick as the subrace — so base ability bonuses,
  // speed, and traits all apply, not just the subrace's delta. (QA fix, Sprint 2.)
  let race = picked;
  let subrace = c.subraceSlug ? await ref.getRace(c.subraceSlug) : null;
  if (picked.parentRaceSlug) {
    const parent = await ref.getRace(picked.parentRaceSlug);
    if (parent) { race = parent; subrace = picked; }
  }

  return {
    cls, race, subrace,
    subclass: c.subclassSlug ? await ref.getSubclass(c.subclassSlug) : null,
    background: c.backgroundSlug ? await ref.getBackground(c.backgroundSlug) : null,
    featureMap: await ref.getFeatureMap(),
  };
}

// The single source of auto-fill truth. Computes everything from refs + abilities + level.
function computeDerived(refs: Refs, abilities: Abilities, level: number, chosenSkills: string[]) {
  const lv = clampLevel(level);
  const conMod = abilityMod(abilities.con);
  const dexMod = abilityMod(abilities.dex);
  const profBonus = profBonusForLevel(lv);
  const speed = refs.race.speed || 30;
  const proficientSkills = [...chosenSkills, ...(refs.background?.skillProficiencies ?? [])];
  const classLevel = refs.cls.levels.find((l) => l.level === lv);

  const saves = derivedSaves(refs.cls.saves, abilities, profBonus);
  const skills = derivedSkills(proficientSkills, abilities, profBonus);
  const spellSlots = refs.cls.isCaster ? spellSlotsFor(JSON.stringify(classLevel?.spellSlots ?? {})) : null;

  const features = computeFeatures(refs, lv);

  return {
    proficiencyBonus: profBonus,
    maxHp: maxHpFor(refs.cls.hitDie, lv, conMod),
    ac: 10 + dexMod,
    speed,
    initiative: dexMod,
    savesProf: Object.fromEntries(ABILS.map((a) => [a, saves[a].proficient])),
    skillsProf: Object.fromEntries(Object.entries(skills).filter(([, v]) => v.proficient).map(([k]) => [k, true])),
    spellSlots,
    saves, skills, features,
  };
}

function computeFeatures(refs: Refs, level: number): FeatureView[] {
  const resolve = (slug: string, source: FeatureView["source"], fallbackLevel: number): FeatureView | null => {
    const f = refs.featureMap.get(slug);
    if (!f) return null;
    return { name: f.name, level: f.level || fallbackLevel, source, desc: f.desc };
  };
  const classFeatures: FeatureView[] = refs.cls.levels.flatMap((l) =>
    l.features.map((slug) => resolve(slug, "class", l.level)).filter((x): x is FeatureView => !!x),
  );
  const subclassFeatures: FeatureView[] = refs.subclass
    ? Object.entries(refs.subclass.featuresByLevel).flatMap(([lvl, slugs]) =>
        slugs.map((slug) => {
          const f = refs.featureMap.get(slug);
          return f
            ? { name: f.name, level: Number(lvl) || f.level, source: "subclass" as const, desc: f.desc }
            : { name: slug, level: Number(lvl) || 1, source: "subclass" as const, desc: "" };
        }),
      )
    : [];
  const raceFeatures: FeatureView[] = [...refs.race.traits, ...(refs.subrace?.traits ?? [])]
    .map((t) => ({ name: t.name, level: 1, source: "race" as const, desc: "" }));
  const backgroundFeatures: FeatureView[] = refs.background?.feature?.name
    ? [{ name: refs.background.feature.name, level: 1, source: "background", desc: refs.background.feature.desc }]
    : [];
  return featuresFor({ classFeatures, subclassFeatures, raceFeatures, backgroundFeatures, level });
}

// ── Create ──────────────────────────────────────────────────────────
export async function createCharacter(session: Session, input: CreateCharacterInput): Promise<CharacterDetail | { error: string }> {
  const isNpc = session.role === "dm" && !!input.isNpc;
  const refs = await loadRefs({
    classSlug: input.classSlug, raceSlug: input.raceSlug, subraceSlug: input.subraceSlug ?? null,
    subclassSlug: input.subclassSlug ?? null, backgroundSlug: input.backgroundSlug ?? null,
  });
  if (!refs) return { error: "invalid_reference" };

  const level = clampLevel(input.level ?? 1);
  const abilities = effectiveAbilities(input.baseAbilities, refs.race.abilityBonuses, refs.subrace?.abilityBonuses ?? {});
  const d = computeDerived(refs, abilities, level, input.skills ?? []);

  const data = {
    campaignId: session.campaignId,
    ownerSessionId: isNpc ? null : session.sessionId,
    isNpc,
    name: input.name,
    raceSlug: input.raceSlug, subraceSlug: input.subraceSlug ?? null, classSlug: input.classSlug,
    subclassSlug: input.subclassSlug ?? null, backgroundSlug: input.backgroundSlug ?? null,
    level,
    str: abilities.str, dex: abilities.dex, con: abilities.con, int: abilities.int, wis: abilities.wis, cha: abilities.cha,
    abilityMethod: input.abilityMethod,
    baseAbilitiesJson: JSON.stringify(input.baseAbilities),
    proficiencyBonus: d.proficiencyBonus, maxHp: d.maxHp, currentHp: d.maxHp, tempHp: 0,
    ac: d.ac, speed: d.speed, initiative: d.initiative,
    savesJson: JSON.stringify(d.savesProf), skillsJson: JSON.stringify(d.skillsProf),
    spellSlotsJson: JSON.stringify(d.spellSlots ?? {}),
    overridesJson: "[]",
  };

  const created = await prisma.$transaction(async (tx) => {
    const c = await tx.character.create({ data, include: { spells: true } });
    if (!isNpc) await tx.playerSession.update({ where: { id: session.sessionId }, data: { characterId: c.id } });
    return c;
  });
  return toDetail(created, session, refs);
}

// ── Update (override + recompute) ───────────────────────────────────
export async function updateCharacter(existing: CharacterRow, session: Session, input: UpdateCharacterInput): Promise<CharacterDetail | { error: string }> {
  const overrides = new Set(parseJson<string[]>(existing.overridesJson, []));

  // 1) Direct edits to overridable derived fields → record as overrides.
  for (const field of OVERRIDABLE) {
    if (input[field] !== undefined) overrides.add(field);
  }
  // 2) reset-to-auto clears overrides for the named fields.
  for (const field of input.resetAuto ?? []) overrides.delete(field);

  // 3) Build the next ability/level/skill state.
  const abilities: Abilities = {
    str: input.str ?? existing.str, dex: input.dex ?? existing.dex, con: input.con ?? existing.con,
    int: input.int ?? existing.int, wis: input.wis ?? existing.wis, cha: input.cha ?? existing.cha,
  };
  const level = clampLevel(input.level ?? existing.level);
  const subclassSlug = input.subclassSlug !== undefined ? input.subclassSlug : existing.subclassSlug;
  const chosenSkills = input.skills ?? Object.keys(parseJson<Record<string, boolean>>(existing.skillsJson, {}));

  const refs = await loadRefs({
    classSlug: existing.classSlug, raceSlug: existing.raceSlug, subraceSlug: existing.subraceSlug,
    subclassSlug, backgroundSlug: existing.backgroundSlug,
  });
  if (!refs) return { error: "invalid_reference" };
  const d = computeDerived(refs, abilities, level, chosenSkills);

  // 4) Apply: overridden fields keep the user value (explicit input or existing); else use computed.
  const pick = (field: (typeof OVERRIDABLE)[number], computed: number): number =>
    overrides.has(field) ? (input[field] ?? (existing[field] as number)) : computed;

  const maxHp = pick("maxHp", d.maxHp);
  const tempHp = input.tempHp ?? existing.tempHp;
  const currentHp = clampHp(input.currentHp ?? existing.currentHp, maxHp, tempHp);

  const updated = await repo.update(existing.id, {
    name: input.name ?? existing.name,
    level, subclassSlug,
    str: abilities.str, dex: abilities.dex, con: abilities.con, int: abilities.int, wis: abilities.wis, cha: abilities.cha,
    proficiencyBonus: pick("proficiencyBonus", d.proficiencyBonus),
    maxHp, currentHp, tempHp,
    ac: pick("ac", d.ac), speed: pick("speed", d.speed), initiative: pick("initiative", d.initiative),
    savesJson: JSON.stringify(d.savesProf), skillsJson: JSON.stringify(d.skillsProf),
    spellSlotsJson: JSON.stringify(d.spellSlots ?? {}),
    notes: input.notes !== undefined ? input.notes : existing.notes,
    overridesJson: JSON.stringify([...overrides]),
  });
  return toDetail(updated, session, refs);
}

// ── Spells (known/prepared) ─────────────────────────────────────────
export async function manageSpell(existing: CharacterRow, session: Session, action: string, spellSlug: string): Promise<CharacterDetail | { error: string }> {
  if (!spellSlug) return { error: "missing_spell" };
  if (action === "add") await repo.addSpell(existing.campaignId, existing.id, spellSlug);
  else if (action === "remove") await repo.removeSpell(existing.id, spellSlug);
  else if (action === "prepare") await repo.setPrepared(existing.id, spellSlug, true);
  else if (action === "unprepare") await repo.setPrepared(existing.id, spellSlug, false);
  else return { error: "bad_action" };
  const fresh = await repo.findInCampaign(existing.campaignId, existing.id);
  return fresh ? toDetail(fresh, session) : { error: "not_found" };
}

// ── Response shaping ────────────────────────────────────────────────
export async function toDetail(c: CharacterRow, session: Session, preRefs?: Refs): Promise<CharacterDetail> {
  const refs = preRefs ?? await loadRefs(c);
  const abilities: Abilities = { str: c.str, dex: c.dex, con: c.con, int: c.int, wis: c.wis, cha: c.cha };
  const abilityMods = Object.fromEntries(ABILS.map((a) => [a, abilityMod(abilities[a])])) as Abilities;

  const saves = derivedSaves(refs?.cls.saves ?? [], abilities, c.proficiencyBonus);
  const skillsProf = Object.keys(parseJson<Record<string, boolean>>(c.skillsJson, {}));
  const skills = derivedSkills(skillsProf, abilities, c.proficiencyBonus);
  const slots = parseJson<Record<string, number>>(c.spellSlotsJson, {});
  const isCaster = refs?.cls.isCaster ?? Object.keys(slots).length > 0;

  // Resolve real spell name/level for the character's known/prepared list.
  const spellMeta = c.spells.length
    ? new Map(
        (await prisma.spell.findMany({
          where: { slug: { in: c.spells.map((s) => s.spellSlug) } },
          select: { slug: true, name: true, level: true },
        })).map((s) => [s.slug, s]),
      )
    : new Map<string, { slug: string; name: string; level: number }>();

  return {
    ...toListItem(c, session, refs),
    campaignId: c.campaignId,
    raceSlug: c.raceSlug, subraceSlug: c.subraceSlug, classSlug: c.classSlug,
    subclassSlug: c.subclassSlug, backgroundSlug: c.backgroundSlug,
    abilities, abilityMods, abilityMethod: c.abilityMethod,
    proficiencyBonus: c.proficiencyBonus, tempHp: c.tempHp, speed: c.speed, initiative: c.initiative,
    saves, skills,
    spellSlots: isCaster ? slots : null,
    features: refs ? computeFeatures(refs, c.level) : [],
    spells: c.spells
      .map((s) => ({ slug: s.spellSlug, name: spellMeta.get(s.spellSlug)?.name ?? s.spellSlug, level: spellMeta.get(s.spellSlug)?.level ?? 0, known: s.known, prepared: s.prepared }))
      .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name)),
    conditions: parseJson<string[]>(c.conditionsJson, []),
    overrides: parseJson<string[]>(c.overridesJson, []),
    notes: c.notes,
  };
}

export function toListItem(c: CharacterRow, session: Session, refs?: Refs | null): CharacterListItem {
  return {
    id: c.id, name: c.name, isNpc: c.isNpc, ownedByMe: c.ownerSessionId === session.sessionId,
    raceName: refs?.subrace?.name ?? refs?.race.name ?? c.raceSlug,
    className: refs?.cls.name ?? c.classSlug,
    subclassName: refs?.subclass?.name ?? c.subclassSlug,
    level: c.level, currentHp: c.currentHp, maxHp: c.maxHp, ac: c.ac,
  };
}

export async function listForCampaign(session: Session): Promise<CharacterListItem[]> {
  const rows = await repo.listByCampaign(session.campaignId);
  return Promise.all(rows.map(async (c) => toListItem(c, session, await loadRefs(c))));
}
