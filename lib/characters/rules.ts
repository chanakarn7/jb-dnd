// File: lib/characters/rules.ts
// Deterministic 5e character math — PURE, no DB, no side effects (ARCHITECTURE:
// "rules math is code, never guessed"). Drives auto-fill on the sheet/wizard.
// Unit-tested against PHB tables. See docs/modules/characters/SA_BLUEPRINT.md §4.
import { parseJson } from "@/lib/reference/parse";
import { SKILL_ABILITY, type AbilityKey, ABILITY_KEYS } from "./glossary";

export type { AbilityKey };
export type Abilities = Record<AbilityKey, number>;

export const clampLevel = (level: number): number => Math.max(1, Math.min(20, Math.floor(level)));

// Ability score -> integer modifier: floor((score - 10) / 2).
export const abilityMod = (score: number): number => Math.floor((score - 10) / 2);

// Proficiency bonus by level: +2 (1-4), +3 (5-8), +4 (9-12), +5 (13-16), +6 (17-20).
export const profBonusForLevel = (level: number): number => 2 + Math.floor((clampLevel(level) - 1) / 4);

// Average roll of a dN, rounded up the 5e way: floor(N/2)+1 (d6→4, d8→5, d10→6, d12→7).
export const avgDie = (die: number): number => Math.floor(die / 2) + 1;

// Max HP: level 1 = max hit die + CON mod; each level after = avg(hitDie) + CON mod.
// Never below 1 (a level-1 character with negative CON still has ≥1 HP).
export function maxHpFor(hitDie: number, level: number, conMod: number): number {
  const lv = clampLevel(level);
  const first = hitDie + conMod;
  const rest = (lv - 1) * (avgDie(hitDie) + conMod);
  return Math.max(1, first + rest);
}

// ── Ability-score generation ────────────────────────────────────────
export const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8];

// Valid iff the 6 assigned values are exactly the standard array as a multiset.
export function validateStandardArray(assigned: number[]): boolean {
  if (assigned.length !== 6) return false;
  const a = [...assigned].sort((x, y) => x - y);
  const b = [...STANDARD_ARRAY].sort((x, y) => x - y);
  return a.every((v, i) => v === b[i]);
}

// Point-buy cost (PHB): 8-13 = score-8 (1/pt), 14 = 7, 15 = 9. Outside 8-15 = Infinity (invalid).
export function pointBuyCost(score: number): number {
  if (score < 8 || score > 15) return Infinity;
  if (score <= 13) return score - 8;
  return score === 14 ? 7 : 9;
}

// Valid iff every score is in 8-15 and total cost ≤ budget (default 27).
export function validatePointBuy(assigned: number[], budget = 27): boolean {
  if (assigned.length !== 6) return false;
  const total = assigned.reduce((t, s) => t + pointBuyCost(s), 0);
  return Number.isFinite(total) && total <= budget;
}

export function totalPointBuyCost(assigned: number[]): number {
  return assigned.reduce((t, s) => t + pointBuyCost(s), 0);
}

// ── Effective abilities (assigned + racial bonuses) ─────────────────
export function effectiveAbilities(
  base: Partial<Abilities>,
  raceBonus: Partial<Abilities> = {},
  subraceBonus: Partial<Abilities> = {},
): Abilities {
  const out = {} as Abilities;
  for (const k of ABILITY_KEYS) {
    out[k] = (base[k] ?? 0) + (raceBonus[k] ?? 0) + (subraceBonus[k] ?? 0);
  }
  return out;
}

// ── Spell slots ─────────────────────────────────────────────────────
// Caster only — parse the ClassLevel.spellSlotsJson; non-caster / malformed → {}.
export function spellSlotsFor(spellSlotsJson: string | null | undefined): Record<string, number> {
  const parsed = parseJson<Record<string, number>>(spellSlotsJson, {});
  // Drop empty/zero-only slot maps so the UI can hide the section cleanly.
  const entries = Object.entries(parsed).filter(([, v]) => typeof v === "number" && v > 0);
  return Object.fromEntries(entries);
}

// ── Derived saves & skills ──────────────────────────────────────────
export interface DerivedStat {
  proficient: boolean;
  mod: number;
}

// Saving throws: ability mod (+ prof bonus if the class is proficient in that save).
export function derivedSaves(
  classSaves: string[],
  abilities: Abilities,
  profBonus: number,
): Record<AbilityKey, DerivedStat> {
  const prof = new Set(classSaves.map((s) => s.toLowerCase()));
  const out = {} as Record<AbilityKey, DerivedStat>;
  for (const k of ABILITY_KEYS) {
    const proficient = prof.has(k);
    out[k] = { proficient, mod: abilityMod(abilities[k]) + (proficient ? profBonus : 0) };
  }
  return out;
}

// Skills: ability mod of the governing ability (+ prof bonus if proficient).
export function derivedSkills(
  proficientSkills: string[],
  abilities: Abilities,
  profBonus: number,
): Record<string, DerivedStat> {
  const prof = new Set(proficientSkills);
  const out: Record<string, DerivedStat> = {};
  for (const [skill, ability] of Object.entries(SKILL_ABILITY)) {
    const proficient = prof.has(skill);
    out[skill] = { proficient, mod: abilityMod(abilities[ability]) + (proficient ? profBonus : 0) };
  }
  return out;
}

// ── Features composition ────────────────────────────────────────────
export interface FeatureView {
  name: string;
  level: number;
  source: "class" | "subclass" | "race" | "background";
  desc: string;
}

// Merge features gained at/below the character's level, in level then source order.
export function featuresFor(opts: {
  classFeatures: FeatureView[];
  subclassFeatures: FeatureView[];
  raceFeatures: FeatureView[];
  backgroundFeatures: FeatureView[];
  level: number;
}): FeatureView[] {
  const lv = clampLevel(opts.level);
  const order = { class: 0, subclass: 1, race: 2, background: 3 } as const;
  return [
    ...opts.classFeatures,
    ...opts.subclassFeatures,
    ...opts.raceFeatures,
    ...opts.backgroundFeatures,
  ]
    .filter((f) => f.level <= lv)
    .sort((a, b) => a.level - b.level || order[a.source] - order[b.source]);
}

// ── HP clamp helper (used by service on edits) ──────────────────────
export const clampHp = (current: number, maxHp: number, tempHp = 0): number =>
  Math.max(0, Math.min(current, maxHp + tempHp));
