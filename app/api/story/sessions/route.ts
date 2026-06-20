// File: app/api/story/sessions/route.ts
// Story · Sessions collection — GET list (any session) · POST create (DM only).
// Session re-derived from bearer token; campaignId never from payload.

import { resolveSession } from "@/lib/characters/auth";
import { listSessionsAction, createSessionAction } from "@/lib/story/service";
import { readJson, respond } from "@/lib/story/http";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await resolveSession(req);
  return respond(await listSessionsAction(session), "sessions");
}

export async function POST(req: Request) {
  const session = await resolveSession(req);
  return respond(await createSessionAction(session, await readJson(req)), "session", 201);
}
