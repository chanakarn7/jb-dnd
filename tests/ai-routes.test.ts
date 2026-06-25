// File: tests/ai-routes.test.ts
// REST smoke tests for all 5 AI route files (Sprint 7 QA).
// Mocks: lib/characters/auth (resolveSession) + lib/ai/service (action fns).
// lib/ai/http runs for real — verifies actual status codes + response shapes.

import { describe, it, expect, vi, beforeEach } from "vitest";

const authMock = vi.hoisted(() => ({ resolveSession: vi.fn() }));
const serviceMock = vi.hoisted(() => ({
  generateDraft: vi.fn(),
  importDraft: vi.fn(),
  listDraftsAction: vi.fn(),
  approveDraft: vi.fn(),
  editDraft: vi.fn(),
  rejectDraft: vi.fn(),
  getProviderStatus: vi.fn(),
}));

vi.mock("@/lib/characters/auth", () => authMock);
vi.mock("@/lib/ai/service", () => serviceMock);

import { POST as generatePOST } from "@/app/api/ai/generate/route";
import { POST as importPOST } from "@/app/api/ai/import/route";
import { GET as draftsGET } from "@/app/api/ai/drafts/route";
import { PATCH as draftPATCH, DELETE as draftDELETE } from "@/app/api/ai/drafts/[id]/route";
import { GET as statusGET } from "@/app/api/ai/status/route";

const dm = { sessionId: "dm1", campaignId: "camp1", role: "dm" as const };
const player = { sessionId: "p1", campaignId: "camp1", role: "player" as const };
const idParams = Promise.resolve({ id: "d1" });

