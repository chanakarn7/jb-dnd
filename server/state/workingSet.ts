import type { CampaignState } from "@/lib/events";

// In-memory authoritative working set, keyed by campaignId (SA_BLUEPRINT §4.1).
// This is the LIVE truth during play; SQLite (see persist.ts) is the DURABLE truth.
// Writes go: memory -> DB (same tick) -> broadcast.
//
// STUB (scaffold): structure only. /dev implements mutation + presence derivation.

interface CampaignRuntime {
  state: CampaignState;
  secrets: {
    dmSessionToken: string;
    bySession: Map<string, string>; // sessionId -> sessionToken
  };
  sockets: Map<string, Set<string>>; // sessionId -> set of live socketIds (multi-tab presence)
}

const workingSet = new Map<string, CampaignRuntime>();

export function getCampaign(campaignId: string): CampaignRuntime | undefined {
  return workingSet.get(campaignId);
}

export function setCampaign(campaignId: string, runtime: CampaignRuntime): void {
  workingSet.set(campaignId, runtime);
}

export function allCampaignIds(): string[] {
  return [...workingSet.keys()];
}

export type { CampaignRuntime };
