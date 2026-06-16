import { Server as SocketIOServer } from "socket.io";
import type { Server as HttpServer } from "node:http";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  SocketAuth,
} from "@/lib/events";
import { registerCampaignHandlers } from "./handlers/campaign";
import { registerSessionHandlers } from "./handlers/session";

// Socket.io setup. Rooms are keyed by campaignId; every broadcast is scoped to one campaign.
// Multi-tenancy: a socket belongs to exactly one campaign room (joined on create/join/resume).

export function createIoServer(httpServer: HttpServer) {
  const io = new SocketIOServer<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    cors: { origin: true },
  });

  io.on("connection", (socket) => {
    const { sessionToken } = (socket.handshake.auth ?? {}) as SocketAuth;
    // /dev: resolve sessionToken -> { campaignId, sessionId, role }, join room `campaign:{id}`,
    // and emit state:snapshot on resume. For now we just register the intent handlers.
    void sessionToken;

    registerCampaignHandlers(socket);
    registerSessionHandlers(socket);
  });

  return io;
}
