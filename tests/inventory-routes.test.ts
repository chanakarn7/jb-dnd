import { describe, it, expect, vi, beforeEach } from "vitest";

// Route-level smoke tests for Inventory endpoints.
// Verifies that route handlers return the correct HTTP status codes when
// session is missing (401), character not found (404), and when the
// service layer returns specific error codes. Does NOT touch the DB.

const authMock = vi.hoisted(() => ({ resolveSession: vi.fn() }));
const serviceMock = vi.hoisted(() => ({
  addItem: vi.fn(),
  setItemFields: vi.fn(),
  removeItem: vi.fn(),
  setCurrency: vi.fn(),
  toInventoryView: vi.fn(),
}));
const charRepoMock = vi.hoisted(() => ({ findInCampaign: vi.fn() }));
const canWriteMock = vi.hoisted(() => ({ canWrite: vi.fn() }));

vi.mock("@/lib/characters/auth", () => authMock);
vi.mock("@/lib/inventory/service", () => serviceMock);
vi.mock("@/lib/characters/charRepo", () => charRepoMock);
vi.mock("@/lib/characters/service", () => canWriteMock);

import { GET as itemsGET, POST as itemsPOST } from "@/app/api/characters/[id]/items/route";
import { PATCH as itemPATCH, DELETE as itemDELETE } from "@/app/api/characters/[id]/items/[itemId]/route";
import { PATCH as currencyPATCH } from "@/app/api/characters/[id]/currency/route";

const session = { sessionId: "s1", campaignId: "c1", role: "player" as const };
const char = { id: "char1", campaignId: "c1", ownerSessionId: "s1", isNpc: false };
const emptyView = { items: [], attunedCount: 0, attunementCap: 3, currency: { pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 } };

function makeReq(body?: unknown): Request {
  if (body === undefined) return new Request("http://localhost/");
  return new Request("http://localhost/", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const charParams = Promise.resolve({ id: "char1" });
const itemParams = Promise.resolve({ id: "char1", itemId: "ci1" });

beforeEach(() => {
  vi.clearAllMocks();
  authMock.resolveSession.mockResolvedValue(session);
  charRepoMock.findInCampaign.mockResolvedValue(char);
  canWriteMock.canWrite.mockReturnValue(true);
  serviceMock.toInventoryView.mockResolvedValue(emptyView);
});

// ── GET /api/characters/[id]/items ────────────────────────────────────
describe("GET /items", () => {
  it("401 when no session (edge 5.16)", async () => {
    authMock.resolveSession.mockResolvedValue(null);
    const res = await itemsGET(makeReq(), { params: charParams });
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "unauthorized" });
  });

  it("404 when character not in campaign (edge 5.10)", async () => {
    charRepoMock.findInCampaign.mockResolvedValue(null);
    const res = await itemsGET(makeReq(), { params: charParams });
    expect(res.status).toBe(404);
  });

  it("403 when player reads another character (edge 5.5)", async () => {
    canWriteMock.canWrite.mockReturnValue(false);
    const res = await itemsGET(makeReq(), { params: charParams });
    expect(res.status).toBe(403);
  });

  it("200 with inventory view on success", async () => {
    const res = await itemsGET(makeReq(), { params: charParams });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.attunementCap).toBe(3);
  });
});

// ── POST /api/characters/[id]/items ────────────────────────────────────
describe("POST /items", () => {
  it("401 when no session (edge 5.16)", async () => {
    authMock.resolveSession.mockResolvedValue(null);
    const res = await itemsPOST(makeReq({ itemSlug: "longsword" }), { params: charParams });
    expect(res.status).toBe(401);
  });

  it("400 when body has no itemSlug", async () => {
    const res = await itemsPOST(makeReq({}), { params: charParams });
    expect(res.status).toBe(400);
  });

  it("403 when service returns forbidden (edge 5.5)", async () => {
    serviceMock.addItem.mockResolvedValue({ error: "forbidden" });
    const res = await itemsPOST(makeReq({ itemSlug: "longsword" }), { params: charParams });
    expect(res.status).toBe(403);
  });

  it("404 when service returns not_found (edge 5.3)", async () => {
    serviceMock.addItem.mockResolvedValue({ error: "not_found" });
    const res = await itemsPOST(makeReq({ itemSlug: "ghost-slug" }), { params: charParams });
    expect(res.status).toBe(404);
  });

  it("422 when service returns invalid_quantity (edge 5.4)", async () => {
    serviceMock.addItem.mockResolvedValue({ error: "invalid_quantity" });
    const res = await itemsPOST(makeReq({ itemSlug: "longsword", quantity: 0 }), { params: charParams });
    expect(res.status).toBe(422);
  });

  it("201 on success", async () => {
    serviceMock.addItem.mockResolvedValue(emptyView);
    const res = await itemsPOST(makeReq({ itemSlug: "longsword" }), { params: charParams });
    expect(res.status).toBe(201);
  });
});

