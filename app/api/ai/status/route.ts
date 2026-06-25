// File: app/api/ai/status/route.ts
// AI · status — GET provider health { ollama, import } (DM only — AI panel is DM-only).
// 200 · 401 · 403.

import { resolveSession } from "@/lib/characters/auth";
import { getProviderStatus } from "@/lib/ai/service";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await resolveSession(req);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (session.role !== "dm") return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const status = await getProviderStatus();
  return NextResponse.json(status, { status: 200 });
}
