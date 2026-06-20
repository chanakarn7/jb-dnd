// File: app/api/story/journal/route.ts
// Story · Journal collection — GET list (optional ?sessionId=) · POST (DM only).

import { resolveSession } from "@/lib/characters/auth";
import { listJournalAction, createJournalAction } from "@/lib/story/service";
import { readJson, respond } from "@/lib/story/http";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await resolveSession(req);
  const sessionId = new URL(req.url).searchParams.get("sessionId") ?? undefined;
  return respond(await listJournalAction(session, sessionId), "entries");
}

export async function POST(req: Request) {
  const session = await resolveSession(req);
  return respond(await createJournalAction(session, await readJson(req)), "entry", 201);
}
