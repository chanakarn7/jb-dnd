// app/api/campaigns/import/route.ts
// POST — no auth (creates a brand-new campaign). Body: { data: CampaignExport }.
// Returns: { campaignId, inviteCode, dmToken, dmSessionId } so the client can
// save the DM token to localStorage and redirect without a second join step.

import { importCampaign, validateExport } from "@/lib/export/importer";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const raw = (body as Record<string, unknown>)?.["data"];
  if (!validateExport(raw)) {
    return Response.json({ error: "invalid_export", message: "ไฟล์ไม่ใช่ campaign export ที่ถูกต้อง" }, { status: 422 });
  }

  try {
    const result = await importCampaign(raw);
    return Response.json(result, { status: 201 });
  } catch {
    return Response.json({ error: "import_failed", message: "ไม่สามารถนำเข้าข้อมูลได้ อาจมี slug ที่ไม่พบในระบบ" }, { status: 500 });
  }
}
