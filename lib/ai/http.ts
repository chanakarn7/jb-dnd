// File: lib/ai/http.ts
// Thin helpers to translate AI service results into HTTP responses.
// Keeps every route handler tiny + consistent (401/403/404/422/502/503 + success key).

import { NextResponse } from "next/server";
import type { AIResult } from "./types";

/** Safely parse a JSON request body; returns {} on empty/invalid (validators then 422). */
export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return {};
  }
}

/** Map a service result to a JSON response. `key` wraps successful data; `status` for success. */
export function respond<T>(result: AIResult<T>, key: string, successStatus = 200): NextResponse {
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ [key]: result.data }, { status: successStatus });
}
