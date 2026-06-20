// File: lib/combat/service.ts
// Orchestration layer: re-derives session authz → calls rules → calls repo.
// Never trusts client-supplied role or campaignId (ARCHITECTURE.md).
// Source: docs/modules/combat/SA_BLUEPRINT.md §5, PRD §2 + §5

import { prisma } from "@/lib/db";
import type { Session } from "@/lib/characters/service";
import * as repo from "./repo";
import {
  validateInitiative,
  validateHpDelta,
  applyDamage,
  applyHealing,
  parseConditions,
  applyCondition,
  removeCondition,
  shouldAutoUnconsciousOnKO,
  sortCombatants,
  advanceTurn,
  buildSnapshot,
} from "./rules";
import type { Condition, CombatErrorCode, EncounterSnapshot } from "./types";

function err(code: CombatErrorCode): { error: CombatErrorCode } {
  return { error: code };
}

/** Double gate: DM always; player only when flag=true AND it's their claimed character. */
async function canEditHp(
  session: Session,
  combatantCharacterId: string | null,
  allowPlayerHpEdit: boolean,
): Promise<boolean> {
  if (session.role === "dm") return true;
  if (!allowPlayerHpEdit) return false;
  const ps = await prisma.playerSession.findUnique({
    where: { id: session.sessionId },
    select: { characterId: true },
  });
  return ps?.characterId != null && combatantCharacterId === ps.characterId;
}

// ── Encounter lifecycle ───────────────────────────────────────────────────

export async function startEncounter(
  session: Session,
  payload: { name?: string },
): Promise<{ encounter: EncounterSnapshot } | { error: CombatErrorCode }> {
  if (session.role !== "dm") return err("forbidden");
  const existing = await repo.getActiveEncounter(session.campaignId);
  if (existing) return err("encounter_already_active");
  const encounter = await repo.createEncounter(session.campaignId, payload.name);
  return { encounter: buildSnapshot(encounter, []) };
}

export async function endEncounter(
  session: Session,
  payload: { encounterId: string },
): Promise<{ encounterId: string } | { error: CombatErrorCode }> {
  if (session.role !== "dm") return err("forbidden");
  const enc = await repo.getEncounterById(session.campaignId, payload.encounterId);
  if (!enc) return err("not_found");
  await repo.updateEncounter(enc.id, { status: "ended" });
  return { encounterId: enc.id };
}

// ── Combatant management ─────────────────────────────────────────────────

type AddCombatantPayload =
  | { type: "character"; characterId: string; initiative?: number | null }
  | { type: "monster"; monsterSlug: string; name?: string; initiative?: number | null };

export async function addCombatant(
  session: Session,
  encounterId: string,
  payload: AddCombatantPayload,
): Promise<{ combatant: import("@prisma/client").Combatant } | { error: CombatErrorCode }> {
  if (session.role !== "dm") return err("forbidden");

  const encounter = await repo.getEncounterById(session.campaignId, encounterId);
  if (!encounter) return err("not_found");

  if (payload.initiative != null && !validateInitiative(payload.initiative)) {
    return err("invalid_initiative");
  }

  if (payload.type === "character") {
    const character = await prisma.character.findFirst({
      where: { id: payload.characterId, campaignId: session.campaignId },
    });
    if (!character) return err("character_not_found");

    try {
      const combatant = await repo.createCombatant({
        encounterId,
        campaignId: session.campaignId,
        type: "character",
        characterId: character.id,
        name: character.name,
        initiative: payload.initiative ?? null,
        maxHp: character.maxHp,
        currentHp: character.currentHp,
      });
      return { combatant };
    } catch (e: unknown) {
      // @@unique([encounterId, characterId]) violation
      if ((e as { code?: string }).code === "P2002") return err("duplicate_combatant");
      throw e;
    }
  } else {
    const monster = await prisma.monster.findUnique({
      where: { slug: payload.monsterSlug },
    });
    if (!monster) return err("monster_not_found");

    const combatant = await repo.createCombatant({
      encounterId,
      campaignId: session.campaignId,
      type: "monster",
      monsterSlug: monster.slug,
      name: payload.name ?? monster.name,
      initiative: payload.initiative ?? null,
      maxHp: monster.hp,
      currentHp: monster.hp,
    });
    return { combatant };
  }
}

export async function removeCombatant(
  session: Session,
  payload: { combatantId: string },
): Promise<
  | { combatantId: string; turnAdvanced?: { currentTurnIndex: number; round: number; activeCombatantId: string | null } }
  | { error: CombatErrorCode }
