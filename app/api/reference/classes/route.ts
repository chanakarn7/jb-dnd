// File: app/api/reference/classes/route.ts
import { cachedJson } from "@/lib/reference/http";
import { getClasses } from "@/lib/characters/refRepo";

export async function GET() {
  return cachedJson(await getClasses());
}
