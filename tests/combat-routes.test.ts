import { describe, it, expect, vi, beforeEach } from "vitest";

// REST smoke tests for GET /api/combat/active + GET /api/combat/[encounterId].
// Verifies 401 on missing session, null response when no encounter, and
// snapshot shape on success. Does NOT touch the DB.

const authMock = vi.hoisted(() => ({ resolveSession: vi.fn() }));
const repoMock = vi.hoisted(() => ({
  getActiveEncounter: vi.fn(),
  getEncounterById: vi.fn(),
}));

vi.mock("@/lib/characters/auth", () => authMock);
vi.mock("@/lib/combat/repo", () => repoMock);

import { GET as activeGET } from "@/app/api/combat/active/route";
import { GET as encounterGET } from "@/app/api/combat/[encounterId]/route";

const session = { sessionId: "dm1", campaignId: "camp1", role: "dm" as const };

function makeReq(): Request {
  return new Request("http://localhost/");
}

function makeEncounterRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "enc1",
    campaignId: "camp1",
    name: "Test",
    status: "active",
    round: 1,
    currentTurnIndex: 0,
    allowPlayerHpEdit: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    combatants: [],
    ...overrides,
  };
}

const encounterParams = Promise.resolve({ encounterId: "enc1" });

beforeEach(() => {
  vi.clearAllMocks();
  authMock.resolveSession.mockResolvedValue(session);
  repoMock.getActiveEncounter.mockResolvedValue(null);
  repoMock.getEncounterById.mockResolvedValue(null);
});

// ── GET /api/combat/active ─────────────────────────────────────────────────

describe("GET /api/combat/active", () => {
  it("401 when no session (edge 5.16)", async () => {
    authMock.resolveSession.mockResolvedValue(null);
    const res = await activeGET(makeReq());
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toEqual({ error: "unauthorized" });
  });

  it("returns { encounter: null } when no active encounter — not 404 (edge 5.8)", async () => {
    repoMock.getActiveEncounter.mockResolvedValue(null);
    const res = await activeGET(makeReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ encounter: null });
  });

  it("returns encounter snapshot when active encounter exists", async () => {
    repoMock.getActiveEncounter.mockResolvedValue(makeEncounterRow());
    const res = await activeGET(makeReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.encounter).not.toBeNull();
    expect(body.encounter.id).toBe("enc1");
    expect(body.encounter.status).toBe("active");
    expect(Array.isArray(body.encounter.combatants)).toBe(true);
  });

  it("scopes query to session campaignId (multi-tenancy)", async () => {
    repoMock.getActiveEncounter.mockResolvedValue(makeEncounterRow());
    await activeGET(makeReq());
    expect(repoMock.getActiveEncounter).toHaveBeenCalledWith("camp1");
  });
});

// ── GET /api/combat/[encounterId] ─────────────────────────────────────────

describe("GET /api/combat/[encounterId]", () => {
  it("401 when no session (edge 5.16)", async () => {
    authMock.resolveSession.mockResolvedValue(null);
    const res = await encounterGET(makeReq(), { params: encounterParams });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toEqual({ error: "unauthorized" });
  });

  it("404 when encounter not found", async () => {
    repoMock.getEncounterById.mockResolvedValue(null);
    const res = await encounterGET(makeReq(), { params: encounterParams });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body).toEqual({ error: "not_found" });
  });

  it("returns encounter snapshot for valid encounterId", async () => {
    repoMock.getEncounterById.mockResolvedValue(makeEncounterRow());
    const res = await encounterGET(makeReq(), { params: encounterParams });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.encounter.id).toBe("enc1");
  });

  it("scopes query to session campaignId (multi-tenancy)", async () => {
    repoMock.getEncounterById.mockResolvedValue(makeEncounterRow());
    await encounterGET(makeReq(), { params: encounterParams });
    expect(repoMock.getEncounterById).toHaveBeenCalledWith("camp1", "enc1");
  });
});
