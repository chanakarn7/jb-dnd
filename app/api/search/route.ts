// File: app/api/search/route.ts
// GET ?q=<query> — global search across campaign + 5e reference.
// campaignId always from session token, NEVER from query string.

import { NextResponse } from "next/server";
import { resolveSession } from "@/lib/characters/auth";
import { searchAction } from "@/lib/player-ui/service";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await resolveSession(req);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? "";

  const result = await searchAction(session, q);
  if ("error" in result) {
    if (result.error === "query_too_short") return NextResponse.json({ error: result.error }, { status: 422 });
    if (result.error === "query_too_long") return NextResponse.json({ error: result.error }, { status: 422 });
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ results: result });
}
