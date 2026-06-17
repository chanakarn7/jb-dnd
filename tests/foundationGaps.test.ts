import { describe, it, expect, beforeEach, vi, type Mock } from "vitest";

// Gap-closing tests (QA Stage 8): multi-tenancy isolation, invite-code collision
// retry, payload-size rejection, anon authorization, and reconnect token-index
// rebuild. Persistence is mocked like tests/campaignService.test.ts.
vi.mock("@/server/state/persist", () => ({
  persistCampaignCreate: vi.fn().mockResolvedValue(undefined),
  persistParticipantJoin: vi.fn().mockResolvedValue(undefined),
  persistRename: vi.fn().mockResolvedValue(undefined),
  persistRemove: vi.fn().mockResolvedValue(undefined),
  persistPresence: vi.fn().mockResolvedValue(undefined),
  inviteCodeExists: vi.fn().mockResolvedValue(false),
}));

import * as persist from "@/server/state/persist";
import * as service from "@/server/state/campaignService";
import * as ws from "@/server/state/workingSet";

beforeEach(() => {
  ws.__resetWorkingSet();
  vi.clearAllMocks();
  (persist.inviteCodeExists as unknown as Mock).mockResolvedValue(false);
});

async function create(name: string, dm: string) {
  const r = await service.createCampaign({ campaignName: name, dmDisplayName: dm });
  if (!r.ok) throw new Error("setup create failed");
  return r;
}

describe("TC-MT — multi-tenancy isolation (TC for PRD §6.1 / ARCHITECTURE)", () => {
  it("a DM cannot remove a participant that belongs to a different campaign", async () => {
    const a = await create("Campaign A", "MaraA");
    const b = await create("Campaign B", "MaraB");
    const joinB = await service.joinCampaign({ inviteCode: b.state.inviteCode, displayName: "ThorinB" });
    if (!joinB.ok) throw new Error("join B failed");

    const dmAIdentity = { campaignId: a.campaignId, sessionId: a.sessionId, role: "dm" as const };
    // DM of A targets a session that lives in campaign B → must be rejected, B untouched.
    const res = await service.removeParticipant(dmAIdentity, { sessionId: joinB.sessionId });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe("NOT_FOUND");
    expect(ws.getStateView(b.campaignId)!.participants).toHaveLength(2); // B still has DM + Thorin
  });

  it("renaming one campaign never affects another", async () => {
    const a = await create("Campaign A", "MaraA");
    const b = await create("Campaign B", "MaraB");
    await service.renameCampaign(
      { campaignId: a.campaignId, sessionId: a.sessionId, role: "dm" },
      { name: "A Renamed" },
    );
    expect(ws.getStateView(a.campaignId)!.name).toBe("A Renamed");
    expect(ws.getStateView(b.campaignId)!.name).toBe("Campaign B");
  });
});

describe("TC-CODE — invite-code collision retry (TC for PRD §5.7)", () => {
  it("retries when a generated code already exists, then succeeds", async () => {
    // First availability check reports "taken" → forces one retry; then free.
    (persist.inviteCodeExists as unknown as Mock).mockResolvedValueOnce(true).mockResolvedValue(false);
    const r = await service.createCampaign({ campaignName: "Ember", dmDisplayName: "Mara" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.state.inviteCode).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/);
    expect((persist.inviteCodeExists as unknown as Mock).mock.calls.length).toBeGreaterThanOrEqual(2);
  });
});

