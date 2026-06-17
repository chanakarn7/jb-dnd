import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock the DB persistence layer — we test validation/authorization/working-set effects,
// not SQLite. Default mocks succeed; inviteCodeExists reports "free".
vi.mock("@/server/state/persist", () => ({
  persistCampaignCreate: vi.fn().mockResolvedValue(undefined),
  persistParticipantJoin: vi.fn().mockResolvedValue(undefined),
  persistRename: vi.fn().mockResolvedValue(undefined),
  persistRemove: vi.fn().mockResolvedValue(undefined),
  persistPresence: vi.fn().mockResolvedValue(undefined),
  inviteCodeExists: vi.fn().mockResolvedValue(false),
}));

import * as service from "@/server/state/campaignService";
import * as ws from "@/server/state/workingSet";

beforeEach(() => ws.__resetWorkingSet());

async function createMara() {
  const r = await service.createCampaign({ campaignName: "Ember Crown", dmDisplayName: "Mara" });
  if (!r.ok) throw new Error("setup create failed");
  return r;
}

describe("campaignService.createCampaign", () => {
  it("creates a campaign with a valid invite code and the DM seated", async () => {
    const r = await createMara();
    expect(r.state.name).toBe("Ember Crown");
    expect(r.state.inviteCode).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/);
    expect(r.state.participants).toHaveLength(1);
    expect(r.state.participants[0]).toMatchObject({ displayName: "Mara", role: "dm" });
    expect(r.token.length).toBeGreaterThan(20);
  });

  it("rejects an empty payload", async () => {
    const r = await service.createCampaign({ campaignName: "", dmDisplayName: "" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("INVALID_PAYLOAD");
  });

  it("gives different campaigns different codes", async () => {
    const a = await createMara();
    const b = await createMara();
    expect(a.state.inviteCode).not.toBe(b.state.inviteCode);
  });
});

describe("campaignService.joinCampaign", () => {
  it("rejects an unknown invite code", async () => {
    await createMara();
    const r = await service.joinCampaign({ inviteCode: "ZZZZZZ", displayName: "Thorin" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("BAD_CODE");
  });

  it("rejects a duplicate display name (case-insensitive)", async () => {
    const dm = await createMara();
    const r = await service.joinCampaign({ inviteCode: dm.state.inviteCode, displayName: "mara" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("DUPLICATE_NAME");
  });

  it("admits a player and reflects them in the shared state", async () => {
    const dm = await createMara();
    const r = await service.joinCampaign({ inviteCode: dm.state.inviteCode, displayName: "Thorin" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.state.participants.map((p) => p.displayName).sort()).toEqual(["Mara", "Thorin"]);
      expect(r.token).not.toBe(dm.token);
    }
  });

  it("rejects joining a closed campaign", async () => {
    const dm = await createMara();
    ws.getCampaign(dm.campaignId)!.status = "closed";
    const r = await service.joinCampaign({ inviteCode: dm.state.inviteCode, displayName: "Thorin" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("CAMPAIGN_CLOSED");
  });
});

describe("campaignService authorization (server-side)", () => {
  it("lets the DM rename but rejects a player", async () => {
    const dm = await createMara();
    const dmId = { campaignId: dm.campaignId, sessionId: dm.sessionId, role: "dm" as const };
    const playerId = { campaignId: dm.campaignId, sessionId: "p1", role: "player" as const };

    const ok = await service.renameCampaign(dmId, { name: "New Name" });
    expect(ok.ok).toBe(true);
    expect(ws.getStateView(dm.campaignId)!.name).toBe("New Name");

    const denied = await service.renameCampaign(playerId, { name: "Hacked" });
    expect(denied.ok).toBe(false);
    if (!denied.ok) expect(denied.code).toBe("UNAUTHORIZED");

    const anon = await service.renameCampaign(undefined, { name: "Hacked" });
    expect(anon.ok).toBe(false);
  });

  it("lets the DM remove a player but rejects a player and self-removal", async () => {
    const dm = await createMara();
    const join = await service.joinCampaign({ inviteCode: dm.state.inviteCode, displayName: "Thorin" });
    if (!join.ok) throw new Error("join failed");
    const dmId = { campaignId: dm.campaignId, sessionId: dm.sessionId, role: "dm" as const };
    const playerId = { campaignId: dm.campaignId, sessionId: join.sessionId, role: "player" as const };

    // player can't remove anyone
    const denied = await service.removeParticipant(playerId, { sessionId: dm.sessionId });
    expect(denied.ok).toBe(false);
    if (!denied.ok) expect(denied.code).toBe("UNAUTHORIZED");

    // DM can't remove self
    const self = await service.removeParticipant(dmId, { sessionId: dm.sessionId });
    expect(self.ok).toBe(false);

    // DM removes the player
    const ok = await service.removeParticipant(dmId, { sessionId: join.sessionId });
    expect(ok.ok).toBe(true);
    expect(ws.getStateView(dm.campaignId)!.participants).toHaveLength(1);
  });
});
