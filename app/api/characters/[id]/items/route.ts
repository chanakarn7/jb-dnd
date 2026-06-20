// File: app/api/characters/[id]/items/route.ts
// GET (list inventory) + POST (add item). Authz: owner or DM only (PRD §2).
import { NextResponse } from "next/server";
import { resolveSession } from "@/lib/characters/auth";
import { findInCampaign } from "@/lib/characters/charRepo";
import { canWrite } from "@/lib/characters/service";
import { addItem, toInventoryView } from "@/lib/inventory/service";
import type { AddItemInput } from "@/lib/inventory/types";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await resolveSession(req);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const character = await findInCampaign(session.campaignId, id);
  if (!character) return NextResponse.json({ error: "not_found" }, { status: 404 });
  // PRD §2: players can only read their own character's inventory
  if (!canWrite(character, session)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  return NextResponse.json(await toInventoryView(session.campaignId, id));
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await resolveSession(req);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let input: AddItemInput;
  try {
    input = (await req.json()) as AddItemInput;
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  if (!input?.itemSlug) return NextResponse.json({ error: "missing_fields" }, { status: 400 });

  const result = await addItem(session, id, input);
  if ("error" in result) {
    const status = result.error === "unauthorized" ? 401 : result.error === "forbidden" ? 403 : result.error === "not_found" ? 404 : 422;
    return NextResponse.json(result, { status });
  }
  return NextResponse.json(result, { status: 201 });
}
