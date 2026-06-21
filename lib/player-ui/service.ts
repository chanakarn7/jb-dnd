// File: lib/player-ui/service.ts
// Orchestration: resolveSession (from auth.ts) → authz → dice/search/dashboard logic → repo.
// Never trusts campaignId/role from client — always from session token (ARCHITECTURE.md).
// Source: docs/modules/player-ui/SA_BLUEPRINT.md §4 + §5.4

import { prisma } from "@/lib/db";
import type { Session } from "@/lib/characters/service";
import { parseFormula, rollFormula, rollAdvantage, rollDisadvantage, rollFromFaces } from "./dice";
import * as repo from "./repo";
import type { DiceRollView, DashboardSnapshot, QuickViewSnapshot, SearchResults } from "./types";

// ── Auth helpers ──────────────────────────────────────────────────────────────

function canWriteCharacter(
  session: Session,
  character: { campaignId: string; ownerSessionId: string | null },
): boolean {
  return (
    character.campaignId === session.campaignId &&
    (session.role === "dm" || character.ownerSessionId === session.sessionId)
  );
}

// ── Dice ──────────────────────────────────────────────────────────────────────

export interface DiceRollPayload {
  formula: string;
  context?: string | null;
  mode?: "normal" | "advantage" | "disadvantage";
  isPrivate?: boolean;
  /** Faces the 3D physics dice landed on (the client is the RNG). When present and
   *  valid, the server uses these faces and recomputes the total; otherwise it falls
   *  back to its own Math.random (e.g. REST callers, tests). */
  clientRolls?: number[];
}

export interface DiceRollResult {
  view: DiceRollView | Omit<DiceRollView, "id" | "createdAt">; // private = no id/createdAt
  persisted: boolean;
}

export async function rollDiceAction(
  session: Session,
  payload: DiceRollPayload,
): Promise<DiceRollResult | { error: string }> {
  const formula = (payload.formula ?? "").trim();
  const mode = payload.mode ?? "normal";
  const isPrivate = payload.isPrivate === true;

  // Private roll: DM only
  if (isPrivate && session.role !== "dm") return { error: "forbidden" };

  const parsed = parseFormula(formula);
  if (!parsed) return { error: "invalid_formula" };

  let rollResult;
  if (payload.clientRolls != null) {
    // Client's 3D dice are the RNG — validate the faces, recompute the total here.
    const fromFaces = rollFromFaces(parsed, mode, payload.clientRolls);
    if (!fromFaces) return { error: "invalid_rolls" };
    rollResult = fromFaces;
  } else if (mode === "advantage") {
    rollResult = rollAdvantage(parsed.modifier);
  } else if (mode === "disadvantage") {
    rollResult = rollDisadvantage(parsed.modifier);
  } else {
    rollResult = rollFormula(parsed);
  }

  const context = payload.context ? payload.context.slice(0, 80) : null;
  const keptRoll = rollResult.kept ?? null;

  if (isPrivate) {
    // Private: no persist, return without id
    const ps = await prisma.playerSession.findUnique({
      where: { id: session.sessionId },
      select: { displayName: true },
    });
    const view: Omit<DiceRollView, "id" | "createdAt"> = {
      campaignId: session.campaignId,
      playerSessionId: session.sessionId,
      playerName: ps?.displayName ?? "DM",
      formula,
      result: rollResult.total,
      rolls: rollResult.rolls,
      context,
      mode,
      keptRoll,
    };
    return { view, persisted: false };
  }

  const saved = await repo.saveDiceRoll({
    campaignId: session.campaignId,
    playerSessionId: session.sessionId,
    formula,
    result: rollResult.total,
    rolls: rollResult.rolls,
    context,
    mode,
    keptRoll,
  });

  return { view: saved, persisted: true };
}

export async function getRollFeedAction(session: Session): Promise<DiceRollView[]> {
  return repo.getRecentRolls(session.campaignId, 20);
}

// ── Search ────────────────────────────────────────────────────────────────────

export async function searchAction(
  session: Session,
  q: string,
): Promise<SearchResults | { error: string }> {
  if (!q || q.length < 2) return { error: "query_too_short" };
  if (q.length > 200) return { error: "query_too_long" };
  return repo.searchAll(session.campaignId, q);
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export async function getDashboardAction(
  session: Session,
): Promise<DashboardSnapshot | { error: string }> {
  if (session.role !== "dm") return { error: "forbidden" };
  return repo.getDashboardData(session.campaignId);
}

// ── Quick View ────────────────────────────────────────────────────────────────

export async function getQuickViewAction(
  session: Session,
  characterId: string,
): Promise<QuickViewSnapshot | { error: string }> {
  const character = await prisma.character.findFirst({
    where: { id: characterId, campaignId: session.campaignId },
    select: { campaignId: true, ownerSessionId: true },
  });
  if (!character) return { error: "not_found" };
  if (!canWriteCharacter(session, character)) return { error: "forbidden" };

  const snapshot = await repo.getQuickViewData(session.campaignId, characterId);
  if (!snapshot) return { error: "not_found" };
  return snapshot;
}

// ── HP Update ─────────────────────────────────────────────────────────────────

export async function updateHpAction(
  session: Session,
  characterId: string,
  hpCurrent: unknown,
): Promise<{ currentHp: number } | { error: string }> {
  if (typeof hpCurrent !== "number" || !Number.isInteger(hpCurrent)) {
    return { error: "invalid_hp" };
  }
  const character = await prisma.character.findFirst({
    where: { id: characterId, campaignId: session.campaignId },
    select: { campaignId: true, ownerSessionId: true },
  });
  if (!character) return { error: "not_found" };
  if (!canWriteCharacter(session, character)) return { error: "forbidden" };

  return repo.updateCharacterHp(session.campaignId, characterId, hpCurrent);
}

// ── Spell Slots Update ────────────────────────────────────────────────────────

export async function updateSpellSlotsAction(
  session: Session,
  characterId: string,
  spellSlotsUsed: unknown,
): Promise<{ ok: true } | { error: string }> {
  if (!spellSlotsUsed || typeof spellSlotsUsed !== "object" || Array.isArray(spellSlotsUsed)) {
    return { error: "invalid_spell_slots" };
  }
  const used = spellSlotsUsed as Record<string, unknown>;

  const character = await prisma.character.findFirst({
    where: { id: characterId, campaignId: session.campaignId },
    select: { campaignId: true, ownerSessionId: true, spellSlotsJson: true },
  });
  if (!character) return { error: "not_found" };
  if (!canWriteCharacter(session, character)) return { error: "forbidden" };

  const totals = JSON.parse(character.spellSlotsJson) as Record<string, number>;

  // Validate used ≤ total per level
  const validated: Record<string, number> = {};
  for (const [lvl, val] of Object.entries(used)) {
    if (typeof val !== "number" || !Number.isInteger(val) || val < 0) {
      return { error: `invalid_value_for_level_${lvl}` };
    }
    const total = totals[lvl] ?? 0;
    if (val > total) return { error: `slots_exceed_total_at_level_${lvl}` };
    validated[lvl] = val;
  }

  await repo.updateSpellSlotsUsed(session.campaignId, characterId, validated);
  return { ok: true };
}
