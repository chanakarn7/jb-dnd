// Maps the open SRD 5.1 dataset (5e-bits/5e-database, dnd5eapi shape) into our
// Prisma row shape. Pure + testable; nested fields become JSON strings.
// Deterministic derived values (xp, crSort) computed here, not guessed.
import { crToXp, formatCr, slugify } from "@/lib/reference/srd";

const num = (v: unknown, d = 0): number => (typeof v === "number" ? v : d);
const str = (v: unknown): string => (typeof v === "string" ? v : "");
const name = (v: unknown): string => (v && typeof v === "object" && "name" in v ? String((v as { name: unknown }).name) : str(v));

// ---------- Spell ----------
interface SrcSpell {
  index?: string; name: string; level: number; desc?: string[]; higher_level?: string[];
  range?: string; components?: string[]; material?: string; ritual?: boolean; concentration?: boolean;
  casting_time?: string; duration?: string; school?: { name?: string }; classes?: { name?: string }[];
}
export interface SpellRow {
  slug: string; name: string; level: number; school: string; castingTime: string; range: string;
  duration: string; components: string; ritual: boolean; concentration: boolean; description: string;
  higherLevels: string | null; classesJson: string; source: string;
}
export function toSpellRow(s: SrcSpell): SpellRow {
  const comps = s.components ?? [];
  return {
    slug: s.index ?? slugify(s.name),
    name: s.name,
    level: num(s.level),
    school: name(s.school),
    castingTime: str(s.casting_time),
    range: str(s.range),
    duration: str(s.duration),
    components: JSON.stringify({
      v: comps.includes("V"),
      s: comps.includes("S"),
      m: comps.includes("M") ? str(s.material) || null : null,
    }),
    ritual: !!s.ritual,
    concentration: !!s.concentration,
    description: (s.desc ?? []).join("\n\n"),
    higherLevels: s.higher_level && s.higher_level.length ? s.higher_level.join("\n\n") : null,
    classesJson: JSON.stringify((s.classes ?? []).map((c) => name(c))),
    source: "SRD 5.1",
  };
}

// ---------- Monster ----------
interface SrcMonster {
  index?: string; name: string; size?: string; type?: string; alignment?: string;
  armor_class?: { value?: number; armor?: { name?: string }[]; desc?: string }[];
  hit_points?: number; hit_points_roll?: string; speed?: Record<string, string>;
  strength?: number; dexterity?: number; constitution?: number; intelligence?: number; wisdom?: number; charisma?: number;
  proficiencies?: { value?: number; proficiency?: { name?: string } }[];
  damage_immunities?: unknown[]; condition_immunities?: unknown[]; damage_resistances?: unknown[];
  senses?: Record<string, string | number>; languages?: string; challenge_rating?: number; xp?: number;
  special_abilities?: { name?: string; desc?: string }[];
  actions?: { name?: string; desc?: string }[];
  legendary_actions?: { name?: string; desc?: string }[];
  reactions?: { name?: string; desc?: string }[];
}
export interface MonsterRow {
  slug: string; name: string; size: string; type: string; alignment: string; cr: string; crSort: number;
  xp: number; ac: number; acNote: string | null; hp: number; hpFormula: string | null; speed: string;
  abilityScores: string; savesJson: string; skillsJson: string; senses: string | null; languages: string | null;
  immunitiesJson: string; resistancesJson: string; traitsJson: string; actionsJson: string; source: string;
}
const sign = (v: number): string => (v >= 0 ? "+" : "") + v;
const normList = (a?: unknown[]): string[] => (a ?? []).map((x) => name(x)).filter(Boolean);

