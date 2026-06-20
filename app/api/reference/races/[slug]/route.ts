// File: app/api/reference/races/[slug]/route.ts
import { cachedJson } from "@/lib/reference/http";
import { getRace } from "@/lib/characters/refRepo";

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const r = await getRace(slug);
  return r ? cachedJson(r) : cachedJson({ error: "not_found" }, { status: 404 });
}
