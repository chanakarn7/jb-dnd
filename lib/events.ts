// Shared Socket.io event contract types (docs/modules/foundation/SA_BLUEPRINT.md §3).
// Used by both the server handlers and the browser client.

export type Role = "dm" | "player";
export type CampaignStatus = "active" | "closed";

/** Broadcast-safe view of a participant — NEVER includes secret tokens. */
export interface ParticipantView {
  sessionId: string;
  displayName: string;
  role: Role;
  isConnected: boolean;
  characterId: string | null; // always null in Foundation
}

/** Broadcast-safe authoritative campaign state. */
export interface CampaignState {
  campaignId: string;
  name: string;
  status: CampaignStatus;
  inviteCode: string;
  participants: ParticipantView[];
}

// Client -> server intents (domain:action).
export interface ClientToServerEvents {
  "campaign:create": (
    payload: { campaignName: string; dmDisplayName: string },
    ack: (res: SnapshotAck | ErrorAck) => void,
  ) => void;
  "campaign:join": (
    payload: { inviteCode: string; displayName: string },
    ack: (res: SnapshotAck | ErrorAck) => void,
  ) => void;
  "campaign:rename": (payload: { name: string }, ack: (res: OkAck | ErrorAck) => void) => void;
  "participant:remove": (
    payload: { sessionId: string },
    ack: (res: OkAck | ErrorAck) => void,
  ) => void;
  "session:leave": () => void;
}

// Server -> client broadcasts.
export interface ServerToClientEvents {
  "state:snapshot": (state: CampaignState) => void;
  "roster:update": (payload: { participants: ParticipantView[] }) => void;
  "state:patch": (payload: { path: string; value: unknown }) => void;
  "session:kicked": (payload: { reason: string }) => void;
  error: (payload: { code: string; message: string }) => void;
}

/** Handshake auth carried on socket connection. */
export interface SocketAuth {
  sessionToken?: string;
}

export type ErrorCode =
  | "BAD_CODE"
  | "DUPLICATE_NAME"
  | "CAMPAIGN_CLOSED"
  | "UNAUTHORIZED"
  | "INVALID_PAYLOAD"
  | "NOT_FOUND";

export interface SnapshotAck {
  ok: true;
  /** Secret token delivered to its owner ONLY (never in broadcasts). */
  token: string;
  state: CampaignState;
}
export interface OkAck {
  ok: true;
}
export interface ErrorAck {
  ok: false;
  code: ErrorCode;
  message: string;
}
