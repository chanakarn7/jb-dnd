// File: app/api/reference/subclasses/route.ts
import { cachedJson } from "@/lib/reference/http";
import { getSubclasses } from "@/lib/characters/refRepo";

export async function GET(req: Request) {
  const classSlug = new URL(req.url).searchParams.get("class") ?? undefined;
  return cachedJson(await getSubclasses(classSlug));
}
