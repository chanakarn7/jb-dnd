// File: app/api/story/npcs/[id]/route.ts
// Story · NPC item — GET detail · PATCH (DM, incl. isAlive toggle) · DELETE (DM).

import { resolveSession } from "@/lib/characters/auth";
import { getNpcAction, updateNpcAction, deleteNpcAction } from "@/lib/story/service";
import { readJson, respond, respondDelete } from "@/lib/story/http";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await resolveSession(req);
  return respond(await getNpcAction(session, id), "npc");
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await resolveSession(req);
  return respond(await updateNpcAction(session, id, await readJson(req)), "npc");
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await resolveSession(req);
  return respondDelete(await deleteNpcAction(session, id));
}
