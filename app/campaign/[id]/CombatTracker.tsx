"use client";
// File: app/campaign/[id]/CombatTracker.tsx
// Real-time combat tracker — DM full controls + Player read-only view.
// Reads initial state via combat:requestSnapshot on mount; updates via socket events.
// All mutations go through Socket.io intents; REST is read-only (ARCHITECTURE.md).
// Inherits design tokens from docs/program/DESIGN_SYSTEM.md (no new colors).

import { useEffect, useRef, useState, useCallback } from "react";
import {
  Swords,
  ChevronUp,
  ChevronDown,
  Plus,
  X,
  SkipForward,
  CheckCircle2,
  AlertCircle,
  User,
  Bug,
  Target,
} from "lucide-react";
import { useCampaign } from "../../providers";
import type { EncounterSnapshot, CombatantView, ConditionEntry, Condition } from "@/lib/combat/types";

// ── Token helper (mirrors CharactersClient) ───────────────────────────────
function getStoredToken(campaignId: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    const all = JSON.parse(localStorage.getItem("dnd.sessions") ?? "{}");
    return (all as Record<string, { token?: string }>)[campaignId]?.token ?? null;
  } catch {
    return null;
  }
}

function authHeaders(campaignId: string): HeadersInit {
  const t = getStoredToken(campaignId);
  return t
    ? { "Content-Type": "application/json", Authorization: `Bearer ${t}` }
    : { "Content-Type": "application/json" };
}

// ── Condition metadata ────────────────────────────────────────────────────
const CONDITION_META: Record<Condition, { abbr: string; color: string; effect: string }> = {
  Blinded:       { abbr: "BLI", color: "#94A3B8", effect: "Can't see; attacks at disadvantage" },
  Charmed:       { abbr: "CHR", color: "#8B5CF6", effect: "Can't attack charmer; charmer has adv. on social" },
  Deafened:      { abbr: "DEA", color: "#94A3B8", effect: "Can't hear; auto-fails hearing checks" },
  Exhaustion:    { abbr: "EXH", color: "#F59E0B", effect: "Stacking penalties — 6 levels; 6 = death" },
  Frightened:    { abbr: "FRI", color: "#F59E0B", effect: "Disadvantage while source in sight; can't move closer" },
  Grappled:      { abbr: "GRP", color: "#94A3B8", effect: "Speed 0; ends if grappler is incapacitated" },
  Incapacitated: { abbr: "INC", color: "#EF4444", effect: "Can't take actions or reactions" },
  Invisible:     { abbr: "INV", color: "#8B5CF6", effect: "Can't be seen; attacks have advantage" },
  Paralyzed:     { abbr: "PAR", color: "#EF4444", effect: "Incapacitated; auto-fail Str/Dex saves; nearby hits are crits" },
  Petrified:     { abbr: "PET", color: "#94A3B8", effect: "Transformed to stone; incapacitated; resistant to all dmg" },
  Poisoned:      { abbr: "POI", color: "#22C55E", effect: "Disadvantage on attacks and ability checks" },
  Prone:         { abbr: "PRN", color: "#94A3B8", effect: "Disadvantage on attacks; melee attacks against have adv." },
  Restrained:    { abbr: "RES", color: "#F59E0B", effect: "Speed 0; attacks at disadvantage; attackers have adv." },
  Stunned:       { abbr: "STU", color: "#EF4444", effect: "Incapacitated; auto-fail Str/Dex saves; nearby hits crit" },
  Unconscious:   { abbr: "UNC", color: "#EF4444", effect: "Incapacitated, prone, drops items; nearby hits crit" },
};

const ALL_CONDITIONS = Object.keys(CONDITION_META) as Condition[];

// ── HP color helper ───────────────────────────────────────────────────────
function hpColor(hp: number, max: number): string {
  if (hp === 0) return "text-danger";
  const pct = hp / max;
  if (pct > 0.5) return "text-success";
  if (pct > 0.25) return "text-warning";
  return "text-danger";
}

function hpBarColor(hp: number, max: number): string {
  if (hp === 0) return "#EF4444";
  const pct = hp / max;
  if (pct > 0.5) return "#22C55E";
  if (pct > 0.25) return "#F59E0B";
  return "#EF4444";
}

// ── CharacterRef (for add panel) ─────────────────────────────────────────
interface CharRef { id: string; name: string; maxHp: number; currentHp: number }
interface MonsterRef { slug: string; name: string; hp: number; cr: string }

