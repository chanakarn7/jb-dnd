import { describe, it, expect, vi, beforeEach } from "vitest";

// QA Stage 8 — REST authz resolves the session from the bearer token ONLY (never the
// body); server re-derives campaignId/role from the DB (ARCHITECTURE join model).

const findFirst = vi.hoisted(() => vi.fn());
vi.mock("@/lib/db", () => ({ prisma: { playerSession: { findFirst } } }));

import { bearerToken, resolveSession } from "@/lib/characters/auth";

const req = (headers: Record<string, string>) => new Request("http://x/api/characters", { headers });

describe("bearerToken", () => {
  it("reads an Authorization: Bearer header", () => {
    expect(bearerToken(req({ authorization: "Bearer abc123" }))).toBe("abc123");
  });
  it("falls back to x-session-token", () => {
    expect(bearerToken(req({ "x-session-token": "tok-9" }))).toBe("tok-9");
  });
  it("returns null when no token header is present", () => {
    expect(bearerToken(req({}))).toBeNull();
  });
});

describe("resolveSession", () => {
  beforeEach(() => vi.clearAllMocks());

  it("maps a known token to { sessionId, campaignId, role } from the DB", async () => {
    findFirst.mockResolvedValue({ id: "sess-1", campaignId: "camp-1", role: "dm" });
    const s = await resolveSession(req({ authorization: "Bearer good" }));
    expect(s).toEqual({ sessionId: "sess-1", campaignId: "camp-1", role: "dm" });
    expect(findFirst).toHaveBeenCalledWith({ where: { sessionToken: "good" }, select: { id: true, campaignId: true, role: true } });
  });
  it("normalizes any non-dm role to 'player'", async () => {
    findFirst.mockResolvedValue({ id: "s", campaignId: "c", role: "player" });
    expect((await resolveSession(req({ authorization: "Bearer p" })))?.role).toBe("player");
  });
  it("returns null for a missing token (no DB hit)", async () => {
    expect(await resolveSession(req({}))).toBeNull();
    expect(findFirst).not.toHaveBeenCalled();
  });
  it("returns null for an unknown token", async () => {
    findFirst.mockResolvedValue(null);
    expect(await resolveSession(req({ authorization: "Bearer ghost" }))).toBeNull();
  });
});
