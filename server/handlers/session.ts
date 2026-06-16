import type { Socket } from "socket.io";
import type { ClientToServerEvents, ServerToClientEvents } from "@/lib/events";

// Session lifecycle: resume (via handshake token) / leave / disconnect (SA_BLUEPRINT §3.2, §4.4).
// STUB (scaffold): registration shape only. /dev implements presence + snapshot-on-reconnect.

type FoundationSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

export function registerSessionHandlers(socket: FoundationSocket): void {
  socket.on("session:leave", () => {
    // /dev: mark session disconnected, broadcast roster:update.
  });
  socket.on("disconnect", () => {
    // /dev: decrement socket presence; if no sockets left, isConnected=false + roster:update.
  });
}
