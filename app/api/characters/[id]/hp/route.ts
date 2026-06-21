// File: app/api/characters/[id]/hp/route.ts
// PATCH { hpCurrent: number } — quick HP edit. Owner or DM only.
// Clamps to [0, maxHp]. Returns { currentHp }.

import { NextResponse } from "next/server";
import { resolveSession } from "@/lib/characters/auth";
import { updateHpAction } from "@/lib/player-ui/service";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await resolveSession(req);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }

  const hpCurrent = (body as Record<string, unknown>)?.hpCurrent;
  const result = await updateHpAction(session, id, hpCurrent);

  if ("error" in result) {
    if (result.error === "forbidden") return NextResponse.json({ error: "forbidden" }, { status: 403 });
    if (result.error === "not_found") return NextResponse.json({ error: "not_found" }, { status: 404 });
    if (result.error === "invalid_hp") return NextResponse.json({ error: "invalid_hp" }, { status: 422 });
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json(result);
}
