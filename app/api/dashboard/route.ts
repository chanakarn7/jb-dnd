// File: app/api/dashboard/route.ts
// GET — campaign dashboard snapshot (DM only).
// Returns aggregate counts, active quests, roster, last session.

import { NextResponse } from "next/server";
import { resolveSession } from "@/lib/characters/auth";
import { getDashboardAction } from "@/lib/player-ui/service";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await resolveSession(req);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const result = await getDashboardAction(session);
  if ("error" in result) {
    if (result.error === "forbidden") return NextResponse.json({ error: "forbidden" }, { status: 403 });
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ dashboard: result });
}
