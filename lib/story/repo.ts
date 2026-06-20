// File: lib/story/repo.ts
// Prisma CRUD for the Story module. Every query is campaign-scoped (multi-tenancy
// enforced at the DB query level — `where: { ..., campaignId }`).
// Source: docs/modules/story/SA_BLUEPRINT.md §5.4

import { prisma } from "@/lib/db";
import type {
  Session as PSession,
  Quest as PQuest,
  Npc as PNpc,
  JournalEntry as PJournalEntry,
} from "@prisma/client";

// ── Sessions ────────────────────────────────────────────────────────────────

export interface CreateSessionInput {
  title?: string | null;
  date: string | Date;
  summary?: string | null;
  xpAwarded?: number;
  notableLoot?: string | null;
}

export type UpdateSessionInput = Partial<CreateSessionInput>;

export async function listSessions(campaignId: string): Promise<PSession[]> {
  return prisma.session.findMany({
    where: { campaignId },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  });
}

export async function getSessionById(
  campaignId: string,
  id: string,
): Promise<(PSession & { journalEntries: PJournalEntry[] }) | null> {
  return prisma.session.findFirst({
    where: { id, campaignId },
    include: { journalEntries: { orderBy: { createdAt: "desc" } } },
  });
}

export async function createSession(
  campaignId: string,
  data: CreateSessionInput,
): Promise<PSession> {
  return prisma.session.create({
    data: {
      campaignId,
      title: data.title ?? null,
      date: new Date(data.date),
      summary: data.summary ?? null,
      xpAwarded: data.xpAwarded ?? 0,
      notableLoot: data.notableLoot ?? null,
    },
  });
}

export async function updateSession(
  campaignId: string,
  id: string,
  data: UpdateSessionInput,
): Promise<PSession | null> {
  const { count } = await prisma.session.updateMany({
    where: { id, campaignId },
    data: {
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.date !== undefined ? { date: new Date(data.date) } : {}),
      ...(data.summary !== undefined ? { summary: data.summary } : {}),
      ...(data.xpAwarded !== undefined ? { xpAwarded: data.xpAwarded } : {}),
      ...(data.notableLoot !== undefined ? { notableLoot: data.notableLoot } : {}),
    },
  });
  if (count === 0) return null;
  return prisma.session.findFirst({ where: { id, campaignId } });
}

export async function deleteSession(campaignId: string, id: string): Promise<boolean> {
  const { count } = await prisma.session.deleteMany({ where: { id, campaignId } });
  return count > 0;
}

// ── Quests ──────────────────────────────────────────────────────────────────

export interface CreateQuestInput {
  name: string;
  description?: string | null;
  giverName?: string | null;
  status?: string;
  objectivesJson?: string;
  reward?: string | null;
}

export type UpdateQuestInput = Partial<CreateQuestInput>;

export async function listQuests(campaignId: string, status?: string): Promise<PQuest[]> {
  return prisma.quest.findMany({
    where: { campaignId, ...(status ? { status } : {}) },
    orderBy: { createdAt: "desc" },
  });
}

export async function getQuestById(campaignId: string, id: string): Promise<PQuest | null> {
  return prisma.quest.findFirst({ where: { id, campaignId } });
}

export async function createQuest(campaignId: string, data: CreateQuestInput): Promise<PQuest> {
  return prisma.quest.create({
    data: {
      campaignId,
      name: data.name,
      description: data.description ?? null,
      giverName: data.giverName ?? null,
      status: data.status ?? "active",
      objectivesJson: data.objectivesJson ?? "[]",
      reward: data.reward ?? null,
    },
  });
}

export async function updateQuest(
  campaignId: string,
  id: string,
  data: UpdateQuestInput,
): Promise<PQuest | null> {
  const { count } = await prisma.quest.updateMany({
    where: { id, campaignId },
    data: {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.description !== undefined ? { description: data.description } : {}),
      ...(data.giverName !== undefined ? { giverName: data.giverName } : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
      ...(data.objectivesJson !== undefined ? { objectivesJson: data.objectivesJson } : {}),
      ...(data.reward !== undefined ? { reward: data.reward } : {}),
    },
  });
  if (count === 0) return null;
  return prisma.quest.findFirst({ where: { id, campaignId } });
}

export async function deleteQuest(campaignId: string, id: string): Promise<boolean> {
  const { count } = await prisma.quest.deleteMany({ where: { id, campaignId } });
  return count > 0;
}

