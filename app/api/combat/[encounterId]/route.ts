// File: app/api/combat/[encounterId]/route.ts
// GET a specific encounter by ID (any status — used for history).
// Campaign-scoped: returns 404 if the encounter doesn't belong to caller's campaign.

import { NextResponse } from "next/server";
import { resolveSession } from "@/lib/characters/auth";
import * as repo from "@/lib/combat/repo";
import { buildSnapshot } from "@/lib/combat/rules";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ encounterId: string }> },
) {
  const { encounterId } = await params;
  const session = await resolveSession(req);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const encounter = await repo.getEncounterById(session.campaignId, encounterId);
  if (!encounter) return NextResponse.json({ error: "not_found" }, { status: 404 });

  return NextResponse.json({ encounter: buildSnapshot(encounter, encounter.combatants) });
}
