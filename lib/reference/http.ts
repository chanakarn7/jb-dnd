import { NextResponse } from "next/server";

// Reference data is static after seed, but it's seeded into SQLite at RUNTIME —
// so we must NOT `force-static` (that would prerender at build time, before the
// seed, and cache an empty result). Instead we serve at request time (reads hit
// the in-memory repo cache, so it's fast) and let the browser cache the response.
export function cachedJson(data: unknown, init?: { status?: number }) {
  return NextResponse.json(data, {
    status: init?.status ?? 200,
    headers: { "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400" },
  });
}
