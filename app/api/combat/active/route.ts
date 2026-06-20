// File: app/api/combat/active/route.ts
// GET the active encounter snapshot for the caller's campaign.
// Returns { encounter: null } (not 404) when no active encounter exists (PRD §5 edge 5.8).
// Session re-derived from bearer token — never trusts campaignId from payload.

import { NextResponse } from "next/server";
import { resolveSession } from "@/lib/characters/auth";
import * as repo from "@/lib/combat/repo";
import { buildSnapshot } from "@/lib/combat/rules";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await resolveSession(req);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const encounter = await repo.getActiveEncounter(session.campaignId);
  if (!encounter) return NextResponse.json({ encounter: null });

  return NextResponse.json({ encounter: buildSnapshot(encounter, encounter.combatants) });
}
