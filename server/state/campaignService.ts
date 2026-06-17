import { randomUUID } from "node:crypto";
import * as ws from "./workingSet";
import * as persist from "./persist";
import { generateInviteCode, normalizeInviteCode } from "@/lib/inviteCode";
import { generateSessionToken } from "@/lib/tokens";
import {
  createCampaignSchema,
  joinCampaignSchema,
  renameCampaignSchema,
  removeParticipantSchema,
} from "@/lib/validation";
import type { CampaignState, ErrorCode, Role } from "@/lib/events";

// Domain service: the server-authoritative logic for every Foundation intent.
// No sockets / no broadcasting here — handlers wrap these and emit. This keeps the
// validate -> authorize -> mutate-working-set -> persist pipeline unit-testable.

export type Identity = { campaignId: string; sessionId: string; role: Role };
type Fail = { ok: false; code: ErrorCode; message: string };
const fail = (code: ErrorCode, message: string): Fail => ({ ok: false, code, message });

const MAX_CODE_ATTEMPTS = 12;

export type CreateResult =
  | { ok: true; token: string; campaignId: string; sessionId: string; state: CampaignState }
  | Fail;

export async function createCampaign(payload: unknown): Promise<CreateResult> {
  const parsed = createCampaignSchema.safeParse(payload);
  if (!parsed.success) return fail("INVALID_PAYLOAD", "Campaign name and DM name are required.");

  // Allocate a unique invite code (memory + DB), retry on the rare collision.
  let code = "";
  for (let i = 0; i < MAX_CODE_ATTEMPTS; i++) {
    const candidate = normalizeInviteCode(generateInviteCode());
    if (!ws.findCampaignByInviteCode(candidate) && !(await persist.inviteCodeExists(candidate))) {
      code = candidate;
      break;
    }
  }
  if (!code) return fail("INVALID_PAYLOAD", "Could not allocate an invite code, try again.");

  const campaignId = randomUUID();
  const dmSessionId = randomUUID();
  const dmSessionToken = generateSessionToken();

  ws.createCampaignRuntime({
    campaignId,
    name: parsed.data.campaignName,
    inviteCode: code,
    dmSessionId,
    dmDisplayName: parsed.data.dmDisplayName,
    dmSessionToken,
  });

  try {
    await persist.persistCampaignCreate({
      campaignId,
      name: parsed.data.campaignName,
      inviteCode: code,
      dmSessionId,
      dmDisplayName: parsed.data.dmDisplayName,
      dmSessionToken,
    });
  } catch {
    ws.removeParticipant(campaignId, dmSessionId);
    return fail("INVALID_PAYLOAD", "Could not create the campaign, try again.");
  }

  return { ok: true, token: dmSessionToken, campaignId, sessionId: dmSessionId, state: ws.getStateView(campaignId)! };
}

export type JoinResult =
  | { ok: true; token: string; campaignId: string; sessionId: string; state: CampaignState }
  | Fail;

export async function joinCampaign(payload: unknown): Promise<JoinResult> {
  const parsed = joinCampaignSchema.safeParse(payload);
  if (!parsed.success) return fail("INVALID_PAYLOAD", "Invite code and display name are required.");

  const code = normalizeInviteCode(parsed.data.inviteCode);
  const campaign = ws.findCampaignByInviteCode(code);
  if (!campaign) return fail("BAD_CODE", "No campaign found for that code.");
  if (campaign.status !== "active") return fail("CAMPAIGN_CLOSED", "This campaign has ended.");
  if (ws.isNameTaken(campaign.campaignId, parsed.data.displayName)) {
    return fail("DUPLICATE_NAME", "That name's taken in this campaign — pick another.");
  }

  const sessionId = randomUUID();
  const sessionToken = generateSessionToken();

  ws.addParticipant(campaign.campaignId, {
    sessionId,
    displayName: parsed.data.displayName,
    role: "player",
    sessionToken,
  });

  try {
    await persist.persistParticipantJoin({
      campaignId: campaign.campaignId,
      sessionId,
      displayName: parsed.data.displayName,
      role: "player",
      sessionToken,
    });
  } catch {
    // Unique([campaignId, displayName]) lost a race — roll back the in-memory add.
    ws.removeParticipant(campaign.campaignId, sessionId);
    return fail("DUPLICATE_NAME", "That name's taken in this campaign — pick another.");
  }

  return {
    ok: true,
    token: sessionToken,
    campaignId: campaign.campaignId,
    sessionId,
    state: ws.getStateView(campaign.campaignId)!,
  };
}

export type RenameResult = { ok: true; campaignId: string; name: string } | Fail;

export async function renameCampaign(identity: Identity | undefined, payload: unknown): Promise<RenameResult> {
  if (!identity || identity.role !== "dm") return fail("UNAUTHORIZED", "Only the DM can rename the campaign.");
  const parsed = renameCampaignSchema.safeParse(payload);
  if (!parsed.success) return fail("INVALID_PAYLOAD", "Campaign name must be 1–60 characters.");

  if (!ws.renameCampaign(identity.campaignId, parsed.data.name)) {
    return fail("NOT_FOUND", "Campaign not found.");
  }
  await persist.persistRename(identity.campaignId, parsed.data.name);
  return { ok: true, campaignId: identity.campaignId, name: parsed.data.name };
}

export type RemoveResult =
  | { ok: true; campaignId: string; removedSessionId: string; kickedSocketIds: string[] }
  | Fail;

export async function removeParticipant(identity: Identity | undefined, payload: unknown): Promise<RemoveResult> {
  if (!identity || identity.role !== "dm") return fail("UNAUTHORIZED", "Only the DM can remove participants.");
  const parsed = removeParticipantSchema.safeParse(payload);
  if (!parsed.success) return fail("INVALID_PAYLOAD", "A target session id is required.");
  if (parsed.data.sessionId === identity.sessionId) return fail("UNAUTHORIZED", "You can't remove yourself.");

  const campaign = ws.getCampaign(identity.campaignId);
  const target = campaign?.participants.get(parsed.data.sessionId);
  if (!campaign || !target) return fail("NOT_FOUND", "No such participant in this campaign.");

  const kickedSocketIds = [...target.socketIds];
  ws.removeParticipant(identity.campaignId, parsed.data.sessionId);
  await persist.persistRemove(parsed.data.sessionId);
  return { ok: true, campaignId: identity.campaignId, removedSessionId: parsed.data.sessionId, kickedSocketIds };
}
