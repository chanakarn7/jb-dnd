import { describe, it, expect, vi, beforeEach } from "vitest";

// REST smoke tests for all 8 story route files.
// Mocks: lib/characters/auth (resolveSession) + lib/story/service (action fns).
// lib/story/http runs for real — verifies actual status codes + response shapes.

const authMock = vi.hoisted(() => ({ resolveSession: vi.fn() }));

const serviceMock = vi.hoisted(() => ({
  listSessionsAction: vi.fn(),
  getSessionAction: vi.fn(),
  createSessionAction: vi.fn(),
  updateSessionAction: vi.fn(),
  deleteSessionAction: vi.fn(),
  listQuestsAction: vi.fn(),
  getQuestAction: vi.fn(),
  createQuestAction: vi.fn(),
  updateQuestAction: vi.fn(),
  deleteQuestAction: vi.fn(),
  listNpcsAction: vi.fn(),
  getNpcAction: vi.fn(),
  createNpcAction: vi.fn(),
  updateNpcAction: vi.fn(),
  deleteNpcAction: vi.fn(),
  listJournalAction: vi.fn(),
  getJournalAction: vi.fn(),
  createJournalAction: vi.fn(),
  updateJournalAction: vi.fn(),
  deleteJournalAction: vi.fn(),
}));

vi.mock("@/lib/characters/auth", () => authMock);
vi.mock("@/lib/story/service", () => serviceMock);

import { GET as sessionsGET, POST as sessionsPOST } from "@/app/api/story/sessions/route";
import {
  GET as sessionItemGET,
  PATCH as sessionItemPATCH,
  DELETE as sessionItemDELETE,
} from "@/app/api/story/sessions/[id]/route";
import { GET as questsGET, POST as questsPOST } from "@/app/api/story/quests/route";
import {
  GET as questItemGET,
  PATCH as questItemPATCH,
  DELETE as questItemDELETE,
} from "@/app/api/story/quests/[id]/route";
import { GET as npcsGET, POST as npcsPOST } from "@/app/api/story/npcs/route";
import { GET as npcItemGET } from "@/app/api/story/npcs/[id]/route";
import { GET as journalGET, POST as journalPOST } from "@/app/api/story/journal/route";
import {
  GET as journalItemGET,
  PATCH as journalItemPATCH,
  DELETE as journalItemDELETE,
} from "@/app/api/story/journal/[id]/route";

// ── Helpers ───────────────────────────────────────────────────────────────────

const dm = { sessionId: "dm1", campaignId: "camp1", role: "dm" as const };

