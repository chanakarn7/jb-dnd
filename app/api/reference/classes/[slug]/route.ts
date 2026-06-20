// File: app/api/reference/classes/[slug]/route.ts
import { cachedJson } from "@/lib/reference/http";
import { getClass } from "@/lib/characters/refRepo";

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const c = await getClass(slug);
  return c ? cachedJson(c) : cachedJson({ error: "not_found" }, { status: 404 });
}
