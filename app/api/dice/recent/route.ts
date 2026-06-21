// File: app/api/dice/recent/route.ts
// GET — last 20 public dice rolls for the caller's campaign.
// Any authenticated session may call this (initial feed load or reconnect).

import { NextResponse } from "next/server";
import { resolveSession } from "@/lib/characters/auth";
import { getRollFeedAction } from "@/lib/player-ui/service";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await resolveSession(req);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const rolls = await getRollFeedAction(session);
  return NextResponse.json({ rolls });
}
