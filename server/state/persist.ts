import { prisma } from "@/lib/db";

// Durable persistence + rehydrate-on-boot (SA_BLUEPRINT §4.2–4.3).
// STUB (scaffold): rehydrate signature + a working boot loader. /dev wires per-intent writes.

/**
 * On server start, load all active campaigns + their sessions from SQLite and
 * rebuild the in-memory working set, marking everyone disconnected until their
 * clients reconnect via token (session:resume).
 */
export async function rehydrateOnBoot(): Promise<number> {
  const active = await prisma.campaign.findMany({
    where: { status: "active" },
    include: { sessions: true },
  });
  // /dev: populate workingSet from `active`, isConnected=false for all participants.
  return active.length;
}
