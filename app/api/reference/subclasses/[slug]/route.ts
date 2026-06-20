// File: app/api/reference/subclasses/[slug]/route.ts
import { cachedJson } from "@/lib/reference/http";
import { getSubclass } from "@/lib/characters/refRepo";

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const s = await getSubclass(slug);
  return s ? cachedJson(s) : cachedJson({ error: "not_found" }, { status: 404 });
}