describe("TC-VAL — malformed / oversized payload rejection (TC for PRD §5.11)", () => {
  it("rejects an over-long campaign name (>60)", async () => {
    const r = await service.createCampaign({ campaignName: "x".repeat(61), dmDisplayName: "Mara" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("INVALID_PAYLOAD");
  });

  it("rejects an over-long DM display name (>24)", async () => {
    const r = await service.createCampaign({ campaignName: "Ember", dmDisplayName: "y".repeat(25) });
    expect(r.ok).toBe(false);
  });

  it("rejects an over-long player display name on join (>24)", async () => {
    const dm = await create("Ember", "Mara");
    const r = await service.joinCampaign({ inviteCode: dm.state.inviteCode, displayName: "z".repeat(25) });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("INVALID_PAYLOAD");
  });

  it("rejects a rename with an over-long name (>60)", async () => {
    const dm = await create("Ember", "Mara");
    const r = await service.renameCampaign(
      { campaignId: dm.campaignId, sessionId: dm.sessionId, role: "dm" },
      { name: "n".repeat(61) },
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("INVALID_PAYLOAD");
  });

  it("rejects a remove intent with a missing target id", async () => {
    const dm = await create("Ember", "Mara");
    const r = await service.removeParticipant(
      { campaignId: dm.campaignId, sessionId: dm.sessionId, role: "dm" },
      {},
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("INVALID_PAYLOAD");
  });

  it("rejects garbage payload types entirely", async () => {
    expect((await service.createCampaign(null)).ok).toBe(false);
    expect((await service.joinCampaign("not-an-object")).ok).toBe(false);
  });
});

describe("TC-RACE — duplicate-name DB race rollback (TC for PRD §5.8)", () => {
  it("rolls back the in-memory seat when the unique constraint rejects a racing join", async () => {
    const dm = await create("Ember", "Mara");
    // Simulate the @@unique([campaignId, displayName]) losing a race at the DB layer.
    (persist.persistParticipantJoin as unknown as Mock).mockRejectedValueOnce(new Error("unique"));
    const r = await service.joinCampaign({ inviteCode: dm.state.inviteCode, displayName: "Thorin" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("DUPLICATE_NAME");
    // The optimistic in-memory add must be rolled back — only the DM remains.
    expect(ws.getStateView(dm.campaignId)!.participants).toHaveLength(1);
  });
});

describe("TC-AUTHZ — unauthorized intents from an anon socket (TC for PRD §5.10)", () => {
  it("rejects rename and remove when there is no authenticated identity", async () => {
    const dm = await create("Ember", "Mara");
    const rename = await service.renameCampaign(undefined, { name: "Hacked" });
    const remove = await service.removeParticipant(undefined, { sessionId: dm.sessionId });
    expect(rename.ok).toBe(false);
    if (!rename.ok) expect(rename.code).toBe("UNAUTHORIZED");
    expect(remove.ok).toBe(false);
    if (!remove.ok) expect(remove.code).toBe("UNAUTHORIZED");
  });
});

describe("TC-RESUME — reconnect rebuilds token index (TC for PRD §5.5/5.6/5.9)", () => {
  it("loadCampaignRuntime (rehydrate) rebuilds identity-by-token and starts everyone offline", () => {
    ws.loadCampaignRuntime({
      campaignId: "c-reload",
      name: "Ember",
      status: "active",
      inviteCode: "K7QM2P",
      dmSessionToken: "dmtok",
      participants: [
        { sessionId: "dm1", displayName: "Mara", role: "dm", characterId: null, sessionToken: "dmtok" },
        { sessionId: "p1", displayName: "Thorin", role: "player", characterId: null, sessionToken: "ptok" },
      ],
    });

    // Everyone offline until a socket reconnects.
    expect(ws.getStateView("c-reload")!.participants.every((p) => !p.isConnected)).toBe(true);

    // Token index works again after rehydrate (the resume path).
    expect(ws.getIdentityByToken("ptok")).toMatchObject({ campaignId: "c-reload", sessionId: "p1", role: "player" });

    // Reconnecting with the token flips presence, no duplicate seat.
    const id = ws.attachSocket("ptok", "sockX");
    expect(id).toMatchObject({ campaignId: "c-reload", sessionId: "p1" });
    expect(ws.isConnected("c-reload", "p1")).toBe(true);
    expect(ws.getStateView("c-reload")!.participants).toHaveLength(2);
  });
});
