// File: app/api/characters/[id]/route.ts
import { NextResponse } from "next/server";
import { resolveSession } from "@/lib/characters/auth";
import { findInCampaign, remove } from "@/lib/characters/charRepo";
import { prisma } from "@/lib/db";
import { canWrite, toDetail, updateCharacter, type Session } from "@/lib/characters/service";
import type { UpdateCharacterInput } from "@/lib/characters/types";

export const dynamic = "force-dynamic";

// Load the character within the session's campaign (cross-tenant → 404, never leak existence).
async function loadOwned(req: Request, id: string): Promise<{ session: Session; character: Awaited<ReturnType<typeof findInCampaign>> } | { status: number }> {
  const session = await resolveSession(req);
  if (!session) return { status: 401 };
  const character = await findInCampaign(session.campaignId, id);
  if (!character) return { status: 404 };
  return { session, character };
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await loadOwned(req, id);
  if ("status" in r) return NextResponse.json({ error: "not_found" }, { status: r.status });
  return NextResponse.json(await toDetail(r.character!, r.session));
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await loadOwned(req, id);
  if ("status" in r) return NextResponse.json({ error: "not_found" }, { status: r.status });
  if (!canWrite(r.character!, r.session)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  let input: UpdateCharacterInput;
  try {
    input = (await req.json()) as UpdateCharacterInput;
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const result = await updateCharacter(r.character!, r.session, input);
  if ("error" in result) return NextResponse.json(result, { status: 422 });
  return NextResponse.json(result);
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await loadOwned(req, id);
  if ("status" in r) return NextResponse.json({ error: "not_found" }, { status: r.status });
  if (!canWrite(r.character!, r.session)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  // FK onDelete: SetNull unclaims the PlayerSession automatically; also clear denormalized field.
  await prisma.playerSession.updateMany({ where: { characterId: id }, data: { characterId: null } });
  await remove(id);
  return NextResponse.json({ ok: true });
}
