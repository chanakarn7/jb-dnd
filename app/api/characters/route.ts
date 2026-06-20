// File: app/api/characters/route.ts
// Prep-time CRUD over REST (ARCHITECTURE: live mutation is Combat/socket; this is
// not-during-play create/edit). Session re-derived from the bearer token, never the body.
import { NextResponse } from "next/server";
import { resolveSession } from "@/lib/characters/auth";
import { createCharacter, listForCampaign } from "@/lib/characters/service";
import type { CreateCharacterInput } from "@/lib/characters/types";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await resolveSession(req);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json(await listForCampaign(session));
}

export async function POST(req: Request) {
  const session = await resolveSession(req);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  let input: CreateCharacterInput;
  try {
    input = (await req.json()) as CreateCharacterInput;
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  if (!input?.name?.trim() || !input.classSlug || !input.raceSlug || !input.baseAbilities) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }
  const result = await createCharacter(session, input);
  if ("error" in result) return NextResponse.json(result, { status: 422 });
  return NextResponse.json(result, { status: 201 });
}
