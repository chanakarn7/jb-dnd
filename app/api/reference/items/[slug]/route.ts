import { getItem } from "@/lib/reference/repo";
import { cachedJson } from "@/lib/reference/http";

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const item = await getItem(slug);
  if (!item) return cachedJson({ error: "not_found" }, { status: 404 });
  return cachedJson(item);
}
