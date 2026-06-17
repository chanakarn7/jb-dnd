import { prisma } from "@/lib/db";
import type { Role } from "@/lib/events";
import { loadCampaignRuntime } from "./workingSet";

// Durable persistence + rehydrate-on-boot (SA_BLUEPRINT §4.2–4.3).
// Pattern: working-set mutation happens first (in handlers); these writes mirror it to SQLite.

export async function persistCampaignCreate(input: {
  campaignId: string;
  name: string;
  inviteCode: string;
  dmSessionId: string;
  dmDisplayName: string;
  dmSessionToken: string;
}): Promise<void> {
  await prisma.campaign.create({
    data: {
      id: input.campaignId,
      name: input.name,
      inviteCode: input.inviteCode,
      dmSessionToken: input.dmSessionToken,
      status: "active",
      sessions: {
        create: {
          id: input.dmSessionId,
          displayName: input.dmDisplayName,
          role: "dm",
          sessionToken: input.dmSessionToken,
          isConnected: true,
        },
      },
    },
  });
}

export async function persistParticipantJoin(input: {
  campaignId: string;
  sessionId: string;
  displayName: string;
  role: Role;
  sessionToken: string;
}): Promise<void> {
  await prisma.playerSession.create({
    data: {
      id: input.sessionId,
      campaignId: input.campaignId,
      displayName: input.displayName,
      role: input.role,
      sessionToken: input.sessionToken,
      isConnected: true,
    },
  });
}

export async function persistRename(campaignId: string, name: string): Promise<void> {
  await prisma.campaign.update({ where: { id: campaignId }, data: { name } });
}

export async function persistRemove(sessionId: string): Promise<void> {
  await prisma.playerSession.delete({ where: { id: sessionId } }).catch(() => {});
}

export async function persistPresence(sessionId: string, connected: boolean): Promise<void> {
  await prisma.playerSession
    .update({
      where: { id: sessionId },
      data: { isConnected: connected, lastSeenAt: new Date() },
    })
    .catch(() => {});
}

export async function inviteCodeExists(normalizedCode: string): Promise<boolean> {
  const c = await prisma.campaign.findUnique({ where: { inviteCode: normalizedCode } });
  return !!c;
}

/**
 * On startup, load all active campaigns + sessions from SQLite into the working set,
 * marking everyone disconnected until their clients reconnect via token (session:resume).
 */
export async function rehydrateOnBoot(): Promise<number> {
  const active = await prisma.campaign.findMany({
    where: { status: "active" },
    include: { sessions: true },
  });
  for (const c of active) {
    loadCampaignRuntime({
      campaignId: c.id,
      name: c.name,
      status: "active",
      inviteCode: c.inviteCode,
      dmSessionToken: c.dmSessionToken,
      participants: c.sessions.map((s) => ({
        sessionId: s.id,
        displayName: s.displayName,
        role: s.role as Role,
        characterId: s.characterId,
        sessionToken: s.sessionToken,
      })),
    });
    // All sessions start offline in memory (no live sockets). Reflect that in the DB too.
    await prisma.playerSession.updateMany({
      where: { campaignId: c.id },
      data: { isConnected: false },
    });
  }
  return active.length;
}
