"use client";

import { Sparkles, Sword } from "lucide-react";
import { abilityMod } from "@/lib/reference/srd";
import type { SpellDetail, ItemDetail, MonsterDetail } from "@/lib/reference/types";

export const ATTRIBUTION =
  "This work includes material from the System Reference Document 5.1 by Wizards of the Coast LLC, available under CC-BY-4.0.";

export function Attribution() {
  return (
    <footer className="mt-10 pt-4 border-t border-border">
      <p className="text-faint text-xs leading-relaxed">{ATTRIBUTION}</p>
    </footer>
  );
}

// rarity → chip color (color + text label, never color alone — a11y)
export function rarityChip(rarity: string): string {
  const map: Record<string, string> = {
    mundane: "border-faint/60 text-muted",
    common: "border-muted text-muted",
    uncommon: "border-success/60 text-success",
    rare: "border-arcane/60 text-arcane",
    "very-rare": "border-accent/60 text-accent",
    legendary: "border-accent text-accent",
    artifact: "border-danger/60 text-danger",
  };
  return map[rarity] ?? "border-border text-muted";
}

function Line({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 py-1">
      <span className="text-muted w-32 shrink-0">{label}</span>
      <span className="flex-1">{children}</span>
    </div>
  );
}

// ---------- Spell card ----------
export function SpellCard({ spell: s }: { spell: SpellDetail }) {
  const comp = [s.components.v ? "V" : "", s.components.s ? "S" : "", s.components.m ? "M" : ""]
    .filter(Boolean)
    .join(", ") + (s.components.m ? ` (${s.components.m})` : "");
  return (
    <article>
      <Sparkles className="w-6 h-6 text-arcane mb-2" aria-hidden />
      <h1 className="font-display text-3xl text-text">{s.name}</h1>
      <p className="text-arcane mt-1">
        {s.level === 0 ? "Cantrip" : `Level ${s.level}`} {s.school}
        {s.ritual ? " · ritual" : ""}
        {s.concentration ? " · concentration" : ""}
      </p>
      <hr className="my-4 h-0.5 border-0 bg-gradient-to-r from-arcane to-arcane/10" />
      <div className="text-sm">
        <Line label="Casting Time">{s.castingTime}</Line>
        <Line label="Range"><span className="font-mono tnum">{s.range}</span></Line>
        <Line label="Components">{comp}</Line>
        <Line label="Duration">{s.duration}</Line>
      </div>
      <hr className="border-border my-4" />
      {s.description.split("\n\n").map((p, i) => (
        <p key={i} className="leading-relaxed mb-3">{p}</p>
      ))}
      {s.higherLevels && (
        <p className="leading-relaxed mt-3">
          <span className="font-semibold text-text">At Higher Levels. </span>
          {s.higherLevels}
        </p>
      )}
      <hr className="border-border my-4" />
      <p className="text-sm">
        <span className="text-muted">Classes: </span>
        {s.classes.map((c, i) => (
          <span key={c} className="text-arcane">{c}{i < s.classes.length - 1 ? " · " : ""}</span>
        ))}
      </p>
    </article>
  );
}

// ---------- Item card ----------
const propLabel = (k: string) => k.charAt(0).toUpperCase() + k.slice(1).replace(/([A-Z])/g, " $1");
export function ItemCard({ item: it }: { item: ItemDetail }) {
  const entries = Object.entries(it.properties);
  return (
    <article>
      <Sword className="w-6 h-6 text-accent mb-2" aria-hidden />
      <h1 className="font-display text-3xl text-text">{it.name}</h1>
      <p className="mt-1">
        <span className="capitalize text-muted">{it.type.replace(/-/g, " ")}</span>
        {" · "}
        <span className={rarityChip(it.rarity).split(" ")[1]}>{it.rarity.replace(/-/g, " ")}</span>
        {it.requiresAttunement && <span className="text-accent"> · ◈ requires attunement</span>}
      </p>
      <hr className="my-4 h-0.5 border-0 bg-gradient-to-r from-accent to-accent/10" />
      {entries.length > 0 && (
        <div className="text-sm">
          {entries.map(([k, v]) => (
            <Line key={k} label={propLabel(k)}><span className="font-mono tnum">{String(v)}</span></Line>
          ))}
        </div>
      )}
      {it.description && (
        <>
          <hr className="border-border my-4" />
          {it.description.split("\n\n").map((p, i) => (
            <p key={i} className="leading-relaxed mb-3">{p}</p>
          ))}
        </>
      )}
    </article>
  );
}