// ── Main component ────────────────────────────────────────────────────────
export default function CombatTracker({ campaignId }: { campaignId: string }) {
  const { me, getSocket, toast } = useCampaign();
  const isDM = me?.role === "dm";

  const [encounter, setEncounter] = useState<EncounterSnapshot | null | undefined>(undefined); // undefined=loading
  const [addOpen, setAddOpen] = useState(false);
  const [addTab, setAddTab] = useState<"characters" | "monsters">("characters");
  const [addSearch, setAddSearch] = useState("");
  const [addInitiative, setAddInitiative] = useState("");
  const [characters, setCharacters] = useState<CharRef[]>([]);
  const [monsters, setMonsters] = useState<MonsterRef[]>([]);
  const [condPickerId, setCondPickerId] = useState<string | null>(null);
  const [removeId, setRemoveId] = useState<string | null>(null);
  const [endConfirm, setEndConfirm] = useState(false);
  const [startModal, setStartModal] = useState(false);
  const [startName, setStartName] = useState("Encounter");
  const [yourTurnDismissed, setYourTurnDismissed] = useState(false);
  const [dmgInputs, setDmgInputs] = useState<Record<string, string>>({});
  const [healInputs, setHealInputs] = useState<Record<string, string>>({});

  const encRef = useRef(encounter);
  encRef.current = encounter;

  // ── Socket setup ──────────────────────────────────────────────────────
  useEffect(() => {
    const s = getSocket();
    if (!s) return;
    const raw = s as unknown as EventTarget & Record<string, unknown>;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function on(event: string, handler: (data: any) => void) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (s as any).on(event, handler);
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function off(event: string, handler: (data: any) => void) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (s as any).off(event, handler);
    }

    const onSnapshot = (data: { encounter: EncounterSnapshot | null }) => {
      setEncounter(data.encounter);
    };
    const onStarted = (data: { encounter: EncounterSnapshot }) => {
      setEncounter(data.encounter);
      setYourTurnDismissed(false);
    };
    const onEnded = () => {
      setEncounter((prev) => prev ? { ...prev, status: "ended" } : prev);
    };
    const onCombatantAdded = (data: { combatant: import("@prisma/client").Combatant }) => {
      setEncounter((prev) => {
        if (!prev) return prev;
        const view: CombatantView = {
          id: data.combatant.id,
          type: data.combatant.type as "character" | "monster",
          characterId: data.combatant.characterId,
          monsterSlug: data.combatant.monsterSlug,
          name: data.combatant.name,
          initiative: data.combatant.initiative,
          initiativeOrder: data.combatant.initiativeOrder,
          maxHp: data.combatant.maxHp,
          currentHp: data.combatant.currentHp,
          conditions: [],
          removed: false,
        };
        return { ...prev, combatants: [...prev.combatants, view] };
      });
    };
    const onCombatantRemoved = (data: { combatantId: string }) => {
      setEncounter((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          combatants: prev.combatants.map((c) =>
            c.id === data.combatantId ? { ...c, removed: true } : c,
          ),
        };
      });
    };
    const onHpChanged = (data: { combatantId: string; currentHp: number }) => {
      setEncounter((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          combatants: prev.combatants.map((c) =>
            c.id === data.combatantId ? { ...c, currentHp: data.currentHp } : c,
          ),
        };
      });
    };
    const onConditionsChanged = (data: { combatantId: string; conditions: ConditionEntry[] }) => {
      setEncounter((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          combatants: prev.combatants.map((c) =>
            c.id === data.combatantId ? { ...c, conditions: data.conditions } : c,
          ),
        };
      });
    };
    const onTurnAdvanced = (data: {
      currentTurnIndex: number;
      round: number;
      activeCombatantId: string | null;
    }) => {
      setEncounter((prev) => {
        if (!prev) return prev;
        return { ...prev, currentTurnIndex: data.currentTurnIndex, round: data.round };
      });
      setYourTurnDismissed(false);
    };
    const onInitiativeSet = (data: { combatantId: string; initiative: number }) => {
      setEncounter((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          combatants: prev.combatants.map((c) =>
            c.id === data.combatantId ? { ...c, initiative: data.initiative } : c,
          ),
        };
      });
    };
    const onOrderUpdated = (data: { order: Array<{ id: string; initiativeOrder: number }> }) => {
      setEncounter((prev) => {
        if (!prev) return prev;
        const orderMap = new Map(data.order.map((o) => [o.id, o.initiativeOrder]));
        return {
          ...prev,
          combatants: prev.combatants.map((c) =>
            orderMap.has(c.id) ? { ...c, initiativeOrder: orderMap.get(c.id)! } : c,
          ),
        };
      });
    };
    const onError = (data: { error: string; message?: string }) => {
      toast(data.message ?? data.error, "danger");
    };

    on("combat:snapshot", onSnapshot);
    on("combat:encounterStarted", onStarted);
    on("combat:encounterEnded", onEnded);
    on("combat:combatantAdded", onCombatantAdded);
    on("combat:combatantRemoved", onCombatantRemoved);
    on("combat:hpChanged", onHpChanged);
    on("combat:conditionsChanged", onConditionsChanged);
    on("combat:turnAdvanced", onTurnAdvanced);
    on("combat:initiativeSet", onInitiativeSet);
    on("combat:orderUpdated", onOrderUpdated);
    on("combat:error", onError);

    // Request initial state
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (s as any).emit("combat:requestSnapshot", {});

    return () => {
      off("combat:snapshot", onSnapshot);
      off("combat:encounterStarted", onStarted);
      off("combat:encounterEnded", onEnded);
      off("combat:combatantAdded", onCombatantAdded);
      off("combat:combatantRemoved", onCombatantRemoved);
      off("combat:hpChanged", onHpChanged);
      off("combat:conditionsChanged", onConditionsChanged);
      off("combat:turnAdvanced", onTurnAdvanced);
      off("combat:initiativeSet", onInitiativeSet);
      off("combat:orderUpdated", onOrderUpdated);
      off("combat:error", onError);
    };
  }, [getSocket, toast]);

  // ── Socket emit helpers ───────────────────────────────────────────────
  const emit = useCallback(
    (event: string, payload: unknown) => {
      const s = getSocket();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (s) (s as any).emit(event, payload);
    },
    [getSocket],
  );

  // ── Add panel: fetch characters + monsters ────────────────────────────
  useEffect(() => {
    if (!addOpen || !campaignId) return;
    if (addTab === "characters") {
      fetch("/api/characters", { headers: authHeaders(campaignId) })
        .then((r) => r.json())
        .then((d: { characters?: CharRef[] }) => setCharacters(d.characters ?? []))
        .catch(() => {});
    } else {
      const q = addSearch ? `?search=${encodeURIComponent(addSearch)}` : "";
      fetch(`/api/reference/monsters${q}`, { headers: authHeaders(campaignId) })
        .then((r) => r.json())
        .then((d: { monsters?: MonsterRef[] }) => setMonsters(d.monsters ?? []))
        .catch(() => {});
    }
  }, [addOpen, addTab, addSearch, campaignId]);

  // ── Derived state ─────────────────────────────────────────────────────
  const activeCombatants =
    encounter?.combatants.filter((c) => !c.removed && c.initiative !== null) ?? [];
  const waitingCombatants =
    encounter?.combatants.filter((c) => !c.removed && c.initiative === null) ?? [];
  const activeCombatant = activeCombatants[encounter?.currentTurnIndex ?? 0] ?? null;

  // Check if it's this player's turn
  const myCharacterId = me?.sessionId; // we compare against combatant.characterId via props — use state
  const isMyTurn = !isDM && activeCombatant?.type === "character"; // simplified; full check needs sessionId→characterId

  // ── Loading ───────────────────────────────────────────────────────────
  if (encounter === undefined) {
    return (
      <section className="rounded-lg border border-border bg-surface p-6 animate-pulse">
        <div className="h-6 w-40 rounded bg-surface-raised mb-4" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 rounded bg-surface-raised" />
          ))}
        </div>
      </section>
    );
  }

  // ── No active encounter ───────────────────────────────────────────────
  if (!encounter || encounter.status === "ended") {
    return (
      <section className="rounded-lg border border-border bg-surface p-6">
        <div className="flex items-center gap-2 mb-4">
          <Swords className="w-5 h-5 text-muted" aria-hidden />
          <h3 className="text-lg font-semibold">Combat</h3>
        </div>
        {isDM ? (
          <div className="text-center py-6">
            <p className="text-muted text-sm mb-4">No active encounter. Ready to start combat?</p>
            <button
              onClick={() => setStartModal(true)}
              className="rounded-md bg-accent text-bg font-semibold px-5 py-2.5 text-sm hover:bg-accent-hover transition-colors"
            >
              ⚔ Start Combat
            </button>
          </div>
        ) : (
          <p className="text-muted text-sm text-center py-6">No active combat.</p>
        )}

        {startModal && (
          <StartCombatModal
            name={startName}
            onNameChange={setStartName}
            onConfirm={() => {
              emit("combat:startEncounter", { name: startName.trim() || undefined });
              setStartModal(false);
            }}
            onCancel={() => setStartModal(false)}
          />
        )}
      </section>
    );
  }

  // ── Active encounter ──────────────────────────────────────────────────
  return (
    <section className="rounded-lg border border-border bg-surface overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-3 bg-surface-raised border-b border-border">
        <Swords className="w-4 h-4 text-accent" aria-hidden />
        <span className="font-display text-accent text-sm font-semibold tracking-wide">
          {encounter.name ?? "Encounter"}
        </span>
        <span className="font-mono text-muted text-sm ml-auto">
          Round <span className="text-text font-semibold">{encounter.round}</span>
        </span>
        {isDM && (
          <button
            onClick={() => setEndConfirm(true)}
            className="text-xs border border-danger/40 text-danger rounded px-2.5 py-1 hover:bg-danger/10 transition-colors"
          >
            End Combat
          </button>
        )}
      </div>

      {/* YOUR TURN banner (player only) */}
      {!isDM && isMyTurn && !yourTurnDismissed && (
        <div className="bg-accent/15 border-b border-accent/30 px-5 py-3 flex items-center justify-between">
          <span className="font-semibold text-accent text-sm">
            ⚔ IT&apos;S YOUR TURN!
          </span>
          <button
            onClick={() => setYourTurnDismissed(true)}
            className="text-accent/60 hover:text-accent"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Sticky bar: Next Turn + active combatant */}
      {isDM && activeCombatants.length > 0 && (
        <div className="flex items-center gap-3 px-5 py-2.5 border-b border-border bg-surface">
          <span className="text-sm text-muted">
            ▶{" "}
            <span className="text-text font-medium">
              {activeCombatant?.name ?? "—"}&apos;s turn
            </span>
          </span>
          <button
            onClick={() => {
              if (encounter) emit("combat:nextTurn", { encounterId: encounter.id });
            }}
            className="ml-auto flex items-center gap-1.5 rounded-md bg-accent text-bg font-semibold px-4 py-1.5 text-sm hover:bg-accent-hover transition-colors"
          >
            <SkipForward className="w-4 h-4" aria-hidden /> Next Turn
          </button>
        </div>
      )}

      {/* Initiative list */}
      <div className="divide-y divide-border">
        {activeCombatants.map((c, idx) => {
          const isActive = idx === encounter.currentTurnIndex;
          // Tie peers: same initiative value
          const tiePeers = activeCombatants
            .map((p, i) => ({ ...p, _idx: i }))
            .filter((p) => p.initiative === c.initiative);
          const tieIdx = tiePeers.findIndex((p) => p.id === c.id);
          const canMoveUp = tieIdx > 0;
          const canMoveDown = tieIdx < tiePeers.length - 1;

          return (
            <CombatantRow
              key={c.id}
              combatant={c}
              isActive={isActive}
              isDM={isDM}
              canMoveUp={canMoveUp && isDM}
              canMoveDown={canMoveDown && isDM}
              dmgValue={dmgInputs[c.id] ?? ""}
              healValue={healInputs[c.id] ?? ""}
              onDmgChange={(v) => setDmgInputs((p) => ({ ...p, [c.id]: v }))}
              onHealChange={(v) => setHealInputs((p) => ({ ...p, [c.id]: v }))}
              onApplyDmg={() => {
                const amt = parseInt(dmgInputs[c.id] ?? "");
                if (isNaN(amt) || amt <= 0) return;
                emit("combat:applyDamage", { combatantId: c.id, amount: amt });
                setDmgInputs((p) => ({ ...p, [c.id]: "" }));
              }}
              onApplyHeal={() => {
                const amt = parseInt(healInputs[c.id] ?? "");
                if (isNaN(amt) || amt <= 0) return;
                emit("combat:applyHealing", { combatantId: c.id, amount: amt });
                setHealInputs((p) => ({ ...p, [c.id]: "" }));
              }}
              onCondPicker={() => setCondPickerId((prev) => (prev === c.id ? null : c.id))}
              onRemove={() => setRemoveId(c.id)}
              onSetActive={() => encounter && emit("combat:setTurn", { encounterId: encounter.id, combatantId: c.id })}
              onMoveUp={() => {
                const peer = tiePeers[tieIdx - 1];
                if (!peer || !encounter) return;
                const newOrder = tiePeers.map((p) => p.id);
                const tmp = newOrder[tieIdx];
                newOrder[tieIdx] = newOrder[tieIdx - 1];
                newOrder[tieIdx - 1] = tmp;
                emit("combat:reorderTie", { encounterId: encounter.id, orderedIds: newOrder });
              }}
              onMoveDown={() => {
                const peer = tiePeers[tieIdx + 1];
                if (!peer || !encounter) return;
                const newOrder = tiePeers.map((p) => p.id);
                const tmp = newOrder[tieIdx];
                newOrder[tieIdx] = newOrder[tieIdx + 1];
                newOrder[tieIdx + 1] = tmp;
                emit("combat:reorderTie", { encounterId: encounter.id, orderedIds: newOrder });
              }}
            />
          );
        })}

        {/* Waiting section */}
        {waitingCombatants.length > 0 && (
          <>
            <div className="px-5 py-1.5 text-xs font-semibold text-faint uppercase tracking-widest bg-bg">
              Waiting — no initiative
            </div>
            {waitingCombatants.map((c) => (
              <CombatantRow
                key={c.id}
                combatant={c}
                isActive={false}
                isDM={isDM}
                canMoveUp={false}
                canMoveDown={false}
                dmgValue={dmgInputs[c.id] ?? ""}
                healValue={healInputs[c.id] ?? ""}
                onDmgChange={(v) => setDmgInputs((p) => ({ ...p, [c.id]: v }))}
                onHealChange={(v) => setHealInputs((p) => ({ ...p, [c.id]: v }))}
                onApplyDmg={() => {
                  const amt = parseInt(dmgInputs[c.id] ?? "");
                  if (isNaN(amt) || amt <= 0) return;
                  emit("combat:applyDamage", { combatantId: c.id, amount: amt });
                  setDmgInputs((p) => ({ ...p, [c.id]: "" }));
                }}
                onApplyHeal={() => {
                  const amt = parseInt(healInputs[c.id] ?? "");
                  if (isNaN(amt) || amt <= 0) return;
                  emit("combat:applyHealing", { combatantId: c.id, amount: amt });
                  setHealInputs((p) => ({ ...p, [c.id]: "" }));
                }}
                onCondPicker={() => setCondPickerId((prev) => (prev === c.id ? null : c.id))}
                onRemove={() => setRemoveId(c.id)}
                onSetActive={() => {}}
                onMoveUp={() => {}}
                onMoveDown={() => {}}
                initiativeInput={isDM ? (
                  <InitiativeInput
                    combatantId={c.id}
                    onSet={(val) => emit("combat:setInitiative", { combatantId: c.id, initiative: val })}
                  />
                ) : null}
              />
            ))}
          </>
        )}

        {/* Empty state */}
        {activeCombatants.length === 0 && waitingCombatants.length === 0 && (
          <div className="text-center py-8 text-muted text-sm">
            No combatants yet.{isDM && " Use Add Combatant below to get started."}
          </div>
        )}
      </div>

      {/* DM footer: Add Combatant */}
      {isDM && (
        <div className="px-5 py-3 border-t border-border bg-surface-raised">
          <button
            onClick={() => setAddOpen(true)}
            className="flex items-center gap-1.5 text-sm text-muted hover:text-accent transition-colors"
          >
            <Plus className="w-4 h-4" aria-hidden /> Add Combatant
          </button>
        </div>
      )}

      {/* Condition picker overlay */}
      {condPickerId && (
        <ConditionPicker
          combatantId={condPickerId}
          activeConditions={
            encounter.combatants.find((c) => c.id === condPickerId)?.conditions ?? []
          }
          onToggle={(condition) => {
            const c = encounter.combatants.find((x) => x.id === condPickerId);
            if (!c) return;
            const has = c.conditions.some((x) => x.name === condition);
            emit(has ? "combat:removeCondition" : "combat:addCondition", {
              combatantId: condPickerId,
              condition,
            });
          }}
          onClose={() => setCondPickerId(null)}
        />
      )}

      {/* Remove confirm */}
      {removeId && (
        <ConfirmDialog
          message={`Remove ${encounter.combatants.find((c) => c.id === removeId)?.name ?? "combatant"} from encounter?`}
          confirmLabel="Remove"
          confirmClass="bg-danger text-white"
          onConfirm={() => {
            emit("combat:removeCombatant", { combatantId: removeId });
            setRemoveId(null);
          }}
          onCancel={() => setRemoveId(null)}
        />
      )}

      {/* End combat confirm */}
      {endConfirm && (
        <ConfirmDialog
          message="End this encounter? All combatants will be preserved for history."
          confirmLabel="End Combat"
          confirmClass="bg-danger text-white"
          onConfirm={() => {
            emit("combat:endEncounter", { encounterId: encounter.id });
            setEndConfirm(false);
          }}
          onCancel={() => setEndConfirm(false)}
        />
      )}

      {/* Add Combatant panel */}
      {addOpen && (
        <AddCombatantPanel
          campaignId={campaignId}
          encounterId={encounter.id}
          characters={characters}
          monsters={monsters}
          tab={addTab}
          search={addSearch}
          initiative={addInitiative}
          onTabChange={setAddTab}
          onSearchChange={setAddSearch}
          onInitiativeChange={setAddInitiative}
          onAdd={(payload) => {
            emit("combat:addCombatant", { encounterId: encounter.id, ...payload });
            setAddOpen(false);
            setAddInitiative("");
          }}
          onClose={() => setAddOpen(false)}
        />
      )}
    </section>
  );
}

