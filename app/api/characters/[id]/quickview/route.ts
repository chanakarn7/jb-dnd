// File: app/api/characters/[id]/quickview/route.ts
// GET — player quick-view snapshot: HP/AC/slots/conditions/ability scores.
// Own character or DM only.

import { NextResponse } from "next/server";
import { resolveSession } from "@/lib/characters/auth";
import { getQuickViewAction } from "@/lib/player-ui/service";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await resolveSession(req);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const result = await getQuickViewAction(session, id);
  if ("error" in result) {
    if (result.error === "forbidden") return NextResponse.json({ error: "forbidden" }, { status: 403 });
    if (result.error === "not_found") return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ quickview: result });
}
