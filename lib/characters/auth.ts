// File: lib/characters/auth.ts
// Resolves a REST request's session from its bearer token (the same secret the
// socket auths with, stored in PlayerSession.sessionToken — DM and player alike).
// Server-authoritative: we NEVER trust a campaignId/role from the client payload,
// only what the token maps to in the DB (ARCHITECTURE join model).
import { prisma } from "@/lib/db";
import type { Session } from "./service";

export function bearerToken(req: Request): string | null {
  const h = req.headers.get("authorization") ?? "";
  const m = /^Bearer\s+(.+)$/i.exec(h);
  if (m) return m[1].trim();
  return req.headers.get("x-session-token");
}

export async function resolveSession(req: Request): Promise<Session | null> {
  const token = bearerToken(req);
  if (!token) return null;
  const ps = await prisma.playerSession.findFirst({
    where: { sessionToken: token },
    select: { id: true, campaignId: true, role: true },
  });
  if (!ps) return null;
  return { sessionId: ps.id, campaignId: ps.campaignId, role: ps.role === "dm" ? "dm" : "player" };
}

/** Resolves a raw token string (used by Socket.io handlers — no Request object). */
export async function resolveSessionByToken(token: string | undefined | null): Promise<Session | null> {
  if (!token) return null;
  const ps = await prisma.playerSession.findFirst({
    where: { sessionToken: token },
    select: { id: true, campaignId: true, role: true },
  });
  if (!ps) return null;
  return { sessionId: ps.id, campaignId: ps.campaignId, role: ps.role === "dm" ? "dm" : "player" };
}
