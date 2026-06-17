import type { Server, Socket, DefaultEventsMap } from "socket.io";
import type { ClientToServerEvents, ServerToClientEvents, SocketData } from "@/lib/events";
import * as ws from "../state/workingSet";
import * as service from "../state/campaignService";

// Campaign intents (SA_BLUEPRINT §3.2). Each: service (validate→authorize→mutate→persist) then broadcast.

type FoundationServer = Server<ClientToServerEvents, ServerToClientEvents, DefaultEventsMap, SocketData>;
type FoundationSocket = Socket<ClientToServerEvents, ServerToClientEvents, DefaultEventsMap, SocketData>;

export const roomName = (campaignId: string) => `campaign:${campaignId}`;

export function registerCampaignHandlers(io: FoundationServer, socket: FoundationSocket): void {
  socket.on("campaign:create", async (payload, ack) => {
    const r = await service.createCampaign(payload);
    if (!r.ok) return ack?.(r);
    ws.attachSocket(r.token, socket.id);
    socket.data.identity = { campaignId: r.campaignId, sessionId: r.sessionId, role: "dm" };
    await socket.join(roomName(r.campaignId));
    ack?.({ ok: true, token: r.token, sessionId: r.sessionId, state: ws.getStateView(r.campaignId)! });
  });

  socket.on("campaign:join", async (payload, ack) => {
    const r = await service.joinCampaign(payload);
    if (!r.ok) return ack?.(r);
    ws.attachSocket(r.token, socket.id);
    socket.data.identity = { campaignId: r.campaignId, sessionId: r.sessionId, role: "player" };
    await socket.join(roomName(r.campaignId));
    ack?.({ ok: true, token: r.token, sessionId: r.sessionId, state: ws.getStateView(r.campaignId)! });
    io.to(roomName(r.campaignId)).emit("roster:update", { participants: ws.getRosterView(r.campaignId) });
  });

  socket.on("campaign:rename", async (payload, ack) => {
    const r = await service.renameCampaign(socket.data.identity, payload);
    if (!r.ok) return ack?.(r);
    ack?.({ ok: true });
    io.to(roomName(r.campaignId)).emit("state:patch", { path: "name", value: r.name });
  });

  socket.on("participant:remove", async (payload, ack) => {
    const r = await service.removeParticipant(socket.data.identity, payload);
    if (!r.ok) return ack?.(r);
    ack?.({ ok: true });
    for (const sid of r.kickedSocketIds) {
      io.to(sid).emit("session:kicked", { reason: "You were removed by the DM." });
    }
    io.to(roomName(r.campaignId)).emit("roster:update", { participants: ws.getRosterView(r.campaignId) });
  });
}
