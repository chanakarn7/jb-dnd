// File: app/api/story/npcs/route.ts
// Story · NPCs collection — GET list (optional ?isAlive= / ?faction=) · POST (DM only).

import { resolveSession } from "@/lib/characters/auth";
import { listNpcsAction, createNpcAction } from "@/lib/story/service";
import { readJson, respond } from "@/lib/story/http";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await resolveSession(req);
  const sp = new URL(req.url).searchParams;
  const aliveParam = sp.get("isAlive");
  const faction = sp.get("faction") ?? undefined;
  const filters = {
    ...(aliveParam !== null ? { isAlive: aliveParam === "true" } : {}),
    ...(faction ? { faction } : {}),
  };
  return respond(await listNpcsAction(session, filters), "npcs");
}

export async function POST(req: Request) {
  const session = await resolveSession(req);
  return respond(await createNpcAction(session, await readJson(req)), "npc", 201);
}
