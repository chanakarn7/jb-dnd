"use client";
// File: components/PlayerHUD.tsx
// Full-width HUD bar below the navbar — shown when the player has a claimed character.
// Fetches GET /api/characters/[id]/quickview. Patches HP and spell slots in real time.
// Click ability score → emits dice:roll via quickRoll callback to DicePanel.

import { useEffect, useState, useCallback } from "react";
import type { QuickViewSnapshot } from "@/lib/player-ui/types";
import type { DicePanelRef } from "./DicePanel";

const ABILITY_KEYS = ["str", "dex", "con", "int", "wis", "cha"] as const;
type AbilityKey = typeof ABILITY_KEYS[number];

function mod(score: number) { return Math.floor((score - 10) / 2); }
function modStr(m: number) { return m >= 0 ? `+${m}` : `${m}`; }

function hpColor(cur: number, max: number) {
  if (max === 0) return "bg-faint";
  const pct = cur / max;
  if (cur === 0) return "bg-danger";
  if (pct < 0.25) return "bg-danger";
  if (pct < 0.5) return "bg-warning";
  return "bg-success";
}

function hpTextColor(cur: number, max: number) {
  if (max === 0) return "text-faint";
  const pct = cur / max;
  if (cur === 0) return "text-danger";
  if (pct < 0.25) return "text-danger";
  if (pct < 0.5) return "text-warning";
  return "text-success";
}

interface Props {
  characterId: string;
  sessionToken: string;
  dicePanelRef: React.RefObject<DicePanelRef | null>;
  onToast: (msg: string, kind?: "success" | "warning" | "danger") => void;
}

