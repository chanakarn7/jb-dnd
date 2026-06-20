// File: app/api/characters/[id]/items/[itemId]/route.ts
// PATCH (equip / attune / quantity) + DELETE (remove item).
import { NextResponse } from "next/server";
import { resolveSession } from "@/lib/characters/auth";
import { setItemFields, removeItem } from "@/lib/inventory/service";
import type { UpdateItemInput } from "@/lib/inventory/types";

export const dynamic = "force-dynamic";

function errorStatus(code: string): number {
  if (code === "unauthorized") return 401;
  if (code === "forbidden") return 403;
  if (code === "not_found") return 404;
  return 422; // not_attunable | attunement_limit | invalid_quantity
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string; itemId: string }> }) {
  const { id, itemId } = await params;
  const session = await resolveSession(req);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let patch: UpdateItemInput;
  try {
    patch = (await req.json()) as UpdateItemInput;
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const result = await setItemFields(session, id, itemId, patch);
  if ("error" in result) return NextResponse.json(result, { status: errorStatus(result.error) });
  return NextResponse.json(result);
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string; itemId: string }> }) {
  const { id, itemId } = await params;
  const session = await resolveSession(req);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const result = await removeItem(session, id, itemId);
  if ("error" in result) return NextResponse.json(result, { status: errorStatus(result.error) });
  return NextResponse.json(result);
}
