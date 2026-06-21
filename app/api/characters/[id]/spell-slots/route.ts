// File: app/api/characters/[id]/spell-slots/route.ts
// PATCH { spellSlotsUsed: Record<string, number> } — update used spell slots.
// Owner or DM only. Validates used ≤ total per level.

import { NextResponse } from "next/server";
import { resolveSession } from "@/lib/characters/auth";
import { updateSpellSlotsAction } from "@/lib/player-ui/service";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await resolveSession(req);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }

  const spellSlotsUsed = (body as Record<string, unknown>)?.spellSlotsUsed;
  const result = await updateSpellSlotsAction(session, id, spellSlotsUsed);

  if ("error" in result) {
    if (result.error === "forbidden") return NextResponse.json({ error: "forbidden" }, { status: 403 });
    if (result.error === "not_found") return NextResponse.json({ error: "not_found" }, { status: 404 });
    if (result.error.startsWith("invalid") || result.error.startsWith("slots_exceed")) {
      return NextResponse.json({ error: result.error }, { status: 422 });
    }
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json(result);
}
