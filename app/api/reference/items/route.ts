import { getItems } from "@/lib/reference/repo";
import { cachedJson } from "@/lib/reference/http";

export async function GET() {
  return cachedJson(await getItems());
}
