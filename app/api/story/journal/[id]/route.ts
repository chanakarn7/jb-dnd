// File: app/api/story/journal/[id]/route.ts
// Story · Journal item — GET detail (full content) · PATCH (DM) · DELETE (DM).

import { resolveSession } from "@/lib/characters/auth";
import { getJournalAction, updateJournalAction, deleteJournalAction } from "@/lib/story/service";
import { readJson, respond, respondDelete } from "@/lib/story/http";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await resolveSession(req);
  return respond(await getJournalAction(session, id), "entry");
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await resolveSession(req);
  return respond(await updateJournalAction(session, id, await readJson(req)), "entry");
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await resolveSession(req);
  return respondDelete(await deleteJournalAction(session, id));
}