export function toMonsterRow(m: SrcMonster): MonsterRow {
  const cr = num(m.challenge_rating);
  const ac0 = (m.armor_class ?? [])[0] ?? {};
  const acNote =
    ac0.armor && ac0.armor.length
      ? ac0.armor.map((a) => str(a.name)).join(", ")
      : ac0.desc
        ? str(ac0.desc)
        : null;

  const speed = Object.entries(m.speed ?? {})
    .map(([k, v]) => (k === "walk" ? String(v) : `${k} ${v}`))
    .join(", ");

  const saves: Record<string, string> = {};
  const skills: Record<string, string> = {};
  for (const p of m.proficiencies ?? []) {
    const pname = p.proficiency?.name ?? "";
    const val = sign(num(p.value));
    if (pname.startsWith("Saving Throw:")) saves[pname.replace("Saving Throw:", "").trim()] = val;
    else if (pname.startsWith("Skill:")) skills[pname.replace("Skill:", "").trim()] = val;
  }

  const sensesParts: string[] = [];
  let passive = "";
  for (const [k, v] of Object.entries(m.senses ?? {})) {
    if (k === "passive_perception") passive = `passive Perception ${v}`;
    else sensesParts.push(`${k.replace(/_/g, " ")} ${v}`);
  }
  if (passive) sensesParts.push(passive);

  const traits = (m.special_abilities ?? []).map((t) => ({ name: str(t.name), desc: str(t.desc) }));
  // Statblock convention: Actions → Reactions → Legendary Actions.
  const actions = [
    ...(m.actions ?? []).map((a) => ({ name: str(a.name), desc: str(a.desc), kind: "action" as const })),
    ...(m.reactions ?? []).map((a) => ({ name: str(a.name), desc: str(a.desc), kind: "reaction" as const })),
    ...(m.legendary_actions ?? []).map((a) => ({ name: str(a.name), desc: str(a.desc), kind: "legendary" as const })),
  ];

  return {
    slug: m.index ?? slugify(m.name),
    name: m.name,
    size: str(m.size),
    type: str(m.type),
    alignment: str(m.alignment),
    cr: formatCr(cr),
    crSort: cr,
    xp: crToXp(cr) || num(m.xp),
    ac: num(ac0.value),
    acNote,
    hp: num(m.hit_points),
    hpFormula: m.hit_points_roll ? str(m.hit_points_roll) : null,
    speed,
    abilityScores: JSON.stringify({
      str: num(m.strength), dex: num(m.dexterity), con: num(m.constitution),
      int: num(m.intelligence), wis: num(m.wisdom), cha: num(m.charisma),
    }),
    savesJson: JSON.stringify(saves),
    skillsJson: JSON.stringify(skills),
    senses: sensesParts.length ? sensesParts.join(", ") : null,
    languages: m.languages ? str(m.languages) : null,
    immunitiesJson: JSON.stringify({ damage: normList(m.damage_immunities), condition: normList(m.condition_immunities) }),
    resistancesJson: JSON.stringify(normList(m.damage_resistances)),
    traitsJson: JSON.stringify(traits),
    actionsJson: JSON.stringify(actions),
    source: "SRD 5.1",
  };
}

// ---------- Item (Equipment + Magic-Items) ----------
interface SrcItem {
  index?: string; name: string; equipment_category?: { index?: string; name?: string };
  rarity?: { name?: string }; desc?: string[];
  weapon_category?: string; weapon_range?: string; cost?: { quantity?: number; unit?: string };
  damage?: { damage_dice?: string; damage_type?: { name?: string } };
  two_handed_damage?: { damage_dice?: string; damage_type?: { name?: string } };
  range?: { normal?: number; long?: number }; weight?: number; properties?: { name?: string }[];
  armor_category?: string; armor_class?: { base?: number; dex_bonus?: boolean; max_bonus?: number };
  str_minimum?: number; stealth_disadvantage?: boolean;
}
export interface ItemRow {
  slug: string; name: string; type: string; rarity: string; requiresAttunement: boolean;
  propertiesJson: string; description: string | null; source: string;
}
const TYPE_MAP: Record<string, string> = {
  "wondrous-items": "wondrous", tools: "tool", "tool": "tool",
};
function mapType(idx: string): string {
  return TYPE_MAP[idx] ?? idx;
}
function damageStr(d?: { damage_dice?: string; damage_type?: { name?: string } }): string | undefined {
  if (!d?.damage_dice) return undefined;
  const t = d.damage_type?.name ? " " + d.damage_type.name.toLowerCase() : "";
  return d.damage_dice + t;
}
export function toItemRow(it: SrcItem): ItemRow {
  const catIdx = it.equipment_category?.index ?? "adventuring-gear";
  const desc = (it.desc ?? []).join("\n\n");
  const rarity = it.rarity?.name ? it.rarity.name.toLowerCase().replace(/\s+/g, "-") : "mundane";

  const props: Record<string, string> = {};
  const dmg = damageStr(it.damage);
  if (dmg) props.damage = dmg;
  const vers = damageStr(it.two_handed_damage);
  if (vers) props.versatile = vers;
  if (it.weapon_range === "Ranged" && it.range?.normal) {
    props.range = it.range.long ? `${it.range.normal}/${it.range.long} ft.` : `${it.range.normal} ft.`;
  }
  if (it.armor_class?.base !== undefined) {
    let ac = String(it.armor_class.base);
    if (it.armor_class.dex_bonus) ac += " + Dex" + (it.armor_class.max_bonus ? ` (max ${it.armor_class.max_bonus})` : "");
    props.armorClass = ac;
  }
  if (it.str_minimum) props.strength = `Str ${it.str_minimum}`;
  if (it.stealth_disadvantage) props.stealth = "Disadvantage";
  if (it.properties && it.properties.length) props.properties = it.properties.map((p) => str(p.name)).join(", ");
  if (typeof it.weight === "number" && it.weight > 0) props.weight = `${it.weight} lb`;
  if (it.cost?.quantity !== undefined) props.cost = `${it.cost.quantity} ${it.cost.unit ?? ""}`.trim();

  return {
    slug: it.index ?? slugify(it.name),
    name: it.name,
    type: mapType(catIdx),
    rarity,
    requiresAttunement: /requires attunement/i.test(desc),
    propertiesJson: JSON.stringify(props),
    description: desc.length ? desc : null,
    source: "SRD 5.1",
  };
}
