import type { Socket } from "socket.io";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  ErrorAck,
} from "@/lib/events";

// Campaign intents: create / join / rename / remove (SA_BLUEPRINT §3.2).
// STUB (scaffold): registration shape only. /dev implements validation + persist + broadcast.
//
// Pattern every handler follows:
//   1. Zod-validate payload (lib/validation.ts)
//   2. re-derive role/ownership/campaign-scope from the authenticated session (never the payload)
//   3. mutate in-memory working set -> persist to SQLite -> broadcast to room `campaign:{id}`

type FoundationSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

const notImplemented: ErrorAck = {
  ok: false,
  code: "INVALID_PAYLOAD",
  message: "Not implemented in scaffold — implemented in /dev.",
};

export function registerCampaignHandlers(socket: FoundationSocket): void {
  socket.on("campaign:create", (_payload, ack) => ack?.(notImplemented));
  socket.on("campaign:join", (_payload, ack) => ack?.(notImplemented));
  socket.on("campaign:rename", (_payload, ack) => ack?.(notImplemented));
  socket.on("participant:remove", (_payload, ack) => ack?.(notImplemented));
}
