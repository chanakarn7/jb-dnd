// File: lib/story/http.ts
// Thin helpers to translate Story service results into HTTP responses.
// Keeps every route handler tiny and consistent (401/403/404/422 + success key).

import { NextResponse } from "next/server";
import type { StoryResult } from "./types";

/** Safely parse a JSON request body; returns {} on empty/invalid (validators then 422). */
export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return {};
  }
}

/** Map a service result to a JSON response. `key` wraps successful data; `status` for success (200/201). */
export function respond<T>(
  result: StoryResult<T>,
  key: string,
  successStatus = 200,
): NextResponse {
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ [key]: result.data }, { status: successStatus });
}

/** Map a delete result to 204 (no content) on success, error status otherwise. */
export function respondDelete(result: StoryResult<{ id: string }>): NextResponse {
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return new NextResponse(null, { status: 204 });
}
