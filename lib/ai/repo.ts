// File: lib/ai/repo.ts
// Prisma CRUD for the AI DM Assistant (Sprint 7). Every query is campaign-scoped
// (multi-tenancy enforced at the DB layer — `where: { ..., campaignId }`).
// Reject = status flip to "rejected" (soft delete); rows are retained.
// Source: docs/modules/ai-dm/SA_BLUEPRINT.md §3.

import { prisma } from "@/lib/db";
import type { AIDraft as PAIDraft } from "@prisma/client";

export interface CreateDraftInput {
  entityType: string;
  prompt: string;
  rawText: string;
  parsedJson: string | null;
  provider: string;
}

export async function createDraft(
  campaignId: string,
  data: CreateDraftInput,
): Promise<PAIDraft> {
  return prisma.aIDraft.create({
    data: {
      campaignId,
      entityType: data.entityType,
      prompt: data.prompt,
      rawText: data.rawText,
      parsedJson: data.parsedJson,
      provider: data.provider,
      status: "pending",
    },
  });
}

export async function getDraft(campaignId: string, id: string): Promise<PAIDraft | null> {
  return prisma.aIDraft.findFirst({ where: { id, campaignId } });
}

/** List drafts for a campaign, newest first. Defaults to pending only. */
export async function listDrafts(
  campaignId: string,
  opts?: { includeRejected?: boolean; status?: string },
): Promise<PAIDraft[]> {
  const where: { campaignId: string; status?: string | { not: string } } = { campaignId };
  if (opts?.status) where.status = opts.status;
  else if (!opts?.includeRejected) where.status = "pending";
  return prisma.aIDraft.findMany({ where, orderBy: { createdAt: "desc" } });
}

export interface UpdateDraftInput {
  rawText?: string;
  parsedJson?: string | null;
  status?: string;
  approvedEntityId?: string | null;
  approvedEntityType?: string | null;
}

export async function updateDraft(
  campaignId: string,
  id: string,
  data: UpdateDraftInput,
): Promise<PAIDraft | null> {
  const { count } = await prisma.aIDraft.updateMany({
    where: { id, campaignId },
    data: {
      ...(data.rawText !== undefined ? { rawText: data.rawText } : {}),
      ...(data.parsedJson !== undefined ? { parsedJson: data.parsedJson } : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
      ...(data.approvedEntityId !== undefined ? { approvedEntityId: data.approvedEntityId } : {}),
      ...(data.approvedEntityType !== undefined
        ? { approvedEntityType: data.approvedEntityType }
        : {}),
    },
  });
  if (count === 0) return null;
  return prisma.aIDraft.findFirst({ where: { id, campaignId } });
}

/** Soft delete = mark rejected (edge 5.7). Retained in DB. */
export async function softDeleteDraft(campaignId: string, id: string): Promise<PAIDraft | null> {
  return updateDraft(campaignId, id, { status: "rejected" });
}

// ── Approval-limit counts (edge 5.5 / 5.6) ──────────────────────────────────

export async function countNpcs(campaignId: string): Promise<number> {
  return prisma.npc.count({ where: { campaignId } });
}

export async function countQuests(campaignId: string): Promise<number> {
  return prisma.quest.count({ where: { campaignId } });
}

// ── Context loaders (loot item pool, recap session) ─────────────────────────

/** Item-name pool for the loot prompt — magic items (non-mundane) by name. */
export async function itemPoolForLoot(limit = 60): Promise<string[]> {
  const rows = await prisma.item.findMany({
    where: { NOT: { rarity: "mundane" } },
    select: { name: true },
    orderBy: { name: "asc" },
    take: limit,
  });
  return rows.map((r) => r.name);
}

/** Confirms a session belongs to the campaign + returns light context for the recap prompt. */
export async function sessionContext(
  campaignId: string,
  sessionId: string,
): Promise<{ date: string; title: string | null } | null> {
  const s = await prisma.session.findFirst({
    where: { id: sessionId, campaignId },
    select: { date: true, title: true },
  });
  if (!s) return null;
  return { date: s.date.toISOString().slice(0, 10), title: s.title };
}

/** Writes an approved recap into a session's summary (campaign-scoped). Returns false if missing. */
export async function applyRecap(
  campaignId: string,
  sessionId: string,
  recap: string,
): Promise<boolean> {
  const { count } = await prisma.session.updateMany({
    where: { id: sessionId, campaignId },
    data: { summary: recap },
  });
  return count > 0;
}
