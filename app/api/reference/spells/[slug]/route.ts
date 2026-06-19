import { getSpell } from "@/lib/reference/repo";
import { cachedJson } from "@/lib/reference/http";

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const spell = await getSpell(slug);
  if (!spell) return cachedJson({ error: "not_found" }, { status: 404 });
  return cachedJson(spell);
}
