// app/api/campaigns/[id]/export/route.ts
// GET — DM only. Returns the full campaign snapshot as a JSON download.

import { resolveSession } from "@/lib/characters/auth";
import { exportCampaign } from "@/lib/export/exporter";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await resolveSession(req);
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (session.role !== "dm") return Response.json({ error: "forbidden" }, { status: 403 });

  const { id } = await params;
  if (session.campaignId !== id) return Response.json({ error: "forbidden" }, { status: 403 });

  try {
    const data = await exportCampaign(id);
    const filename = `campaign-${data.campaign.name.replace(/[^a-z0-9]/gi, "-").toLowerCase()}-${new Date().toISOString().slice(0, 10)}.json`;
    return new Response(JSON.stringify(data, null, 2), {
      headers: {
        "content-type": "application/json",
        "content-disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch {
    return Response.json({ error: "export_failed" }, { status: 500 });
  }
}
