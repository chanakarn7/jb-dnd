// File: app/api/reference/backgrounds/[slug]/route.ts
import { cachedJson } from "@/lib/reference/http";
import { getBackground } from "@/lib/characters/refRepo";

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const b = await getBackground(slug);
  return b ? cachedJson(b) : cachedJson({ error: "not_found" }, { status: 404 });
}
