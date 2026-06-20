// File: app/api/characters/[id]/currency/route.ts
// PATCH: set all five currency denominations (pp/gp/ep/sp/cp).
// Separate from the character PATCH to avoid touching recompute/override logic (SA §4 rationale).
import { NextResponse } from "next/server";
import { resolveSession } from "@/lib/characters/auth";
import { setCurrency } from "@/lib/inventory/service";
import type { SetCurrencyInput } from "@/lib/inventory/types";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await resolveSession(req);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let input: SetCurrencyInput;
  try {
    input = (await req.json()) as SetCurrencyInput;
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const result = await setCurrency(session, id, input);
  if ("error" in result) {
    const status = result.error === "unauthorized" ? 401 : result.error === "forbidden" ? 403 : result.error === "not_found" ? 404 : 422;
    return NextResponse.json(result, { status });
  }
  return NextResponse.json(result);
}
