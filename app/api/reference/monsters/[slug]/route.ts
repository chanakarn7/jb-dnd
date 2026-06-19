import { getMonster } from "@/lib/reference/repo";
import { cachedJson } from "@/lib/reference/http";

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const monster = await getMonster(slug);
  if (!monster) return cachedJson({ error: "not_found" }, { status: 404 });
  return cachedJson(monster);
}
