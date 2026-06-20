// File: app/api/characters/[id]/spells/route.ts
// Manage a caster's known/prepared spells. Same authz as the character (owner | DM).
import { NextResponse } from "next/server";
import { resolveSession } from "@/lib/characters/auth";
import { findInCampaign } from "@/lib/characters/charRepo";
import { canWrite, manageSpell } from "@/lib/characters/service";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await resolveSession(req);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const character = await findInCampaign(session.campaignId, id);
  if (!character) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!canWrite(character, session)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  let body: { action?: string; spellSlug?: string };
  try {
    body = (await req.json()) as { action?: string; spellSlug?: string };
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const result = await manageSpell(character, session, body.action ?? "", body.spellSlug ?? "");
  if ("error" in result) return NextResponse.json(result, { status: 422 });
  return NextResponse.json(result);
}