> {
  if (session.role !== "dm") return err("forbidden");

  const combatant = await repo.getCombatant(session.campaignId, payload.combatantId);
  if (!combatant) return err("not_found");

  const encounter = await repo.getEncounterById(session.campaignId, combatant.encounterId);
  if (!encounter) return err("not_found");

  // Determine if this combatant is the active one (edge 5.5)
  const snap = buildSnapshot(encounter, encounter.combatants);
  const activeCombatants = sortCombatants(snap.combatants);
  const activeCombatant = activeCombatants[encounter.currentTurnIndex];
  const isActiveTurn = activeCombatant?.id === payload.combatantId;

  // Soft-delete the combatant
  await repo.updateCombatant(payload.combatantId, { removed: true });

  let turnAdvanced: typeof undefined | { currentTurnIndex: number; round: number; activeCombatantId: string | null };

  if (isActiveTurn) {
    // Recalculate active list without the removed combatant
    const remainingActive = activeCombatants.filter((c) => c.id !== payload.combatantId);
    if (remainingActive.length > 0) {
      const nextIdx = encounter.currentTurnIndex % remainingActive.length;
      await repo.updateEncounter(encounter.id, { currentTurnIndex: nextIdx });
      turnAdvanced = {
        currentTurnIndex: nextIdx,
        round: encounter.round,
        activeCombatantId: remainingActive[nextIdx]?.id ?? null,
      };
    } else {
      await repo.updateEncounter(encounter.id, { currentTurnIndex: 0 });
      turnAdvanced = { currentTurnIndex: 0, round: encounter.round, activeCombatantId: null };
    }
  }

  return { combatantId: payload.combatantId, turnAdvanced };
}

// ── Initiative ────────────────────────────────────────────────────────────

export async function setInitiative(
  session: Session,
  payload: { combatantId: string; initiative: unknown },
): Promise<{ combatantId: string; initiative: number } | { error: CombatErrorCode }> {
  if (session.role !== "dm") return err("forbidden");
  if (!validateInitiative(payload.initiative)) return err("invalid_initiative");

  const combatant = await repo.getCombatant(session.campaignId, payload.combatantId);
  if (!combatant) return err("not_found");

  await repo.updateCombatant(payload.combatantId, { initiative: payload.initiative });
  return { combatantId: payload.combatantId, initiative: payload.initiative };
}

export async function reorderTie(
  session: Session,
  payload: { encounterId: string; orderedIds: string[] },
): Promise<{ order: Array<{ id: string; initiativeOrder: number }> } | { error: CombatErrorCode }> {
  if (session.role !== "dm") return err("forbidden");

  const encounter = await repo.getEncounterById(session.campaignId, payload.encounterId);
  if (!encounter) return err("not_found");

  const updates = payload.orderedIds.map((id, idx) => ({ id, initiativeOrder: idx }));
  await repo.updateManyCombatantOrders(updates);
  return { order: updates };
}

// ── HP tracking ───────────────────────────────────────────────────────────

export async function applyDamageAction(
  session: Session,
  payload: { combatantId: string; amount: unknown },
): Promise<
  | { hpChanged: { combatantId: string; currentHp: number }; conditionsChanged?: { combatantId: string; conditions: import("./types").ConditionEntry[] } }
  | { error: CombatErrorCode }
> {
  if (!validateHpDelta(payload.amount)) return err("invalid_hp_delta");

  const combatant = await repo.getCombatant(session.campaignId, payload.combatantId);
  if (!combatant) return err("not_found");

  const encounter = await repo.getEncounterById(session.campaignId, combatant.encounterId);
  if (!encounter) return err("not_found");

  if (!(await canEditHp(session, combatant.characterId, encounter.allowPlayerHpEdit))) {
    return err("forbidden");
  }

  const newHp = applyDamage(combatant.currentHp, payload.amount);
  const currentConditions = parseConditions(combatant.conditionsJson);

  let updatedConditions = currentConditions;
  let autoUnconsciousApplied = false;

  if (shouldAutoUnconsciousOnKO(currentConditions, newHp)) {
    updatedConditions = applyCondition(currentConditions, "Unconscious");
    autoUnconsciousApplied = true;
  }

  await repo.updateCombatant(payload.combatantId, {
    currentHp: newHp,
    conditionsJson: JSON.stringify(updatedConditions),
  });

  return {
    hpChanged: { combatantId: payload.combatantId, currentHp: newHp },
    conditionsChanged: autoUnconsciousApplied
      ? { combatantId: payload.combatantId, conditions: updatedConditions }
      : undefined,
  };
}