// ── NPCs ────────────────────────────────────────────────────────────────────

export interface CreateNpcInput {
  name: string;
  role?: string | null;
  faction?: string | null;
  notes?: string | null;
  isAlive?: boolean;
  characterId?: string | null;
}

export type UpdateNpcInput = Partial<CreateNpcInput>;

export async function listNpcs(
  campaignId: string,
  filters?: { isAlive?: boolean; faction?: string },
): Promise<PNpc[]> {
  return prisma.npc.findMany({
    where: {
      campaignId,
      ...(filters?.isAlive !== undefined ? { isAlive: filters.isAlive } : {}),
      ...(filters?.faction ? { faction: filters.faction } : {}),
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getNpcById(campaignId: string, id: string): Promise<PNpc | null> {
  return prisma.npc.findFirst({ where: { id, campaignId } });
}

export async function createNpc(campaignId: string, data: CreateNpcInput): Promise<PNpc> {
  return prisma.npc.create({
    data: {
      campaignId,
      name: data.name,
      role: data.role ?? null,
      faction: data.faction ?? null,
      notes: data.notes ?? null,
      isAlive: data.isAlive ?? true,
      characterId: data.characterId ?? null,
    },
  });
}

export async function updateNpc(
  campaignId: string,
  id: string,
  data: UpdateNpcInput,
): Promise<PNpc | null> {
  const { count } = await prisma.npc.updateMany({
    where: { id, campaignId },
    data: {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.role !== undefined ? { role: data.role } : {}),
      ...(data.faction !== undefined ? { faction: data.faction } : {}),
      ...(data.notes !== undefined ? { notes: data.notes } : {}),
      ...(data.isAlive !== undefined ? { isAlive: data.isAlive } : {}),
      ...(data.characterId !== undefined ? { characterId: data.characterId } : {}),
    },
  });
  if (count === 0) return null;
  return prisma.npc.findFirst({ where: { id, campaignId } });
}

export async function deleteNpc(campaignId: string, id: string): Promise<boolean> {
  const { count } = await prisma.npc.deleteMany({ where: { id, campaignId } });
  return count > 0;
}

// ── Journal ─────────────────────────────────────────────────────────────────

export interface CreateJournalInput {
  title?: string | null;
  content: string;
  sessionId?: string | null;
}

export type UpdateJournalInput = Partial<CreateJournalInput>;

export async function listJournal(
  campaignId: string,
  sessionId?: string,
): Promise<Array<PJournalEntry & { session: { title: string | null } | null }>> {
  return prisma.journalEntry.findMany({
    where: { campaignId, ...(sessionId ? { sessionId } : {}) },
    orderBy: { createdAt: "desc" },
    include: { session: { select: { title: true } } },
  });
}

export async function getJournalEntryById(
  campaignId: string,
  id: string,
): Promise<PJournalEntry | null> {
  return prisma.journalEntry.findFirst({ where: { id, campaignId } });
}

export async function createJournalEntry(
  campaignId: string,
  data: CreateJournalInput,
): Promise<PJournalEntry> {
  return prisma.journalEntry.create({
    data: {
      campaignId,
      title: data.title ?? null,
      content: data.content,
      sessionId: data.sessionId ?? null,
    },
  });
}

export async function updateJournalEntry(
  campaignId: string,
  id: string,
  data: UpdateJournalInput,
): Promise<PJournalEntry | null> {
  const { count } = await prisma.journalEntry.updateMany({
    where: { id, campaignId },
    data: {
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.content !== undefined ? { content: data.content } : {}),
      ...(data.sessionId !== undefined ? { sessionId: data.sessionId } : {}),
    },
  });
  if (count === 0) return null;
  return prisma.journalEntry.findFirst({ where: { id, campaignId } });
}

export async function deleteJournalEntry(campaignId: string, id: string): Promise<boolean> {
  const { count } = await prisma.journalEntry.deleteMany({ where: { id, campaignId } });
  return count > 0;
}

/** Confirms a session belongs to the campaign (for JournalEntry.sessionId cross-tenant guard, edge 5.20). */
export async function sessionExistsInCampaign(
  campaignId: string,
  sessionId: string,
): Promise<boolean> {
  const found = await prisma.session.findFirst({
    where: { id: sessionId, campaignId },
    select: { id: true },
  });
  return found != null;
}
