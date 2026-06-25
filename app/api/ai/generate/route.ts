// File: app/api/ai/generate/route.ts
// AI · generate — POST prompt → LLM → staged AIDraft (DM only).
// 201 success · 401 no session · 403 player · 422 validation · 502 provider error · 503 no provider.

import { resolveSession } from "@/lib/characters/auth";
import { generateDraft } from "@/lib/ai/service";
import { readJson, respond } from "@/lib/ai/http";
import type { GenerateInput } from "@/lib/ai/types";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const session = await resolveSession(req);
  const body = (await readJson(req)) as Partial<GenerateInput>;
  const input: GenerateInput = {
    entityType: body.entityType as GenerateInput["entityType"],
    prompt: typeof body.prompt === "string" ? body.prompt : "",
    context: body.context,
  };
  return respond(await generateDraft(session, input), "draft", 201);
}
