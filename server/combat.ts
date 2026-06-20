// File: server/combat.ts
// Socket.io intent handlers for the Combat module (Sprint 4).
// Pattern: resolve session from handshake token → authz → service → broadcast.
// All mutations broadcast to the campaign room; errors go to requesting socket only.
// Source: docs/modules/combat/SA_BLUEPRINT.md §3.2 + §5.3

import type { Server, Socket } from "socket.io";
import { resolveSessionByToken } from "@/lib/characters/auth";
import * as svc from "@/lib/combat/service";
import type { Condition } from "@/lib/combat/types";

const ROOM = (campaignId: string) => `campaign:${campaignId}`;

function emitError(
  socket: Socket,
  intent: string,
  error: string,
  message?: string,
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (socket as any).emit("combat:error", { intent, error, message: message ?? error });
}

/**
 * Registers all combat Socket.io intent handlers on the given socket.
 * Called from server/io.ts on every connection.
 */
export function registerCombatHandlers(io: Server, socket: Socket): void {
  // ── helpers ───────────────────────────────────────────────────────────

  async function getSession() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const token = (socket.handshake.auth as any)?.sessionToken as string | undefined;
    return resolveSessionByToken(token);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function broadcast(campaignId: string, event: string, payload: unknown) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (io.to(ROOM(campaignId)) as any).emit(event, payload);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function reply(event: string, payload: unknown) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (socket as any).emit(event, payload);
  }

  // ── combat:startEncounter ─────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (socket as any).on("combat:startEncounter", async (payload: { name?: string } = {}) => {
    const session = await getSession();
    if (!session) return emitError(socket, "combat:startEncounter", "unauthorized");
    const result = await svc.startEncounter(session, payload ?? {});
    if ("error" in result) return emitError(socket, "combat:startEncounter", result.error);
    broadcast(session.campaignId, "combat:encounterStarted", result);
  });

  // ── combat:endEncounter ───────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (socket as any).on("combat:endEncounter", async (payload: { encounterId: string }) => {
    const session = await getSession();
    if (!session) return emitError(socket, "combat:endEncounter", "unauthorized");
    const result = await svc.endEncounter(session, payload);
    if ("error" in result) return emitError(socket, "combat:endEncounter", result.error);
    broadcast(session.campaignId, "combat:encounterEnded", result);
  });

  // ── combat:addCombatant ───────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (socket as any).on("combat:addCombatant", async (payload: { encounterId: string } & Record<string, unknown>) => {
    const session = await getSession();
    if (!session) return emitError(socket, "combat:addCombatant", "unauthorized");
    const { encounterId, ...rest } = payload;
    const result = await svc.addCombatant(
      session,
      encounterId,
      rest as Parameters<typeof svc.addCombatant>[2],
    );
    if ("error" in result) return emitError(socket, "combat:addCombatant", result.error);
    broadcast(session.campaignId, "combat:combatantAdded", result);
  });

  // ── combat:removeCombatant ────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (socket as any).on("combat:removeCombatant", async (payload: { combatantId: string }) => {
    const session = await getSession();
    if (!session) return emitError(socket, "combat:removeCombatant", "unauthorized");
    const result = await svc.removeCombatant(session, payload);
    if ("error" in result) return emitError(socket, "combat:removeCombatant", result.error);
    if (result.turnAdvanced) {
      broadcast(session.campaignId, "combat:turnAdvanced", result.turnAdvanced);
    }
    broadcast(session.campaignId, "combat:combatantRemoved", { combatantId: result.combatantId });
  });

  // ── combat:setInitiative ──────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (socket as any).on("combat:setInitiative", async (payload: { combatantId: string; initiative: unknown }) => {
    const session = await getSession();
    if (!session) return emitError(socket, "combat:setInitiative", "unauthorized");
    const result = await svc.setInitiative(session, payload);
    if ("error" in result) return emitError(socket, "combat:setInitiative", result.error);
    broadcast(session.campaignId, "combat:initiativeSet", result);
  });

  // ── combat:reorderTie ─────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (socket as any).on("combat:reorderTie", async (payload: { encounterId: string; orderedIds: string[] }) => {
    const session = await getSession();
    if (!session) return emitError(socket, "combat:reorderTie", "unauthorized");
    const result = await svc.reorderTie(session, payload);
    if ("error" in result) return emitError(socket, "combat:reorderTie", result.error);
    broadcast(session.campaignId, "combat:orderUpdated", result);
  });

  // ── combat:applyDamage ────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (socket as any).on("combat:applyDamage", async (payload: { combatantId: string; amount: unknown }) => {
    const session = await getSession();
    if (!session) return emitError(socket, "combat:applyDamage", "unauthorized");
    const result = await svc.applyDamageAction(session, payload);
    if ("error" in result) return emitError(socket, "combat:applyDamage", result.error);
    broadcast(session.campaignId, "combat:hpChanged", result.hpChanged);
    if (result.conditionsChanged) {
      broadcast(session.campaignId, "combat:conditionsChanged", result.conditionsChanged);
    }
  });

  // ── combat:applyHealing ───────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (socket as any).on("combat:applyHealing", async (payload: { combatantId: string; amount: unknown }) => {
    const session = await getSession();
    if (!session) return emitError(socket, "combat:applyHealing", "unauthorized");
    const result = await svc.applyHealingAction(session, payload);
    if ("error" in result) return emitError(socket, "combat:applyHealing", result.error);
    broadcast(session.campaignId, "combat:hpChanged", result.hpChanged);
  });

  // ── combat:addCondition ───────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (socket as any).on("combat:addCondition", async (payload: { combatantId: string; condition: Condition }) => {
    const session = await getSession();
    if (!session) return emitError(socket, "combat:addCondition", "unauthorized");
    const result = await svc.addConditionAction(session, payload);
    if ("error" in result) return emitError(socket, "combat:addCondition", result.error);
    broadcast(session.campaignId, "combat:conditionsChanged", result);
  });

  // ── combat:removeCondition ────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (socket as any).on("combat:removeCondition", async (payload: { combatantId: string; condition: Condition }) => {
    const session = await getSession();
    if (!session) return emitError(socket, "combat:removeCondition", "unauthorized");
    const result = await svc.removeConditionAction(session, payload);
    if ("error" in result) return emitError(socket, "combat:removeCondition", result.error);
    broadcast(session.campaignId, "combat:conditionsChanged", result);
  });

  // ── combat:nextTurn ───────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (socket as any).on("combat:nextTurn", async (payload: { encounterId: string }) => {
    const session = await getSession();
    if (!session) return emitError(socket, "combat:nextTurn", "unauthorized");
    const result = await svc.nextTurnAction(session, payload);
    if ("error" in result) return emitError(socket, "combat:nextTurn", result.error);
    broadcast(session.campaignId, "combat:turnAdvanced", result);
  });

  // ── combat:setTurn ────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (socket as any).on("combat:setTurn", async (payload: { encounterId: string; combatantId: string }) => {
    const session = await getSession();
    if (!session) return emitError(socket, "combat:setTurn", "unauthorized");
    const result = await svc.setTurnAction(session, payload);
    if ("error" in result) return emitError(socket, "combat:setTurn", result.error);
    broadcast(session.campaignId, "combat:turnAdvanced", result);
  });

  // ── combat:requestSnapshot ────────────────────────────────────────────
  // Unicast to requesting socket only (reconnect path). PRD §3.7 + edge 5.12.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (socket as any).on("combat:requestSnapshot", async (payload: { encounterId?: string } = {}) => {
    const session = await getSession();
    if (!session) return emitError(socket, "combat:requestSnapshot", "unauthorized");
    const result = await svc.requestSnapshotAction(session, payload ?? {});
    if ("error" in result) return emitError(socket, "combat:requestSnapshot", result.error);
    reply("combat:snapshot", result);
  });
}