export async function applyHealingAction(
  session: Session,
  payload: { combatantId: string; amount: unknown },
): Promise<{ hpChanged: { combatantId: string; currentHp: number } } | { error: CombatErrorCode }> {
  if (!validateHpDelta(payload.amount)) return err("invalid_hp_delta");

  const combatant = await repo.getCombatant(session.campaignId, payload.combatantId);
  if (!combatant) return err("not_found");

  const encounter = await repo.getEncounterById(session.campaignId, combatant.encounterId);
  if (!encounter) return err("not_found");

  if (!(await canEditHp(session, combatant.characterId, encounter.allowPlayerHpEdit))) {
    return err("forbidden");
  }

  const newHp = applyHealing(combatant.currentHp, payload.amount, combatant.maxHp);
  await repo.updateCombatant(payload.combatantId, { currentHp: newHp });

  return { hpChanged: { combatantId: payload.combatantId, currentHp: newHp } };
}

// ── Conditions ────────────────────────────────────────────────────────────

export async function addConditionAction(
  session: Session,
  payload: { combatantId: string; condition: Condition },
): Promise<
  { combatantId: string; conditions: import("./types").ConditionEntry[] } | { error: CombatErrorCode }
> {
  if (session.role !== "dm") return err("forbidden");

  const combatant = await repo.getCombatant(session.campaignId, payload.combatantId);
  if (!combatant) return err("not_found");

  const current = parseConditions(combatant.conditionsJson);
  const updated = applyCondition(current, payload.condition);
  await repo.updateCombatant(payload.combatantId, { conditionsJson: JSON.stringify(updated) });

  return { combatantId: payload.combatantId, conditions: updated };
}

export async function removeConditionAction(
  session: Session,
  payload: { combatantId: string; condition: Condition },
): Promise<
  { combatantId: string; conditions: import("./types").ConditionEntry[] } | { error: CombatErrorCode }
> {
  if (session.role !== "dm") return err("forbidden");

  const combatant = await repo.getCombatant(session.campaignId, payload.combatantId);
  if (!combatant) return err("not_found");

  const current = parseConditions(combatant.conditionsJson);
  const updated = removeCondition(current, payload.condition);
  await repo.updateCombatant(payload.combatantId, { conditionsJson: JSON.stringify(updated) });

  return { combatantId: payload.combatantId, conditions: updated };
}

// ── Turn management ───────────────────────────────────────────────────────

export async function nextTurnAction(
  session: Session,
  payload: { encounterId: string },
): Promise<
  { currentTurnIndex: number; round: number; activeCombatantId: string | null } | { error: CombatErrorCode }
> {
  if (session.role !== "dm") return err("forbidden");

  const encounter = await repo.getEncounterById(session.campaignId, payload.encounterId);
  if (!encounter) return err("not_found");

  const snap = buildSnapshot(encounter, encounter.combatants);
  const activeCombatants = sortCombatants(snap.combatants);

  if (activeCombatants.length === 0) return err("no_active_combatants");

  const { nextIndex, roundIncrement } = advanceTurn(
    encounter.currentTurnIndex,
    activeCombatants.length,
  );
  const newRound = encounter.round + (roundIncrement ? 1 : 0);

  await repo.updateEncounter(encounter.id, {
    currentTurnIndex: nextIndex,
    round: newRound,
  });

  return {
    currentTurnIndex: nextIndex,
    round: newRound,
    activeCombatantId: activeCombatants[nextIndex]?.id ?? null,
  };
}

export async function setTurnAction(
  session: Session,
  payload: { encounterId: string; combatantId: string },
): Promise<
  { currentTurnIndex: number; round: number; activeCombatantId: string | null } | { error: CombatErrorCode }
> {
  if (session.role !== "dm") return err("forbidden");

  const encounter = await repo.getEncounterById(session.campaignId, payload.encounterId);
  if (!encounter) return err("not_found");

  const snap = buildSnapshot(encounter, encounter.combatants);
  const activeCombatants = sortCombatants(snap.combatants);
  const idx = activeCombatants.findIndex((c) => c.id === payload.combatantId);
  if (idx === -1) return err("not_found");

  await repo.updateEncounter(encounter.id, { currentTurnIndex: idx });

  return {
    currentTurnIndex: idx,
    round: encounter.round,
    activeCombatantId: payload.combatantId,
  };
}

// ── Reconnect snapshot ────────────────────────────────────────────────────

export async function requestSnapshotAction(
  session: Session,
  payload: { encounterId?: string },
): Promise<{ encounter: EncounterSnapshot | null } | { error: CombatErrorCode }> {
  const encounter = payload.encounterId
    ? await repo.getEncounterById(session.campaignId, payload.encounterId)
    : await repo.getActiveEncounter(session.campaignId);

  if (!encounter) return { encounter: null };
  return { encounter: buildSnapshot(encounter, encounter.combatants) };
}