// ── PATCH /api/characters/[id]/items/[itemId] ─────────────────────────
describe("PATCH /items/[itemId]", () => {
  it("401 when no session (edge 5.16)", async () => {
    authMock.resolveSession.mockResolvedValue(null);
    const res = await itemPATCH(makeReq({ equipped: true }), { params: itemParams });
    expect(res.status).toBe(401);
  });

  it("422 for not_attunable (edge 5.1)", async () => {
    serviceMock.setItemFields.mockResolvedValue({ error: "not_attunable" });
    const res = await itemPATCH(makeReq({ attuned: true }), { params: itemParams });
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ error: "not_attunable" });
  });

  it("422 for attunement_limit (edge 5.2)", async () => {
    serviceMock.setItemFields.mockResolvedValue({ error: "attunement_limit" });
    const res = await itemPATCH(makeReq({ attuned: true }), { params: itemParams });
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ error: "attunement_limit" });
  });

  it("422 for invalid_quantity (edge 5.4)", async () => {
    serviceMock.setItemFields.mockResolvedValue({ error: "invalid_quantity" });
    const res = await itemPATCH(makeReq({ quantity: 0 }), { params: itemParams });
    expect(res.status).toBe(422);
  });

  it("403 for forbidden (edge 5.5)", async () => {
    serviceMock.setItemFields.mockResolvedValue({ error: "forbidden" });
    const res = await itemPATCH(makeReq({ equipped: true }), { params: itemParams });
    expect(res.status).toBe(403);
  });

  it("404 when item not in character (cross-ownership)", async () => {
    serviceMock.setItemFields.mockResolvedValue({ error: "not_found" });
    const res = await itemPATCH(makeReq({ equipped: true }), { params: itemParams });
    expect(res.status).toBe(404);
  });

  it("200 on success", async () => {
    serviceMock.setItemFields.mockResolvedValue(emptyView);
    const res = await itemPATCH(makeReq({ equipped: true }), { params: itemParams });
    expect(res.status).toBe(200);
  });
});

// ── DELETE /api/characters/[id]/items/[itemId] ────────────────────────
describe("DELETE /items/[itemId]", () => {
  it("401 when no session (edge 5.16)", async () => {
    authMock.resolveSession.mockResolvedValue(null);
    const res = await itemDELETE(makeReq(), { params: itemParams });
    expect(res.status).toBe(401);
  });

  it("403 for forbidden (edge 5.5)", async () => {
    serviceMock.removeItem.mockResolvedValue({ error: "forbidden" });
    const res = await itemDELETE(makeReq(), { params: itemParams });
    expect(res.status).toBe(403);
  });

  it("404 when item not found", async () => {
    serviceMock.removeItem.mockResolvedValue({ error: "not_found" });
    const res = await itemDELETE(makeReq(), { params: itemParams });
    expect(res.status).toBe(404);
  });

  it("200 with empty inventory after last item removed (edge 5.6)", async () => {
    serviceMock.removeItem.mockResolvedValue(emptyView);
    const res = await itemDELETE(makeReq(), { params: itemParams });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toHaveLength(0);
  });
});

// ── PATCH /api/characters/[id]/currency ──────────────────────────────
describe("PATCH /currency", () => {
  it("401 when no session (edge 5.16)", async () => {
    authMock.resolveSession.mockResolvedValue(null);
    const res = await currencyPATCH(makeReq({ gp: 10 }), { params: charParams });
    expect(res.status).toBe(401);
  });

  it("403 for forbidden (edge 5.5)", async () => {
    serviceMock.setCurrency.mockResolvedValue({ error: "forbidden" });
    const res = await currencyPATCH(makeReq({ gp: 10 }), { params: charParams });
    expect(res.status).toBe(403);
  });

  it("422 for invalid_currency — negative value (edge 5.7)", async () => {
    serviceMock.setCurrency.mockResolvedValue({ error: "invalid_currency" });
    const res = await currencyPATCH(makeReq({ gp: -1 }), { params: charParams });
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ error: "invalid_currency" });
  });

  it("200 on success", async () => {
    serviceMock.setCurrency.mockResolvedValue({ currency: { pp: 0, gp: 10, ep: 0, sp: 0, cp: 0 } });
    const res = await currencyPATCH(makeReq({ gp: 10 }), { params: charParams });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.currency.gp).toBe(10);
  });
});