function makeReq(body?: unknown, url = "http://localhost/"): Request {
  if (body !== undefined) {
    return new Request(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }
  return new Request(url);
}

const okView = { id: "d1", entityType: "npc", provider: "ollama", status: "pending" };

beforeEach(() => {
  vi.clearAllMocks();
  authMock.resolveSession.mockResolvedValue(dm);
});

// ─────────────────────────────────────────────────────────────────────────────
describe("POST /api/ai/generate", () => {
  it("201 + { draft } on success", async () => {
    serviceMock.generateDraft.mockResolvedValue({ ok: true, data: okView });
    const res = await generatePOST(makeReq({ entityType: "npc", prompt: "x" }));
    expect(res.status).toBe(201);
    expect((await res.json()).draft).toMatchObject({ id: "d1" });
  });
  it("forwards 503 provider_unavailable", async () => {
    serviceMock.generateDraft.mockResolvedValue({ ok: false, error: "provider_unavailable", status: 503 });
    const res = await generatePOST(makeReq({ entityType: "npc", prompt: "x" }));
    expect(res.status).toBe(503);
    expect((await res.json()).error).toBe("provider_unavailable");
  });
  it("forwards 502 provider_error", async () => {
    serviceMock.generateDraft.mockResolvedValue({ ok: false, error: "provider_error: boom", status: 502 });
    const res = await generatePOST(makeReq({ entityType: "npc", prompt: "x" }));
    expect(res.status).toBe(502);
  });
  it("forwards 422 prompt_required", async () => {
    serviceMock.generateDraft.mockResolvedValue({ ok: false, error: "prompt_required", status: 422 });
    const res = await generatePOST(makeReq({ entityType: "npc", prompt: "" }));
    expect(res.status).toBe(422);
  });
  it("forwards 403 for a player", async () => {
    authMock.resolveSession.mockResolvedValue(player);
    serviceMock.generateDraft.mockResolvedValue({ ok: false, error: "forbidden", status: 403 });
    const res = await generatePOST(makeReq({ entityType: "npc", prompt: "x" }));
    expect(res.status).toBe(403);
  });
  it("forwards 401 when no session", async () => {
    authMock.resolveSession.mockResolvedValue(null);
    serviceMock.generateDraft.mockResolvedValue({ ok: false, error: "unauthorized", status: 401 });
    const res = await generatePOST(makeReq({ entityType: "npc", prompt: "x" }));
    expect(res.status).toBe(401);
  });
});

describe("POST /api/ai/import", () => {
  it("201 + { draft } on success", async () => {
    serviceMock.importDraft.mockResolvedValue({ ok: true, data: { ...okView, provider: "import" } });
    const res = await importPOST(makeReq({ entityType: "npc", content: "{}" }));
    expect(res.status).toBe(201);
    expect((await res.json()).draft.provider).toBe("import");
  });
  it("forwards 422 content_required", async () => {
    serviceMock.importDraft.mockResolvedValue({ ok: false, error: "content_required", status: 422 });
    const res = await importPOST(makeReq({ entityType: "npc", content: "" }));
    expect(res.status).toBe(422);
  });
});

describe("GET /api/ai/drafts", () => {
  it("200 + { drafts } list", async () => {
    serviceMock.listDraftsAction.mockResolvedValue({ ok: true, data: [okView] });
    const res = await draftsGET(makeReq(undefined, "http://localhost/api/ai/drafts"));
    expect(res.status).toBe(200);
    expect((await res.json()).drafts).toHaveLength(1);
  });
  it("passes includeRejected=true through", async () => {
    serviceMock.listDraftsAction.mockResolvedValue({ ok: true, data: [] });
    await draftsGET(makeReq(undefined, "http://localhost/api/ai/drafts?includeRejected=true"));
    expect(serviceMock.listDraftsAction).toHaveBeenCalledWith(dm, { includeRejected: true });
  });
  it("forwards 403 for player", async () => {
    authMock.resolveSession.mockResolvedValue(player);
    serviceMock.listDraftsAction.mockResolvedValue({ ok: false, error: "forbidden", status: 403 });
    const res = await draftsGET(makeReq(undefined, "http://localhost/api/ai/drafts"));
    expect(res.status).toBe(403);
  });
});

describe("PATCH /api/ai/drafts/[id]", () => {
  it("approve → 200 + { draft, createdEntityId }", async () => {
    serviceMock.approveDraft.mockResolvedValue({
      ok: true,
      data: { draft: { ...okView, status: "approved" }, createdEntityId: "npcNew" },
    });
    const res = await draftPATCH(makeReq({ action: "approve" }), { params: idParams });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.createdEntityId).toBe("npcNew");
    expect(serviceMock.approveDraft).toHaveBeenCalledWith(dm, "d1");
    expect(serviceMock.editDraft).not.toHaveBeenCalled();
  });
  it("approve → forwards 422 limit_reached", async () => {
    serviceMock.approveDraft.mockResolvedValue({ ok: false, error: "limit_reached", status: 422 });
    const res = await draftPATCH(makeReq({ action: "approve" }), { params: idParams });
    expect(res.status).toBe(422);
    expect((await res.json()).error).toBe("limit_reached");
  });
  it("no action → routes to editDraft", async () => {
    serviceMock.editDraft.mockResolvedValue({ ok: true, data: okView });
    const res = await draftPATCH(makeReq({ rawText: "new text" }), { params: idParams });
    expect(res.status).toBe(200);
    expect(serviceMock.editDraft).toHaveBeenCalledWith(dm, "d1", "new text");
    expect(serviceMock.approveDraft).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/ai/drafts/[id]", () => {
  it("200 reject on success", async () => {
    serviceMock.rejectDraft.mockResolvedValue({ ok: true, data: { id: "d1" } });
    const res = await draftDELETE(makeReq(undefined), { params: idParams });
    expect(res.status).toBe(200);
    expect(serviceMock.rejectDraft).toHaveBeenCalledWith(dm, "d1");
  });
  it("forwards 404", async () => {
    serviceMock.rejectDraft.mockResolvedValue({ ok: false, error: "not_found", status: 404 });
    const res = await draftDELETE(makeReq(undefined), { params: idParams });
    expect(res.status).toBe(404);
  });
});

describe("GET /api/ai/status (DM-only)", () => {
  it("200 + provider health for DM", async () => {
    serviceMock.getProviderStatus.mockResolvedValue({ ollama: false, import: true });
    const res = await statusGET(makeReq(undefined));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ollama: false, import: true });
  });
  it("401 when no session", async () => {
    authMock.resolveSession.mockResolvedValue(null);
    const res = await statusGET(makeReq(undefined));
    expect(res.status).toBe(401);
    expect(serviceMock.getProviderStatus).not.toHaveBeenCalled();
  });
  it("403 for a player (edge 5.9)", async () => {
    authMock.resolveSession.mockResolvedValue(player);
    const res = await statusGET(makeReq(undefined));
    expect(res.status).toBe(403);
    expect(serviceMock.getProviderStatus).not.toHaveBeenCalled();
  });
});
