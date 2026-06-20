import { Server as SocketIOServer } from "socket.io";
import type { DefaultEventsMap } from "socket.io";
import type { Server as HttpServer } from "node:http";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  SocketAuth,
  SocketData,
} from "@/lib/events";
import * as ws from "./state/workingSet";
import * as persist from "./state/persist";
import { registerCampaignHandlers, roomName } from "./handlers/campaign";
import { registerSessionHandlers } from "./handlers/session";
import { registerCombatHandlers } from "./combat";

// Socket.io setup. Rooms are keyed by campaignId; every broadcast is scoped to one campaign.

export function createIoServer(httpServer: HttpServer) {
  const io = new SocketIOServer<
    ClientToServerEvents,
    ServerToClientEvents,
    DefaultEventsMap,
    SocketData
  >(httpServer, { cors: { origin: true } });

  io.on("connection", async (socket) => {
    const { sessionToken } = (socket.handshake.auth ?? {}) as SocketAuth;

    // Reconnect / resume: resolve the token, rejoin the room, send a full snapshot.
    if (sessionToken) {
      const identity = ws.attachSocket(sessionToken, socket.id);
      if (identity) {
        socket.data.identity = identity;
        await socket.join(roomName(identity.campaignId));
        const state = ws.getStateView(identity.campaignId);
        if (state) socket.emit("state:snapshot", state);
        await persist.persistPresence(identity.sessionId, true).catch(() => {});
        io.to(roomName(identity.campaignId)).emit("roster:update", {
          participants: ws.getRosterView(identity.campaignId),
        });
      }
    }

    registerCampaignHandlers(io, socket);
    registerSessionHandlers(io, socket);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    registerCombatHandlers(io as any, socket as any);
  });

  return io;
}
