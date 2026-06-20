// File: app/api/story/quests/[id]/route.ts
// Story · Quest item — GET detail (parsed objectives) · PATCH (DM) · DELETE (DM).

import { resolveSession } from "@/lib/characters/auth";
import { getQuestAction, updateQuestAction, deleteQuestAction } from "@/lib/story/service";
import { readJson, respond, respondDelete } from "@/lib/story/http";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await resolveSession(req);
  return respond(await getQuestAction(session, id), "quest");
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await resolveSession(req);
  return respond(await updateQuestAction(session, id, await readJson(req)), "quest");
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await resolveSession(req);
  return respondDelete(await deleteQuestAction(session, id));
}
