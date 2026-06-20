// File: app/api/story/sessions/[id]/route.ts
// Story · Session item — GET detail · PATCH (DM) · DELETE (DM).
// Next.js 16: params is a Promise → `const { id } = await params`.

import { resolveSession } from "@/lib/characters/auth";
import {
  getSessionAction,
  updateSessionAction,
  deleteSessionAction,
} from "@/lib/story/service";
import { readJson, respond, respondDelete } from "@/lib/story/http";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await resolveSession(req);
  return respond(await getSessionAction(session, id), "session");
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await resolveSession(req);
  return respond(await updateSessionAction(session, id, await readJson(req)), "session");
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await resolveSession(req);
  return respondDelete(await deleteSessionAction(session, id));
}