// ── CombatantRow ──────────────────────────────────────────────────────────
function CombatantRow({
  combatant: c,
  isActive,
  isDM,
  canMoveUp,
  canMoveDown,
  dmgValue,
  healValue,
  onDmgChange,
  onHealChange,
  onApplyDmg,
  onApplyHeal,
  onCondPicker,
  onRemove,
  onSetActive,
  onMoveUp,
  onMoveDown,
  initiativeInput,
}: {
  combatant: CombatantView;
  isActive: boolean;
  isDM: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  dmgValue: string;
  healValue: string;
  onDmgChange: (v: string) => void;
  onHealChange: (v: string) => void;
  onApplyDmg: () => void;
  onApplyHeal: () => void;
  onCondPicker: () => void;
  onRemove: () => void;
  onSetActive: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  initiativeInput?: React.ReactNode | null;
}) {
  const hpPct = c.maxHp > 0 ? (c.currentHp / c.maxHp) * 100 : 0;
  const isKO = c.currentHp === 0;

  return (
    <div
      className={`px-4 py-3 transition-colors ${
        isActive
          ? "bg-surface-raised border-l-4 border-l-accent"
          : "border-l-4 border-l-transparent"
      } ${c.removed ? "opacity-40" : ""}`}
    >
      <div className="flex items-start gap-3">
        {/* Initiative badge + reorder */}
        <div className="flex flex-col items-center gap-0.5 flex-shrink-0">
          {canMoveUp && (
            <button onClick={onMoveUp} className="text-faint hover:text-muted" aria-label="Move up">
              <ChevronUp className="w-3 h-3" />
            </button>
          )}
          <span
            className={`font-mono text-sm font-bold w-9 h-9 rounded flex items-center justify-center border ${
              isActive
                ? "border-accent text-accent bg-accent/10"
                : "border-border text-muted"
            }`}
            title="Initiative"
          >
            {c.initiative ?? "—"}
          </span>
          {canMoveDown && (
            <button onClick={onMoveDown} className="text-faint hover:text-muted" aria-label="Move down">
              <ChevronDown className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Center: name + HP + conditions */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1">
            {c.type === "monster" ? (
              <Bug className="w-3.5 h-3.5 text-danger flex-shrink-0" aria-label="Monster" />
            ) : (
              <User className="w-3.5 h-3.5 text-arcane flex-shrink-0" aria-label="Character" />
            )}
            <span className="font-medium text-sm truncate">{c.name}</span>
            {isActive && (
              <span className="text-xs text-accent font-semibold ml-1">▶ Active</span>
            )}
            {isKO && (
              <span className="text-xs text-danger font-bold ml-1 border border-danger/40 rounded px-1">
                KO
              </span>
            )}
          </div>

          {/* HP bar */}
          <div className="flex items-center gap-2 mb-1.5">
            <div className="flex-1 h-1.5 bg-surface-raised rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-[width] duration-300"
                style={{
                  width: `${hpPct}%`,
                  backgroundColor: isKO
                    ? undefined
                    : hpBarColor(c.currentHp, c.maxHp),
                  backgroundImage: isKO
                    ? "repeating-linear-gradient(45deg,#EF4444 0,#EF4444 3px,transparent 3px,transparent 6px)"
                    : undefined,
                }}
              />
            </div>
            <span className={`font-mono text-xs font-semibold ${hpColor(c.currentHp, c.maxHp)}`}>
              {c.currentHp}/{c.maxHp}
            </span>
          </div>

          {/* Condition badges */}
          {c.conditions.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {c.conditions.map((cond) => {
                const meta = CONDITION_META[cond.name];
                const label =
                  cond.name === "Exhaustion"
                    ? `EXH ${(cond as { level?: number }).level ?? 1}`
                    : meta.abbr;
                return (
                  <span
                    key={cond.name}
                    title={`${cond.name}: ${meta.effect}`}
                    className="text-xs rounded px-1.5 py-0.5 font-mono font-semibold"
                    style={{ backgroundColor: meta.color + "33", color: meta.color, border: `1px solid ${meta.color}55` }}
                  >
                    {label}
                  </span>
                );
              })}
            </div>
          )}

          {/* Initiative input for waiting combatants */}
          {initiativeInput && <div className="mt-1.5">{initiativeInput}</div>}
        </div>

        {/* Right: DM controls */}
        {isDM && (
          <div className="flex flex-col gap-1.5 flex-shrink-0">
            {/* Damage row */}
            <div className="flex items-center gap-1">
              <input
                type="number"
                min="1"
                value={dmgValue}
                onChange={(e) => onDmgChange(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && onApplyDmg()}
                placeholder="dmg"
                className="w-14 rounded border border-border bg-bg px-1.5 py-1 text-xs font-mono text-center focus:border-danger focus:outline-none"
                aria-label={`Damage for ${c.name}`}
              />
              <button
                onClick={onApplyDmg}
                className="rounded border border-danger/40 bg-danger/10 text-danger px-1.5 py-1 text-xs hover:bg-danger/20 transition-colors"
                title="Apply damage"
              >
                Dmg
              </button>
            </div>
            {/* Heal row */}
            <div className="flex items-center gap-1">
              <input
                type="number"
                min="1"
                value={healValue}
                onChange={(e) => onHealChange(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && onApplyHeal()}
                placeholder="heal"
                className="w-14 rounded border border-border bg-bg px-1.5 py-1 text-xs font-mono text-center focus:border-success focus:outline-none"
                aria-label={`Heal for ${c.name}`}
              />
              <button
                onClick={onApplyHeal}
                className="rounded border border-success/40 bg-success/10 text-success px-1.5 py-1 text-xs hover:bg-success/20 transition-colors"
                title="Apply healing"
              >
                Heal
              </button>
            </div>
            {/* Icon buttons */}
            <div className="flex items-center gap-1 mt-0.5">
              <button
                onClick={onCondPicker}
                title="Conditions"
                className="rounded border border-border p-1 text-muted hover:text-arcane hover:border-arcane/40 transition-colors"
                aria-label={`Conditions for ${c.name}`}
              >
                <Plus className="w-3 h-3" />
              </button>
              {c.initiative !== null && (
                <button
                  onClick={onSetActive}
                  title="Set active turn"
                  className="rounded border border-border p-1 text-muted hover:text-accent hover:border-accent/40 transition-colors"
                  aria-label={`Set active turn to ${c.name}`}
                >
                  <Target className="w-3 h-3" />
                </button>
              )}
              <button
                onClick={onRemove}
                title="Remove combatant"
                className="rounded border border-border p-1 text-muted hover:text-danger hover:border-danger/40 transition-colors"
                aria-label={`Remove ${c.name}`}
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── InitiativeInput ───────────────────────────────────────────────────────
function InitiativeInput({
  combatantId,
  onSet,
}: {
  combatantId: string;
  onSet: (value: number) => void;
}) {
  const [val, setVal] = useState("");
  return (
    <div className="flex items-center gap-1">
      <input
        type="number"
        min="1"
        max="30"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        placeholder="1–30"
        className="w-16 rounded border border-border bg-bg px-1.5 py-1 text-xs font-mono focus:border-accent focus:outline-none"
        aria-label="Set initiative"
      />
      <button
        onClick={() => {
          const n = parseInt(val);
          if (!isNaN(n) && n >= 1 && n <= 30) { onSet(n); setVal(""); }
        }}
        className="rounded border border-accent/40 bg-accent/10 text-accent px-2 py-1 text-xs hover:bg-accent/20 transition-colors"
      >
        Set
      </button>
    </div>
  );
}

// ── ConditionPicker ───────────────────────────────────────────────────────
function ConditionPicker({
  combatantId,
  activeConditions,
  onToggle,
  onClose,
}: {
  combatantId: string;
  activeConditions: ConditionEntry[];
  onToggle: (condition: Condition) => void;
  onClose: () => void;
}) {
  const activeNames = new Set(activeConditions.map((c) => c.name));
  const exhaustionEntry = activeConditions.find((c) => c.name === "Exhaustion") as
    | { name: "Exhaustion"; level: number }
    | undefined;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Condition picker"
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] max-w-md rounded-lg border border-border bg-surface p-5 max-h-[80vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between mb-4">
          <h4 className="font-semibold">Conditions</h4>
          <button onClick={onClose} className="text-muted hover:text-text" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {ALL_CONDITIONS.filter((c) => c !== "Exhaustion").map((condition) => {
            const meta = CONDITION_META[condition];
            const active = activeNames.has(condition);
            return (
              <button
                key={condition}
                onClick={() => onToggle(condition)}
                title={meta.effect}
                className={`rounded border p-2 text-left transition-colors ${
                  active
                    ? "border-accent bg-accent/10"
                    : "border-border bg-surface-raised hover:border-border/80"
                }`}
              >
                <div className="flex items-center justify-between mb-0.5">
                  <span
                    className="text-xs font-mono font-bold"
                    style={{ color: meta.color }}
                  >
                    {meta.abbr}
                  </span>
                  {active && <CheckCircle2 className="w-3 h-3 text-accent" />}
                </div>
                <span className="text-xs text-muted block truncate">{condition}</span>
              </button>
            );
          })}

          {/* Exhaustion — full-width special row */}
          <div
            className={`col-span-3 rounded border p-2.5 flex items-center gap-3 ${
              activeNames.has("Exhaustion") ? "border-accent bg-accent/10" : "border-border bg-surface-raised"
            }`}
          >
            <div className="flex-1">
              <span className="text-xs font-mono font-bold" style={{ color: "#F59E0B" }}>
                EXH
              </span>
              <span className="text-xs text-muted ml-2">Exhaustion</span>
              {exhaustionEntry && (
                <span className="text-xs text-accent font-mono ml-2">
                  Level {exhaustionEntry.level}/6
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => onToggle("Exhaustion")} // removes one level
                disabled={!activeNames.has("Exhaustion")}
                className="w-7 h-7 rounded border border-border text-muted hover:text-danger hover:border-danger/40 flex items-center justify-center text-sm disabled:opacity-30"
                aria-label="Remove exhaustion level"
              >
                −
              </button>
              <span className="font-mono text-sm font-bold w-4 text-center">
                {exhaustionEntry?.level ?? 0}
              </span>
              <button
                onClick={() => onToggle("Exhaustion")} // adds one level
                className="w-7 h-7 rounded border border-border text-muted hover:text-accent hover:border-accent/40 flex items-center justify-center text-sm"
                aria-label="Add exhaustion level"
              >
                +
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── StartCombatModal ──────────────────────────────────────────────────────
function StartCombatModal({
  name,
  onNameChange,
  onConfirm,
  onCancel,
}: {
  name: string;
  onNameChange: (v: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/60" onClick={onCancel} />
      <div
        role="dialog"
        aria-modal="true"
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] max-w-sm rounded-lg border border-border bg-surface p-6"
      >
        <h4 className="font-display font-semibold text-accent mb-4">Start Combat</h4>
        <label className="block text-sm text-muted mb-1">Encounter name (optional)</label>
        <input
          autoFocus
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          maxLength={80}
          placeholder="e.g. Goblin Ambush"
          className="w-full rounded border border-border bg-bg px-3 py-2 text-sm mb-5 focus:border-accent focus:outline-none"
          onKeyDown={(e) => e.key === "Enter" && onConfirm()}
        />
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="rounded border border-border px-4 py-2 text-sm hover:bg-surface-raised"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="rounded bg-accent text-bg font-semibold px-4 py-2 text-sm hover:bg-accent-hover"
          >
            ⚔ Start Combat
          </button>
        </div>
      </div>
    </div>
  );
}

// ── AddCombatantPanel ─────────────────────────────────────────────────────
function AddCombatantPanel({
  campaignId,
  encounterId,
  characters,
  monsters,
  tab,
  search,
  initiative,
  onTabChange,
  onSearchChange,
  onInitiativeChange,
  onAdd,
  onClose,
}: {
  campaignId: string;
  encounterId: string;
  characters: CharRef[];
  monsters: MonsterRef[];
  tab: "characters" | "monsters";
  search: string;
  initiative: string;
  onTabChange: (t: "characters" | "monsters") => void;
  onSearchChange: (v: string) => void;
  onInitiativeChange: (v: string) => void;
  onAdd: (payload: Record<string, unknown>) => void;
  onClose: () => void;
}) {
  const filteredChars = characters.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()),
  );
  const initVal = parseInt(initiative);
  const initOk = !initiative || (Number.isInteger(initVal) && initVal >= 1 && initVal <= 30);

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] max-w-md rounded-lg border border-border bg-surface p-5 max-h-[80vh] flex flex-col"
      >
        <div className="flex items-center justify-between mb-4">
          <h4 className="font-semibold">Add Combatant</h4>
          <button onClick={onClose} className="text-muted hover:text-text" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-3">
          {(["characters", "monsters"] as const).map((t) => (
            <button
              key={t}
              onClick={() => { onTabChange(t); onSearchChange(""); }}
              className={`flex-1 py-1.5 text-sm rounded transition-colors ${
                tab === t ? "bg-accent text-bg font-semibold" : "text-muted hover:text-text"
              }`}
            >
              {t === "characters" ? "Characters" : "Monsters"}
            </button>
          ))}
        </div>

        {/* Search */}
        <input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={tab === "characters" ? "Filter characters…" : "Search monsters…"}
          className="w-full rounded border border-border bg-bg px-3 py-2 text-sm mb-2 focus:border-accent focus:outline-none"
        />

        {/* Initiative input */}
        <div className="flex items-center gap-2 mb-3">
          <label className="text-xs text-muted w-24">Initiative (1–30)</label>
          <input
            type="number"
            min="1"
            max="30"
            value={initiative}
            onChange={(e) => onInitiativeChange(e.target.value)}
            placeholder="optional"
            className={`w-24 rounded border px-2 py-1 text-xs font-mono focus:outline-none ${
              initOk ? "border-border bg-bg focus:border-accent" : "border-danger bg-danger/10"
            }`}
          />
        </div>

        {/* List */}
        <div className="overflow-y-auto flex-1 space-y-1">
          {tab === "characters" &&
            filteredChars.map((c) => (
              <button
                key={c.id}
                onClick={() =>
                  initOk &&
                  onAdd({
                    type: "character",
                    characterId: c.id,
                    initiative: initiative ? parseInt(initiative) : undefined,
                  })
                }
                className="w-full flex items-center gap-3 rounded border border-border bg-surface-raised px-3 py-2 text-left hover:border-accent/40 transition-colors disabled:opacity-50"
                disabled={!initOk}
              >
                <User className="w-4 h-4 text-arcane flex-shrink-0" aria-hidden />
                <span className="text-sm">{c.name}</span>
                <span className="ml-auto font-mono text-xs text-muted">
                  {c.currentHp}/{c.maxHp} HP
                </span>
              </button>
            ))}

          {tab === "monsters" &&
            monsters.map((m) => (
              <button
                key={m.slug}
                onClick={() =>
                  initOk &&
                  onAdd({
                    type: "monster",
                    monsterSlug: m.slug,
                    initiative: initiative ? parseInt(initiative) : undefined,
                  })
                }
                className="w-full flex items-center gap-3 rounded border border-border bg-surface-raised px-3 py-2 text-left hover:border-accent/40 transition-colors disabled:opacity-50"
                disabled={!initOk}
              >
                <Bug className="w-4 h-4 text-danger flex-shrink-0" aria-hidden />
                <span className="text-sm">{m.name}</span>
                <span className="ml-auto font-mono text-xs text-muted">
                  CR {m.cr} · {m.hp} HP
                </span>
              </button>
            ))}

          {tab === "characters" && filteredChars.length === 0 && (
            <p className="text-center text-muted text-sm py-4">No characters found.</p>
          )}
          {tab === "monsters" && monsters.length === 0 && (
            <p className="text-center text-muted text-sm py-4">
              {search ? "No monsters match." : "Type to search monsters."}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── ConfirmDialog ─────────────────────────────────────────────────────────
function ConfirmDialog({
  message,
  confirmLabel,
  confirmClass,
  onConfirm,
  onCancel,
}: {
  message: string;
  confirmLabel: string;
  confirmClass: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/50" onClick={onCancel} />
      <div
        role="dialog"
        aria-modal="true"
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] max-w-sm rounded-lg border border-border bg-surface p-6"
      >
        <div className="flex items-start gap-3 mb-4">
          <AlertCircle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" aria-hidden />
          <p className="text-sm text-muted">{message}</p>
        </div>
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="rounded border border-border px-4 py-2 text-sm hover:bg-surface-raised"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`rounded px-4 py-2 text-sm font-semibold hover:opacity-90 ${confirmClass}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
