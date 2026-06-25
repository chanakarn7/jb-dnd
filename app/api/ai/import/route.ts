// File: app/api/ai/import/route.ts
// AI · import — POST pasted text → parse → staged AIDraft (DM only).
// Always available (offline). 201 · 401 · 403 · 422.

import { resolveSession } from "@/lib/characters/auth";
import { importDraft } from "@/lib/ai/service";
import { readJson, respond } from "@/lib/ai/http";
import type { ImportInput } from "@/lib/ai/types";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const session = await resolveSession(req);
  const body = (await readJson(req)) as Partial<ImportInput>;
  const input: ImportInput = {
    entityType: body.entityType as ImportInput["entityType"],
    content: typeof body.content === "string" ? body.content : "",
  };
  return respond(await importDraft(session, input), "draft", 201);
}