export default function PlayerHUD({ characterId, sessionToken, dicePanelRef, onToast }: Props) {
  const [data, setData] = useState<QuickViewSnapshot | null>(null);
  const [hpInput, setHpInput] = useState("");
  const [editingHp, setEditingHp] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchQV = useCallback(async () => {
    const res = await fetch(`/api/characters/${characterId}/quickview`, {
      headers: { Authorization: `Bearer ${sessionToken}` },
    });
    if (!res.ok) return;
    const body = (await res.json()) as { quickview: QuickViewSnapshot };
    setData(body.quickview);
    setLoading(false);
  }, [characterId, sessionToken]);

  useEffect(() => { void fetchQV(); }, [fetchQV]);

  const patchHp = useCallback(async (hp: number) => {
    const res = await fetch(`/api/characters/${characterId}/hp`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionToken}` },
      body: JSON.stringify({ hpCurrent: hp }),
    });
    if (!res.ok) { onToast("Failed to update HP", "danger"); return; }
    const body = (await res.json()) as { currentHp: number };
    setData((d) => d ? { ...d, currentHp: body.currentHp } : d);
  }, [characterId, sessionToken, onToast]);

  const commitHp = useCallback(() => {
    const n = parseInt(hpInput, 10);
    if (!Number.isNaN(n)) patchHp(n);
    setEditingHp(false);
    setHpInput("");
  }, [hpInput, patchHp]);

  const patchSlots = useCallback(async (level: string, used: number) => {
    if (!data) return;
    const next = { ...Object.fromEntries(Object.entries(data.spellSlots).map(([l, v]) => [l, v.used])), [level]: used };
    const res = await fetch(`/api/characters/${characterId}/spell-slots`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionToken}` },
      body: JSON.stringify({ spellSlotsUsed: next }),
    });
    if (!res.ok) { onToast("Failed to update spell slots", "danger"); return; }
    setData((d) => d ? { ...d, spellSlots: { ...d.spellSlots, [level]: { total: d.spellSlots[level].total, used } } } : d);
  }, [data, characterId, sessionToken, onToast]);

  const quickRoll = useCallback((ability: AbilityKey) => {
    if (!data || !dicePanelRef.current) return;
    const score = data[ability];
    const m = mod(score);
    const label = ability.toUpperCase();
    dicePanelRef.current.quickRoll(`d20${m >= 0 ? `+${m}` : `${m}`}`, `${label} Check`);
    onToast(`Rolling ${label} Check (${modStr(m)})`, "success");
  }, [data, dicePanelRef, onToast]);

  const rollInitiative = useCallback(() => {
    if (!data || !dicePanelRef.current) return;
    const m = mod(data.dex);
    dicePanelRef.current.quickRoll(`d20${m >= 0 ? `+${m}` : `${m}`}`, "Initiative");
    onToast(`Rolling Initiative (${modStr(m)})`, "success");
  }, [data, dicePanelRef, onToast]);

  if (loading) {
    return (
      <div className="w-full bg-surface border-b border-border px-4 py-2 flex items-center gap-4 animate-pulse">
        <div className="h-4 w-32 rounded bg-surface-raised" />
        <div className="h-4 w-20 rounded bg-surface-raised" />
        <div className="h-4 w-16 rounded bg-surface-raised" />
      </div>
    );
  }

  if (!data) return null;

  const hpPct = data.maxHp > 0 ? (data.currentHp / data.maxHp) * 100 : 0;
  const isUnconscious = data.currentHp === 0;

  return (
    <div className="w-full bg-surface border-b border-border px-4 py-2 flex flex-wrap items-center gap-x-6 gap-y-2">
      {/* Character name + class */}
      <div>
        <span className="font-display text-sm font-semibold text-text">{data.name}</span>
        <span className="text-xs text-muted ml-2">{data.classSlug} Lv {data.level}</span>
      </div>

      {/* HP widget */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => patchHp(Math.max(0, data.currentHp - 1))}
          className="w-6 h-6 rounded border border-border text-muted hover:text-text text-sm leading-none"
          aria-label="Decrease HP by 1"
        >−</button>
        {editingHp ? (
          <input
            autoFocus
            type="number"
            value={hpInput}
            onChange={(e) => setHpInput(e.target.value)}
            onBlur={commitHp}
            onKeyDown={(e) => { if (e.key === "Enter") commitHp(); if (e.key === "Escape") { setEditingHp(false); setHpInput(""); } }}
            className="w-16 rounded border border-accent bg-bg px-1 py-0.5 text-center font-mono text-sm focus:outline-none"
            aria-label="Enter HP value"
          />
        ) : (
          <button
            onClick={() => { setEditingHp(true); setHpInput(String(data.currentHp)); }}
            className={`font-mono text-sm font-bold ${hpTextColor(data.currentHp, data.maxHp)}`}
            aria-label={`HP: ${data.currentHp} of ${data.maxHp}`}
          >
            {data.currentHp}/{data.maxHp}
          </button>
        )}
        <button
          onClick={() => patchHp(Math.min(data.maxHp, data.currentHp + 1))}
          className="w-6 h-6 rounded border border-border text-muted hover:text-text text-sm leading-none"
          aria-label="Increase HP by 1"
        >+</button>
        {/* HP bar */}
        <div className="w-16 h-1.5 rounded-full bg-surface-raised overflow-hidden">
          <div className={`h-full rounded-full transition-all ${hpColor(data.currentHp, data.maxHp)}`} style={{ width: `${hpPct}%` }} />
        </div>
        {isUnconscious && (
          <span className="text-xs rounded px-1.5 py-0.5 bg-danger/20 text-danger font-semibold">UNCONSCIOUS</span>
        )}
      </div>

      {/* AC + PP */}
      <div className="flex items-center gap-2 text-xs">
        <span className="rounded border border-border px-2 py-0.5 font-mono text-text">AC {data.ac}</span>
        <span className="rounded border border-border px-2 py-0.5 font-mono text-muted">PP {data.passivePerception}</span>
      </div>

      {/* Ability scores */}
      <div className="flex gap-1">
        {ABILITY_KEYS.map((a) => (
          <button
            key={a}
            onClick={() => quickRoll(a)}
            className="rounded border border-border bg-surface-raised px-1.5 py-0.5 text-xs font-mono hover:border-accent hover:text-accent transition-colors"
            aria-label={`Roll ${a.toUpperCase()} check`}
          >
            {a.toUpperCase()} {modStr(mod(data[a]))}
          </button>
        ))}
      </div>

      {/* Spell slots */}
      {Object.keys(data.spellSlots).length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          {Object.entries(data.spellSlots).map(([lvl, slot]) => (
            <div key={lvl} className="flex items-center gap-0.5">
              <span className="text-[10px] text-faint mr-0.5">{lvl}</span>
              {Array.from({ length: slot.total }).map((_, i) => {
                const available = slot.total - slot.used;
                const isAvailable = i < available;
                return (
                  <button
                    key={i}
                    onClick={() => patchSlots(lvl, isAvailable ? slot.used + 1 : Math.max(0, slot.used - 1))}
                    className={`w-2.5 h-2.5 rounded-full border transition-colors ${
                      isAvailable
                        ? "bg-arcane border-arcane"
                        : "border-arcane/40 bg-transparent"
                    }`}
                    aria-label={`Level ${lvl} slot ${i + 1}: ${isAvailable ? "available" : "used"}`}
                  />
                );
              })}
            </div>
          ))}
        </div>
      )}

      {/* Conditions */}
      {data.conditions.length > 0 && (
        <div className="flex gap-1 flex-wrap">
          {data.conditions.map((c) => (
            <span key={c} className="text-xs rounded px-1.5 py-0.5 bg-danger/20 text-danger">{c}</span>
          ))}
        </div>
      )}

      {/* Roll Initiative */}
      <button
        onClick={rollInitiative}
        className="ml-auto text-xs rounded-md border border-accent text-accent px-3 py-1 hover:bg-accent hover:text-bg transition-colors font-semibold"
      >
        Roll Initiative
      </button>
    </div>
  );
}
