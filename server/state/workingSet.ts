import type { CampaignState, ParticipantView, Role } from "@/lib/events";

// In-memory authoritative working set, keyed by campaignId (SA_BLUEPRINT §4.1).
// This is the LIVE truth during play; SQLite (persist.ts) is the DURABLE truth.
// Pure in-memory mutations live here so they can be unit-tested without sockets or a DB.

export interface ParticipantRuntime {
  sessionId: string;
  displayName: string;
  role: Role;
  characterId: string | null;
  sessionToken: string; // secret — never leaves the server in a broadcast
  socketIds: Set<string>; // live sockets for this session (multi-tab presence)
}

export interface CampaignRuntime {
  campaignId: string;
  name: string;
  status: "active" | "closed";
  inviteCode: string; // stored normalized (no dash)
  dmSessionToken: string;
  participants: Map<string, ParticipantRuntime>; // sessionId -> participant
}

// Indexes for O(1) resolution.
const campaigns = new Map<string, CampaignRuntime>();
const tokenIndex = new Map<string, { campaignId: string; sessionId: string }>();
const socketIndex = new Map<string, { campaignId: string; sessionId: string }>();

// ---------- creation / lookup ----------

export function createCampaignRuntime(input: {
  campaignId: string;
  name: string;
  inviteCode: string;
  dmSessionId: string;
  dmDisplayName: string;
  dmSessionToken: string;
}): CampaignRuntime {
  const dm: ParticipantRuntime = {
    sessionId: input.dmSessionId,
    displayName: input.dmDisplayName,
    role: "dm",
    characterId: null,
    sessionToken: input.dmSessionToken,
    socketIds: new Set(),
  };
  const runtime: CampaignRuntime = {
    campaignId: input.campaignId,
    name: input.name,
    status: "active",
    inviteCode: input.inviteCode,
    dmSessionToken: input.dmSessionToken,
    participants: new Map([[dm.sessionId, dm]]),
  };
  campaigns.set(runtime.campaignId, runtime);
  tokenIndex.set(input.dmSessionToken, {
    campaignId: runtime.campaignId,
    sessionId: dm.sessionId,
  });
  return runtime;
}

export function getCampaign(campaignId: string): CampaignRuntime | undefined {
  return campaigns.get(campaignId);
}

export function findCampaignByInviteCode(normalizedCode: string): CampaignRuntime | undefined {
  for (const c of campaigns.values()) {
    if (c.inviteCode === normalizedCode) return c;
  }
  return undefined;
}

export function isNameTaken(campaignId: string, displayName: string): boolean {
  const c = campaigns.get(campaignId);
  if (!c) return false;
  const lower = displayName.trim().toLowerCase();
  for (const p of c.participants.values()) {
    if (p.displayName.toLowerCase() === lower) return true;
  }
  return false;
}

// Look up a participant by (case-insensitive) display name. Used by rejoin-by-name
// so a returning player reconnects to their existing session — and thus their
// already-claimed character — instead of being blocked as a duplicate.
export function findParticipantByName(
  campaignId: string,
  displayName: string,
): ParticipantRuntime | undefined {
  const c = campaigns.get(campaignId);
  if (!c) return undefined;
  const lower = displayName.trim().toLowerCase();
  for (const p of c.participants.values()) {
    if (p.displayName.toLowerCase() === lower) return p;
  }
  return undefined;
}

// ---------- participant mutations ----------

export function addParticipant(
  campaignId: string,
  p: { sessionId: string; displayName: string; role: Role; sessionToken: string },
): ParticipantRuntime | undefined {
  const c = campaigns.get(campaignId);
  if (!c) return undefined;
  const participant: ParticipantRuntime = {
    sessionId: p.sessionId,
    displayName: p.displayName,
    role: p.role,
    characterId: null,
    sessionToken: p.sessionToken,
    socketIds: new Set(),
  };
  c.participants.set(participant.sessionId, participant);
  tokenIndex.set(p.sessionToken, { campaignId, sessionId: participant.sessionId });
  return participant;
}

export function removeParticipant(campaignId: string, sessionId: string): ParticipantRuntime | undefined {
  const c = campaigns.get(campaignId);
  if (!c) return undefined;
  const p = c.participants.get(sessionId);
  if (!p) return undefined;
  c.participants.delete(sessionId);
  tokenIndex.delete(p.sessionToken);
  for (const sid of p.socketIds) socketIndex.delete(sid);
  return p;
}

