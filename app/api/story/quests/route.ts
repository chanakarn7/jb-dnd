// File: app/api/story/quests/route.ts
// Story · Quests collection — GET list (optional ?status=) · POST create (DM only).

import { resolveSession } from "@/lib/characters/auth";
import { listQuestsAction, createQuestAction } from "@/lib/story/service";
import { readJson, respond } from "@/lib/story/http";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await resolveSession(req);
  const status = new URL(req.url).searchParams.get("status") ?? undefined;
  return respond(await listQuestsAction(session, status), "quests");
}

export async function POST(req: Request) {
  const session = await resolveSession(req);
  return respond(await createQuestAction(session, await readJson(req)), "quest", 201);
}
