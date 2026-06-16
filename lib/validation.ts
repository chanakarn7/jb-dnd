import { z } from "zod";

// Zod schemas for every Socket.io intent payload (server-side validation).
// The server validates shape here, then re-derives role/ownership/campaign-scope
// from the authenticated session — never trusting client-claimed identity.

export const createCampaignSchema = z.object({
  campaignName: z.string().trim().min(1).max(60),
  dmDisplayName: z.string().trim().min(1).max(24),
});

export const joinCampaignSchema = z.object({
  inviteCode: z.string().trim().min(1),
  displayName: z.string().trim().min(1).max(24),
});

export const renameCampaignSchema = z.object({
  name: z.string().trim().min(1).max(60),
});

export const removeParticipantSchema = z.object({
  sessionId: z.string().min(1),
});

export const resumeSchema = z.object({
  sessionToken: z.string().min(1),
});

export type CreateCampaignInput = z.infer<typeof createCampaignSchema>;
export type JoinCampaignInput = z.infer<typeof joinCampaignSchema>;
export type RenameCampaignInput = z.infer<typeof renameCampaignSchema>;
export type RemoveParticipantInput = z.infer<typeof removeParticipantSchema>;
export type ResumeInput = z.infer<typeof resumeSchema>;