// ---------- Monster statblock (hero) ----------
const goldRule = <hr className="my-3 h-0.5 border-0 bg-gradient-to-r from-accent to-accent/10" />;
function Section({ title, items }: { title: string; items: { name: string; desc: string }[] }) {
  if (!items.length) return null;
  return (
    <>
      <h2 className="text-accent text-sm font-semibold uppercase tracking-wider mt-5 mb-2 border-b border-border pb-1">
        {title}
      </h2>
      {items.map((a, i) => (
        <p key={i} className="mb-2 leading-relaxed text-sm">
          <span className="font-semibold italic text-text">{a.name}. </span>
          {a.desc}
        </p>
      ))}
    </>
  );
}
export function MonsterStatblock({ monster: m }: { monster: MonsterDetail }) {
  const abilities: [string, keyof MonsterDetail["abilityScores"]][] = [
    ["STR", "str"], ["DEX", "dex"], ["CON", "con"], ["INT", "int"], ["WIS", "wis"], ["CHA", "cha"],
  ];
  const saves = Object.entries(m.saves).map(([k, v]) => `${k} ${v}`).join(", ");
  const skills = Object.entries(m.skills).map(([k, v]) => `${k} ${v}`).join(", ");
  const actions = m.actions.filter((a) => a.kind === "action");
  const legendary = m.actions.filter((a) => a.kind === "legendary");
  const reactions = m.actions.filter((a) => a.kind === "reaction");
  return (
    <article>
      <h1 className="font-display text-3xl text-accent">{m.name}</h1>
      <p className="italic text-muted">
        {m.size} {m.type} ({m.alignment})
      </p>
      {goldRule}
      <div className="text-sm">
        <Line label="Armor Class">
          <span className="font-mono tnum">{m.ac}</span>
          {m.acNote && <span className="text-muted"> ({m.acNote})</span>}
        </Line>
        <Line label="Hit Points">
          <span className="font-mono tnum">{m.hp}</span>
          {m.hpFormula && <span className="text-muted"> ({m.hpFormula})</span>}
        </Line>
        <Line label="Speed">{m.speed}</Line>
      </div>
      {goldRule}
      <div className="grid grid-cols-6 gap-2 my-3">
        {abilities.map(([label, key]) => (
          <div key={key} className="rounded-md bg-surface-raised border border-border px-2 py-2 text-center">
            <div className="text-[11px] uppercase tracking-wide text-muted">{label}</div>
            <div className="font-mono tnum text-lg text-text">{m.abilityScores[key]}</div>
            <div className="font-mono tnum text-sm text-muted">{abilityMod(m.abilityScores[key])}</div>
          </div>
        ))}
      </div>
      {goldRule}
      <div className="text-sm">
        {saves && <Line label="Saving Throws"><span className="font-mono tnum">{saves}</span></Line>}
        {skills && <Line label="Skills"><span className="font-mono tnum">{skills}</span></Line>}
        {m.resistances.length > 0 && <Line label="Damage Resistances">{m.resistances.join(", ")}</Line>}
        {m.immunities.damage.length > 0 && <Line label="Damage Immunities">{m.immunities.damage.join(", ")}</Line>}
        {m.immunities.condition.length > 0 && <Line label="Condition Immunities">{m.immunities.condition.join(", ")}</Line>}
        {m.senses && <Line label="Senses">{m.senses}</Line>}
        {m.languages && <Line label="Languages">{m.languages}</Line>}
        <Line label="Challenge">
          <span className="font-mono tnum">{m.cr}</span>
          <span className="text-muted"> ({m.xp.toLocaleString()} XP)</span>
        </Line>
      </div>
      {m.traits.length > 0 && (
        <>
          {goldRule}
          {m.traits.map((t, i) => (
            <p key={i} className="mb-2 leading-relaxed text-sm">
              <span className="font-semibold italic text-text">{t.name}. </span>
              {t.desc}
            </p>
          ))}
        </>
      )}
      <Section title="Actions" items={actions} />
      <Section title="Reactions" items={reactions} />
      <Section title="Legendary Actions" items={legendary} />
    </article>
  );
}
