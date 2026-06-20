// File: app/api/reference/races/route.ts
import { cachedJson } from "@/lib/reference/http";
import { getRaces } from "@/lib/characters/refRepo";

export async function GET() {
  return cachedJson(await getRaces());
}
