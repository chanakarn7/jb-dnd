// File: app/api/reference/backgrounds/route.ts
import { cachedJson } from "@/lib/reference/http";
import { getBackgrounds } from "@/lib/characters/refRepo";

export async function GET() {
  return cachedJson(await getBackgrounds());
}