export function renameCampaign(campaignId: string, name: string): boolean {
  const c = campaigns.get(campaignId);
  if (!c) return false;
  c.name = name;
  return true;
}

// ---------- presence (derived from live sockets) ----------

/** Resolve a handshake token to its session, attach a socket, mark connected. */
export function attachSocket(
  sessionToken: string,
  socketId: string,
): { campaignId: string; sessionId: string; role: Role } | undefined {
  const ref = tokenIndex.get(sessionToken);
  if (!ref) return undefined;
  const c = campaigns.get(ref.campaignId);
  const p = c?.participants.get(ref.sessionId);
  if (!c || !p) return undefined;
  p.socketIds.add(socketId);
  socketIndex.set(socketId, { campaignId: ref.campaignId, sessionId: ref.sessionId });
  return { campaignId: ref.campaignId, sessionId: ref.sessionId, role: p.role };
}

/** Remove a socket; returns the affected session and whether it is now fully offline. */
export function detachSocket(
  socketId: string,
): { campaignId: string; sessionId: string; nowOffline: boolean } | undefined {
  const ref = socketIndex.get(socketId);
  if (!ref) return undefined;
  socketIndex.delete(socketId);
  const c = campaigns.get(ref.campaignId);
  const p = c?.participants.get(ref.sessionId);
  if (!c || !p) return undefined;
  p.socketIds.delete(socketId);
  return { campaignId: ref.campaignId, sessionId: ref.sessionId, nowOffline: p.socketIds.size === 0 };
}

export function isConnected(campaignId: string, sessionId: string): boolean {
  const p = campaigns.get(campaignId)?.participants.get(sessionId);
  return !!p && p.socketIds.size > 0;
}

export function getIdentityByToken(
  sessionToken: string,
): { campaignId: string; sessionId: string; role: Role } | undefined {
  const ref = tokenIndex.get(sessionToken);
  if (!ref) return undefined;
  const p = campaigns.get(ref.campaignId)?.participants.get(ref.sessionId);
  if (!p) return undefined;
  return { campaignId: ref.campaignId, sessionId: ref.sessionId, role: p.role };
}

// ---------- broadcast-safe views (NEVER include secret tokens) ----------

export function getRosterView(campaignId: string): ParticipantView[] {
  const c = campaigns.get(campaignId);
  if (!c) return [];
  return [...c.participants.values()].map((p) => ({
    sessionId: p.sessionId,
    displayName: p.displayName,
    role: p.role,
    isConnected: p.socketIds.size > 0,
    characterId: p.characterId,
  }));
}

export function getStateView(campaignId: string): CampaignState | undefined {
  const c = campaigns.get(campaignId);
  if (!c) return undefined;
  return {
    campaignId: c.campaignId,
    name: c.name,
    status: c.status,
    inviteCode: c.inviteCode,
    participants: getRosterView(campaignId),
  };
}

// ---------- rehydrate support / testing ----------

/** Used by rehydrateOnBoot to load a campaign from SQLite into memory (all sockets empty -> offline). */
export function loadCampaignRuntime(runtime: {
  campaignId: string;
  name: string;
  status: "active" | "closed";
  inviteCode: string;
  dmSessionToken: string;
  participants: Array<{
    sessionId: string;
    displayName: string;
    role: Role;
    characterId: string | null;
    sessionToken: string;
  }>;
}): void {
  const participants = new Map<string, ParticipantRuntime>();
  for (const p of runtime.participants) {
    participants.set(p.sessionId, { ...p, socketIds: new Set() });
    tokenIndex.set(p.sessionToken, { campaignId: runtime.campaignId, sessionId: p.sessionId });
  }
  campaigns.set(runtime.campaignId, {
    campaignId: runtime.campaignId,
    name: runtime.name,
    status: runtime.status,
    inviteCode: runtime.inviteCode,
    dmSessionToken: runtime.dmSessionToken,
    participants,
  });
}

/** Test helper — clears all in-memory state. */
export function __resetWorkingSet(): void {
  campaigns.clear();
  tokenIndex.clear();
  socketIndex.clear();
}
