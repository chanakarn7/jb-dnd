import type { Server, Socket, DefaultEventsMap } from "socket.io";
import type { ClientToServerEvents, ServerToClientEvents, SocketData } from "@/lib/events";
import * as ws from "../state/workingSet";
import * as persist from "../state/persist";
import { roomName } from "./campaign";

// Session lifecycle: leave / disconnect presence (SA_BLUEPRINT §3.2, §4.4).
// Seat is preserved; only presence flips. Multi-tab: offline only when the LAST socket drops.

type FoundationServer = Server<ClientToServerEvents, ServerToClientEvents, DefaultEventsMap, SocketData>;
type FoundationSocket = Socket<ClientToServerEvents, ServerToClientEvents, DefaultEventsMap, SocketData>;

export function registerSessionHandlers(io: FoundationServer, socket: FoundationSocket): void {
  const handleOffline = async () => {
    const res = ws.detachSocket(socket.id);
    if (res?.nowOffline) {
      await persist.persistPresence(res.sessionId, false).catch(() => {});
      io.to(roomName(res.campaignId)).emit("roster:update", {
        participants: ws.getRosterView(res.campaignId),
      });
    }
  };

  socket.on("session:leave", handleOffline);
  socket.on("disconnect", handleOffline);
}
