// File: app/api/ai/drafts/[id]/route.ts
// AI · draft item — PATCH (approve | edit) · DELETE (reject) (DM only).
// 200 · 401 · 403 · 404 · 422.

import { resolveSession } from "@/lib/characters/auth";
import { approveDraft, editDraft, rejectDraft } from "@/lib/ai/service";
import { readJson, respond } from "@/lib/ai/http";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await resolveSession(req);
  const body = (await readJson(req)) as { action?: string; rawText?: unknown };

  if (body.action === "approve") {
    const result = await approveDraft(session, id);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json(
      { draft: result.data.draft, createdEntityId: result.data.createdEntityId },
      { status: 200 },
    );
  }
  // Default: edit the raw text of a pending draft.
  return respond(await editDraft(session, id, body.rawText), "draft");
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await resolveSession(req);
  return respond(await rejectDraft(session, id), "rejected");
}
