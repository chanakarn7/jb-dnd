// File: server/dice.ts
// Socket.io intent handlers for the Dice module (Sprint 6).
// Pattern mirrors server/combat.ts: resolve session from handshake token → authz → service → broadcast.
// Public rolls: persist + broadcast to campaign room. Private rolls: no persist, sender only.
// Source: docs/modules/player-ui/SA_BLUEPRINT.md §5.6

import type { Server, Socket } from "socket.io";
import { resolveSessionByToken } from "@/lib/characters/auth";
import { rollDiceAction, getRollFeedAction } from "@/lib/player-ui/service";
import type { DiceRollPayload } from "@/lib/player-ui/service";

const ROOM = (campaignId: string) => `campaign:${campaignId}`;

function getToken(socket: Socket): string | undefined {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (socket.handshake.auth as any)?.sessionToken as string | undefined;
}

export function registerDiceHandlers(io: Server, socket: Socket): void {
  // ── dice:roll — public roll: persist + broadcast to room ─────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (socket as any).on("dice:roll", async (payload: DiceRollPayload) => {
    const session = await resolveSessionByToken(getToken(socket));
    if (!session) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (socket as any).emit("dice:error", { error: "unauthorized" });
    }

    const result = await rollDiceAction(session, { ...payload, isPrivate: false });
    if ("error" in result) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (socket as any).emit("dice:error", { error: result.error });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (io.to(ROOM(session.campaignId)) as any).emit("dice:result", { roll: result.view });
  });

  // ── dice:rollPrivate — DM-only: no persist, result to sender only ─────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (socket as any).on("dice:rollPrivate", async (payload: DiceRollPayload) => {
    const session = await resolveSessionByToken(getToken(socket));
    if (!session) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (socket as any).emit("dice:error", { error: "unauthorized" });
    }

    if (session.role !== "dm") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (socket as any).emit("dice:error", { error: "forbidden" });
    }

    const result = await rollDiceAction(session, { ...payload, isPrivate: true });
    if ("error" in result) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (socket as any).emit("dice:error", { error: result.error });
    }

    // Private: emit only to the sender
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (socket as any).emit("dice:privateResult", { roll: result.view });
  });

  // ── dice:feed — reconnect: send last 20 rolls to requesting socket only ───
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (socket as any).on("dice:feed", async () => {
    const session = await resolveSessionByToken(getToken(socket));
    if (!session) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (socket as any).emit("dice:error", { error: "unauthorized" });
    }

    const rolls = await getRollFeedAction(session);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (socket as any).emit("dice:feedResult", { rolls });
  });
}
