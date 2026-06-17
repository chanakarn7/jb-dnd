import { describe, it, expect, beforeEach } from "vitest";
import * as ws from "@/server/state/workingSet";

beforeEach(() => ws.__resetWorkingSet());

function seedCampaign() {
  ws.createCampaignRuntime({
    campaignId: "c1",
    name: "Ember Crown",
    inviteCode: "K7QM2P",
    dmSessionId: "dm1",
    dmDisplayName: "Mara",
    dmSessionToken: "dmtok",
  });
}

describe("workingSet", () => {
  it("creates a campaign with the DM as first participant", () => {
    seedCampaign();
    const state = ws.getStateView("c1")!;
    expect(state.name).toBe("Ember Crown");
    expect(state.inviteCode).toBe("K7QM2P");
    expect(state.participants).toHaveLength(1);
    expect(state.participants[0]).toMatchObject({ displayName: "Mara", role: "dm", isConnected: false });
  });

  it("finds a campaign by invite code and detects taken names case-insensitively", () => {
    seedCampaign();
    expect(ws.findCampaignByInviteCode("K7QM2P")?.campaignId).toBe("c1");
    expect(ws.isNameTaken("c1", "mara")).toBe(true);
    expect(ws.isNameTaken("c1", "Thorin")).toBe(false);
  });

  it("adds a participant and exposes it in the roster", () => {
    seedCampaign();
    ws.addParticipant("c1", { sessionId: "p1", displayName: "Thorin", role: "player", sessionToken: "ptok" });
    const roster = ws.getRosterView("c1");
    expect(roster.map((p) => p.displayName).sort()).toEqual(["Mara", "Thorin"]);
  });

  it("derives presence from live sockets (multi-tab safe)", () => {
    seedCampaign();
    expect(ws.isConnected("c1", "dm1")).toBe(false);
    ws.attachSocket("dmtok", "sockA");
    ws.attachSocket("dmtok", "sockB"); // second tab
    expect(ws.isConnected("c1", "dm1")).toBe(true);

    const r1 = ws.detachSocket("sockA");
    expect(r1?.nowOffline).toBe(false); // still has sockB
    expect(ws.isConnected("c1", "dm1")).toBe(true);

    const r2 = ws.detachSocket("sockB");
    expect(r2?.nowOffline).toBe(true);
    expect(ws.isConnected("c1", "dm1")).toBe(false);
  });

  it("resolves identity by token and clears it on removal", () => {
    seedCampaign();
    ws.addParticipant("c1", { sessionId: "p1", displayName: "Thorin", role: "player", sessionToken: "ptok" });
    expect(ws.getIdentityByToken("ptok")).toMatchObject({ campaignId: "c1", sessionId: "p1", role: "player" });
    ws.removeParticipant("c1", "p1");
    expect(ws.getIdentityByToken("ptok")).toBeUndefined();
    expect(ws.getRosterView("c1")).toHaveLength(1);
  });

  it("never leaks secret tokens in broadcast-safe views", () => {
    seedCampaign();
    ws.addParticipant("c1", { sessionId: "p1", displayName: "Thorin", role: "player", sessionToken: "ptok" });
    const json = JSON.stringify(ws.getStateView("c1"));
    expect(json).not.toContain("dmtok");
    expect(json).not.toContain("ptok");
    expect(json).not.toContain("sessionToken");
  });
});