function makeReq(body?: unknown): Request {
  if (body != null) {
    return new Request("http://localhost/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }
  return new Request("http://localhost/");
}

const sessionParams = Promise.resolve({ id: "sess1" });
const questParams = Promise.resolve({ id: "q1" });
const npcParams = Promise.resolve({ id: "npc1" });
const journalParams = Promise.resolve({ id: "j1" });

const unauthorized = () => ({ ok: false as const, error: "unauthorized", status: 401 as const });
const forbidden = () => ({ ok: false as const, error: "forbidden", status: 403 as const });
const notFound = () => ({ ok: false as const, error: "not_found", status: 404 as const });
const invalid = (e: string) => ({ ok: false as const, error: e, status: 422 as const });

function makeSessionView(overrides: Record<string, unknown> = {}) {
  return {
    id: "sess1",
    campaignId: "camp1",
    title: "Session 1",
    date: new Date().toISOString(),
    summary: null,
    xpAwarded: 0,
    notableLoot: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    journalEntries: [],
    ...overrides,
  };
}

function makeQuestView(overrides: Record<string, unknown> = {}) {
  return {
    id: "q1",
    campaignId: "camp1",
    name: "Find the Temple",
    description: null,
    giverName: null,
    status: "active",
    objectives: [],
    reward: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeNpcView(overrides: Record<string, unknown> = {}) {
  return {
    id: "npc1",
    campaignId: "camp1",
    characterId: null,
    name: "Elder Maren",
    role: "Town Elder",
    faction: null,
    notes: null,
    isAlive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeJournalView(overrides: Record<string, unknown> = {}) {
  return {
    id: "j1",
    campaignId: "camp1",
    sessionId: null,
    title: "Thornhaven Lore",
    content: "## History\n\nThornhaven was founded...",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  authMock.resolveSession.mockResolvedValue(dm);
  serviceMock.listSessionsAction.mockResolvedValue({ ok: true, data: [] });
  serviceMock.getSessionAction.mockResolvedValue({ ok: true, data: makeSessionView() });
  serviceMock.createSessionAction.mockResolvedValue({ ok: true, data: makeSessionView() });
  serviceMock.updateSessionAction.mockResolvedValue({ ok: true, data: makeSessionView() });
  serviceMock.deleteSessionAction.mockResolvedValue({ ok: true, data: { id: "sess1" } });
  serviceMock.listQuestsAction.mockResolvedValue({ ok: true, data: [] });
  serviceMock.getQuestAction.mockResolvedValue({ ok: true, data: makeQuestView() });
  serviceMock.createQuestAction.mockResolvedValue({ ok: true, data: makeQuestView() });
  serviceMock.updateQuestAction.mockResolvedValue({ ok: true, data: makeQuestView() });
  serviceMock.deleteQuestAction.mockResolvedValue({ ok: true, data: { id: "q1" } });
  serviceMock.listNpcsAction.mockResolvedValue({ ok: true, data: [] });
  serviceMock.getNpcAction.mockResolvedValue({ ok: true, data: makeNpcView() });
  serviceMock.createNpcAction.mockResolvedValue({ ok: true, data: makeNpcView() });
  serviceMock.updateNpcAction.mockResolvedValue({ ok: true, data: makeNpcView() });
  serviceMock.deleteNpcAction.mockResolvedValue({ ok: true, data: { id: "npc1" } });
  serviceMock.listJournalAction.mockResolvedValue({ ok: true, data: [] });
  serviceMock.getJournalAction.mockResolvedValue({ ok: true, data: makeJournalView() });
  serviceMock.createJournalAction.mockResolvedValue({ ok: true, data: makeJournalView() });
  serviceMock.updateJournalAction.mockResolvedValue({ ok: true, data: makeJournalView() });
  serviceMock.deleteJournalAction.mockResolvedValue({ ok: true, data: { id: "j1" } });
});

// ── GET /api/story/sessions ───────────────────────────────────────────────────

describe("GET /api/story/sessions", () => {
  it("401 when service returns unauthorized (edge 5.16)", async () => {
    serviceMock.listSessionsAction.mockResolvedValue(unauthorized());
    const res = await sessionsGET(makeReq());
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toEqual({ error: "unauthorized" });
  });

  it("200 with sessions array", async () => {
    serviceMock.listSessionsAction.mockResolvedValue({ ok: true, data: [makeSessionView()] });
    const res = await sessionsGET(makeReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.sessions)).toBe(true);
    expect(body.sessions).toHaveLength(1);
  });

  it("passes session to action (multi-tenancy — service gets session from resolveSession)", async () => {
    await sessionsGET(makeReq());
    expect(serviceMock.listSessionsAction).toHaveBeenCalledWith(dm);
  });
});

// ── POST /api/story/sessions ──────────────────────────────────────────────────

describe("POST /api/story/sessions", () => {
  it("403 when service returns forbidden (player write, edge 5.5)", async () => {
    serviceMock.createSessionAction.mockResolvedValue(forbidden());
    const res = await sessionsPOST(makeReq({ date: "2026-06-01" }));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe("forbidden");
  });

  it("422 when service returns invalid (e.g. missing date)", async () => {
    serviceMock.createSessionAction.mockResolvedValue(invalid("invalid_date"));
    const res = await sessionsPOST(makeReq({}));
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toBe("invalid_date");
  });

  it("201 on success, body keyed as 'session'", async () => {
    const res = await sessionsPOST(makeReq({ date: "2026-06-01" }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.session).toBeDefined();
    expect(body.session.id).toBe("sess1");
  });
});

// ── GET /api/story/sessions/[id] ─────────────────────────────────────────────

describe("GET /api/story/sessions/[id]", () => {
  it("404 when service returns not_found (edge 5.15)", async () => {
    serviceMock.getSessionAction.mockResolvedValue(notFound());
    const res = await sessionItemGET(makeReq(), { params: sessionParams });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("not_found");
  });

  it("200 with session detail", async () => {
    const res = await sessionItemGET(makeReq(), { params: sessionParams });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.session).toBeDefined();
    expect(body.session.id).toBe("sess1");
  });
});

// ── PATCH /api/story/sessions/[id] ───────────────────────────────────────────

describe("PATCH /api/story/sessions/[id]", () => {
  it("403 when service returns forbidden", async () => {
    serviceMock.updateSessionAction.mockResolvedValue(forbidden());
    const res = await sessionItemPATCH(makeReq({ title: "Renamed" }), { params: sessionParams });
    expect(res.status).toBe(403);
  });
});

// ── DELETE /api/story/sessions/[id] ──────────────────────────────────────────

describe("DELETE /api/story/sessions/[id]", () => {
  it("204 on success (no body)", async () => {
    const res = await sessionItemDELETE(makeReq(), { params: sessionParams });
    expect(res.status).toBe(204);
  });

  it("404 when service returns not_found (edge 5.17)", async () => {
    serviceMock.deleteSessionAction.mockResolvedValue(notFound());
    const res = await sessionItemDELETE(makeReq(), { params: sessionParams });
    expect(res.status).toBe(404);
  });
});

// ── GET /api/story/quests ─────────────────────────────────────────────────────

describe("GET /api/story/quests", () => {
  it("401 when unauthorized (edge 5.16)", async () => {
    serviceMock.listQuestsAction.mockResolvedValue(unauthorized());
    const res = await questsGET(makeReq());
    expect(res.status).toBe(401);
  });

  it("200 with quests array", async () => {
    serviceMock.listQuestsAction.mockResolvedValue({ ok: true, data: [makeQuestView()] });
    const res = await questsGET(makeReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.quests)).toBe(true);
  });
});

// ── POST /api/story/quests ────────────────────────────────────────────────────

describe("POST /api/story/quests", () => {
  it("422 on empty name (edge 5.11)", async () => {
    serviceMock.createQuestAction.mockResolvedValue(invalid("invalid_name"));
    const res = await questsPOST(makeReq({ name: "" }));
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toBe("invalid_name");
  });

  it("201 on success, keyed as 'quest'", async () => {
    const res = await questsPOST(makeReq({ name: "Find the Temple" }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.quest).toBeDefined();
  });
});

// ── GET /api/story/quests/[id] ───────────────────────────────────────────────

describe("GET /api/story/quests/[id]", () => {
  it("200 with quest detail", async () => {
    const res = await questItemGET(makeReq(), { params: questParams });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.quest).toBeDefined();
  });
});

// ── PATCH /api/story/quests/[id] ─────────────────────────────────────────────

describe("PATCH /api/story/quests/[id]", () => {
  it("403 player cannot toggle objectives (edge 5.6)", async () => {
    serviceMock.updateQuestAction.mockResolvedValue(forbidden());
    const res = await questItemPATCH(
      makeReq({ objectives: [{ text: "Done", checked: true }] }),
      { params: questParams },
    );
    expect(res.status).toBe(403);
  });
});

// ── DELETE /api/story/quests/[id] ────────────────────────────────────────────

describe("DELETE /api/story/quests/[id]", () => {
  it("204 on success", async () => {
    const res = await questItemDELETE(makeReq(), { params: questParams });
    expect(res.status).toBe(204);
  });
});

// ── GET /api/story/npcs ───────────────────────────────────────────────────────

describe("GET /api/story/npcs", () => {
  it("200 with npcs array", async () => {
    const res = await npcsGET(makeReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.npcs)).toBe(true);
  });
});

// ── POST /api/story/npcs ──────────────────────────────────────────────────────

describe("POST /api/story/npcs", () => {
  it("422 on empty name (edge 5.12)", async () => {
    serviceMock.createNpcAction.mockResolvedValue(invalid("invalid_name"));
    const res = await npcsPOST(makeReq({ name: "" }));
    expect(res.status).toBe(422);
  });

  it("201 on success, keyed as 'npc'", async () => {
    const res = await npcsPOST(makeReq({ name: "Elder Maren" }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.npc).toBeDefined();
  });
});

// ── GET /api/story/npcs/[id] ─────────────────────────────────────────────────

describe("GET /api/story/npcs/[id]", () => {
  it("404 when not found (edge 5.15 multi-tenancy)", async () => {
    serviceMock.getNpcAction.mockResolvedValue(notFound());
    const res = await npcItemGET(makeReq(), { params: npcParams });
    expect(res.status).toBe(404);
  });

  it("200 with NPC detail", async () => {
    const res = await npcItemGET(makeReq(), { params: npcParams });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.npc).toBeDefined();
    expect(body.npc.name).toBe("Elder Maren");
  });
});

// ── GET /api/story/journal ───────────────────────────────────────────────────

describe("GET /api/story/journal", () => {
  it("200 with entries array", async () => {
    serviceMock.listJournalAction.mockResolvedValue({ ok: true, data: [makeJournalView()] });
    const res = await journalGET(makeReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.entries)).toBe(true);
  });
});

// ── POST /api/story/journal ──────────────────────────────────────────────────

describe("POST /api/story/journal", () => {
  it("403 when player tries to create (edge 5.5)", async () => {
    serviceMock.createJournalAction.mockResolvedValue(forbidden());
    const res = await journalPOST(makeReq({ content: "Notes" }));
    expect(res.status).toBe(403);
  });

  it("422 on empty content (edge 5.13)", async () => {
    serviceMock.createJournalAction.mockResolvedValue(invalid("invalid_content"));
    const res = await journalPOST(makeReq({ content: "" }));
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toBe("invalid_content");
  });

  it("422 when sessionId from another campaign (edge 5.20)", async () => {
    serviceMock.createJournalAction.mockResolvedValue(invalid("invalid_session"));
    const res = await journalPOST(makeReq({ content: "Notes", sessionId: "sess-other" }));
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toBe("invalid_session");
  });

  it("201 on success, keyed as 'entry'", async () => {
    const res = await journalPOST(makeReq({ content: "The party arrived..." }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.entry).toBeDefined();
  });
});

// ── GET /api/story/journal/[id] ──────────────────────────────────────────────

describe("GET /api/story/journal/[id]", () => {
  it("401 when unauthorized (edge 5.16)", async () => {
    serviceMock.getJournalAction.mockResolvedValue(unauthorized());
    const res = await journalItemGET(makeReq(), { params: journalParams });
    expect(res.status).toBe(401);
  });

  it("200 with entry detail", async () => {
    const res = await journalItemGET(makeReq(), { params: journalParams });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.entry).toBeDefined();
  });
});

// ── PATCH /api/story/journal/[id] ────────────────────────────────────────────

describe("PATCH /api/story/journal/[id]", () => {
  it("200 on successful update", async () => {
    const res = await journalItemPATCH(makeReq({ title: "Updated" }), { params: journalParams });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.entry).toBeDefined();
  });
});

// ── DELETE /api/story/journal/[id] ───────────────────────────────────────────

describe("DELETE /api/story/journal/[id]", () => {
  it("204 on success (no body)", async () => {
    const res = await journalItemDELETE(makeReq(), { params: journalParams });
    expect(res.status).toBe(204);
  });

  it("404 when not found (edge 5.17)", async () => {
    serviceMock.deleteJournalAction.mockResolvedValue(notFound());
    const res = await journalItemDELETE(makeReq(), { params: journalParams });
    expect(res.status).toBe(404);
  });
});
