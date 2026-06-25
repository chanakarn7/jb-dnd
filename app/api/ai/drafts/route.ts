// File: app/api/ai/drafts/route.ts
// AI · drafts collection — GET list pending drafts (?includeRejected=true) (DM only).
// 200 · 401 · 403.

import { resolveSession } from "@/lib/characters/auth";
import { listDraftsAction } from "@/lib/ai/service";
import { respond } from "@/lib/ai/http";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await resolveSession(req);
  const includeRejected = new URL(req.url).searchParams.get("includeRejected") === "true";
  return respond(await listDraftsAction(session, { includeRejected }), "drafts");
}
