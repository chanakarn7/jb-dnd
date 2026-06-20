// File: lib/story/service.ts
// Orchestration layer for the Story module: re-derives session authz → validates
// (pure rules) → calls repo. NEVER trusts client-supplied role/campaignId — the
// campaignId always comes from the resolved session (ARCHITECTURE.md).
// DM = full CRUD; player = read-only (403 on any write).
// Source: docs/modules/story/SA_BLUEPRINT.md §4, §5.5

import type { Session } from "@/lib/characters/service";
import type {
  Session as PSession,
  Quest as PQuest,
  Npc as PNpc,
  JournalEntry as PJournalEntry,
} from "@prisma/client";
import * as repo from "./repo";
import {
  validateSession,
  validateQuest,
  validateNpc,
  validateJournalEntry,
  validateObjectives,
  parseObjectives,
  serializeObjectives,
  summaryExcerpt,
  statusSortWeight,
} from "./rules";
import type {
  StoryResult,
  SessionListItem,
  SessionDetailView,
  QuestListItem,
  QuestView,
  QuestStatus,
  NpcListItem,
  NpcView,
  JournalListItem,
  JournalEntryView,
  ObjectiveItem,
} from "./types";

// ── authz helper (Story: DM writes, everyone reads) ─────────────────────────
export function canWrite(session: Session): boolean {
  return session.role === "dm";
}

const unauthorized = <T>(): StoryResult<T> => ({ ok: false, error: "unauthorized", status: 401 });
const forbidden = <T>(): StoryResult<T> => ({ ok: false, error: "forbidden", status: 403 });
const notFound = <T>(): StoryResult<T> => ({ ok: false, error: "not_found", status: 404 });
const invalid = <T>(error: string): StoryResult<T> => ({ ok: false, error, status: 422 });

const iso = (d: Date): string => d.toISOString();

// ── view mappers ────────────────────────────────────────────────────────────

function toSessionListItem(s: PSession): SessionListItem {
  return {
    id: s.id,
    title: s.title,
    date: iso(s.date),
    xpAwarded: s.xpAwarded,
    summaryExcerpt: summaryExcerpt(s.summary),
    createdAt: iso(s.createdAt),
  };
}

function toSessionDetail(
  s: PSession & { journalEntries: PJournalEntry[] },
): SessionDetailView {
  return {
    id: s.id,
    campaignId: s.campaignId,
    title: s.title,
    date: iso(s.date),
    summary: s.summary,
    xpAwarded: s.xpAwarded,
    notableLoot: s.notableLoot,
    createdAt: iso(s.createdAt),
    updatedAt: iso(s.updatedAt),
    journalEntries: s.journalEntries.map((j) => ({
      id: j.id,
      title: j.title,
      createdAt: iso(j.createdAt),
    })),
  };
}

function toQuestView(q: PQuest): QuestView {
  return {
    id: q.id,
    campaignId: q.campaignId,
    name: q.name,
    description: q.description,
    giverName: q.giverName,
    status: q.status as QuestStatus,
    objectives: parseObjectives(q.objectivesJson),
    reward: q.reward,
    createdAt: iso(q.createdAt),
    updatedAt: iso(q.updatedAt),
  };
}

function toQuestListItem(q: PQuest): QuestListItem {
  const objectives = parseObjectives(q.objectivesJson);
  return {
    id: q.id,
    name: q.name,
    giverName: q.giverName,
    status: q.status as QuestStatus,
    objectiveCount: objectives.length,
    completedCount: objectives.filter((o) => o.checked).length,
    createdAt: iso(q.createdAt),
  };
}

function toNpcView(n: PNpc): NpcView {
  return {
    id: n.id,
    campaignId: n.campaignId,
    characterId: n.characterId,
    name: n.name,
    role: n.role,
    faction: n.faction,
    notes: n.notes,
    isAlive: n.isAlive,
    createdAt: iso(n.createdAt),
    updatedAt: iso(n.updatedAt),
  };
}

function toNpcListItem(n: PNpc): NpcListItem {
  return {
    id: n.id,
    name: n.name,
    role: n.role,
    faction: n.faction,
    isAlive: n.isAlive,
    notesExcerpt: summaryExcerpt(n.notes, 100),
  };
}

function toJournalView(j: PJournalEntry): JournalEntryView {
  return {
    id: j.id,
    campaignId: j.campaignId,
    sessionId: j.sessionId,
    title: j.title,
    content: j.content,
    createdAt: iso(j.createdAt),
    updatedAt: iso(j.updatedAt),
  };
}

function toJournalListItem(
  j: PJournalEntry & { session: { title: string | null } | null },
): JournalListItem {
  return {
    id: j.id,
    title: j.title,
    sessionId: j.sessionId,
    sessionTitle: j.session?.title ?? null,
    createdAt: iso(j.createdAt),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// SESSIONS
// ─────────────────────────────────────────────────────────────────────────────

export async function listSessionsAction(
  session: Session | null,
): Promise<StoryResult<SessionListItem[]>> {
  if (!session) return unauthorized();
  const rows = await repo.listSessions(session.campaignId);
  return { ok: true, data: rows.map(toSessionListItem) };
}

export async function getSessionAction(
  session: Session | null,
  id: string,
): Promise<StoryResult<SessionDetailView>> {
  if (!session) return unauthorized();
  const row = await repo.getSessionById(session.campaignId, id);
  if (!row) return notFound();
  return { ok: true, data: toSessionDetail(row) };
}

export async function createSessionAction(
  session: Session | null,
  body: unknown,
): Promise<StoryResult<SessionDetailView>> {
  if (!session) return unauthorized();
  if (!canWrite(session)) return forbidden();
  const b = (body ?? {}) as Record<string, unknown>;

  const v = validateSession({
    date: b.date,
    xpAwarded: b.xpAwarded,
    title: b.title,
    isCreate: true,
  });
  if (!v.valid) return invalid(v.error);

  const row = await repo.createSession(session.campaignId, {
    title: (b.title as string | null) ?? null,
    date: b.date as string,
    summary: (b.summary as string | null) ?? null,
    xpAwarded: (b.xpAwarded as number | undefined) ?? 0,
    notableLoot: (b.notableLoot as string | null) ?? null,
  });
  return { ok: true, data: toSessionDetail({ ...row, journalEntries: [] }) };
}

export async function updateSessionAction(
  session: Session | null,
  id: string,
  body: unknown,
): Promise<StoryResult<SessionDetailView>> {
  if (!session) return unauthorized();
  if (!canWrite(session)) return forbidden();
  const b = (body ?? {}) as Record<string, unknown>;

  const v = validateSession({ date: b.date, xpAwarded: b.xpAwarded, title: b.title });
  if (!v.valid) return invalid(v.error);

  const updated = await repo.updateSession(session.campaignId, id, {
    ...(b.title !== undefined ? { title: b.title as string | null } : {}),
    ...(b.date !== undefined ? { date: b.date as string } : {}),
    ...(b.summary !== undefined ? { summary: b.summary as string | null } : {}),
    ...(b.xpAwarded !== undefined ? { xpAwarded: b.xpAwarded as number } : {}),
    ...(b.notableLoot !== undefined ? { notableLoot: b.notableLoot as string | null } : {}),
  });
  if (!updated) return notFound();
  const full = await repo.getSessionById(session.campaignId, id);
  return { ok: true, data: toSessionDetail(full!) };
}

export async function deleteSessionAction(
  session: Session | null,
  id: string,
): Promise<StoryResult<{ id: string }>> {
  if (!session) return unauthorized();
  if (!canWrite(session)) return forbidden();
  // Linked journal entries become unlinked via DB SET NULL (edge 5.7) — no cascade delete.
  const ok = await repo.deleteSession(session.campaignId, id);
  if (!ok) return notFound();
  return { ok: true, data: { id } };
}

// ─────────────────────────────────────────────────────────────────────────────
// QUESTS
// ─────────────────────────────────────────────────────────────────────────────

export async function listQuestsAction(
  session: Session | null,
  status?: string,
): Promise<StoryResult<QuestListItem[]>> {
  if (!session) return unauthorized();
  const rows = await repo.listQuests(session.campaignId, status);
  const items = rows
    .map(toQuestListItem)
    .sort(
      (a, b) =>
        statusSortWeight(a.status) - statusSortWeight(b.status) ||
        b.createdAt.localeCompare(a.createdAt),
    );
  return { ok: true, data: items };
}

export async function getQuestAction(
  session: Session | null,
  id: string,
): Promise<StoryResult<QuestView>> {
  if (!session) return unauthorized();
  const row = await repo.getQuestById(session.campaignId, id);
  if (!row) return notFound();
  return { ok: true, data: toQuestView(row) };
}

export async function createQuestAction(
  session: Session | null,
  body: unknown,
): Promise<StoryResult<QuestView>> {
  if (!session) return unauthorized();
  if (!canWrite(session)) return forbidden();
  const b = (body ?? {}) as Record<string, unknown>;

  const v = validateQuest({
    name: b.name,
    status: b.status,
    objectives: b.objectives,
    giverName: b.giverName,
    isCreate: true,
  });
  if (!v.valid) return invalid(v.error);

  const row = await repo.createQuest(session.campaignId, {
    name: b.name as string,
    description: (b.description as string | null) ?? null,
    giverName: (b.giverName as string | null) ?? null,
    status: (b.status as string | undefined) ?? "active",
    objectivesJson: serializeObjectives(b.objectives as ObjectiveItem[] | undefined),
    reward: (b.reward as string | null) ?? null,
  });
  return { ok: true, data: toQuestView(row) };
}

export async function updateQuestAction(
  session: Session | null,
  id: string,
  body: unknown,
): Promise<StoryResult<QuestView>> {
  if (!session) return unauthorized();
  if (!canWrite(session)) return forbidden();
  const b = (body ?? {}) as Record<string, unknown>;

  const v = validateQuest({
    name: b.name,
    status: b.status,
    objectives: b.objectives,
    giverName: b.giverName,
  });
  if (!v.valid) return invalid(v.error);

  // Objectives use replace-all semantics: client sends the full updated array.
  let objectivesJson: string | undefined;
  if (b.objectives !== undefined) {
    const ov = validateObjectives(b.objectives);
    if (!ov.valid) return invalid(ov.error);
    objectivesJson = serializeObjectives(b.objectives as ObjectiveItem[]);
  }

  const updated = await repo.updateQuest(session.campaignId, id, {
    ...(b.name !== undefined ? { name: b.name as string } : {}),
    ...(b.description !== undefined ? { description: b.description as string | null } : {}),
    ...(b.giverName !== undefined ? { giverName: b.giverName as string | null } : {}),
    ...(b.status !== undefined ? { status: b.status as string } : {}),
    ...(objectivesJson !== undefined ? { objectivesJson } : {}),
    ...(b.reward !== undefined ? { reward: b.reward as string | null } : {}),
  });
  if (!updated) return notFound();
  return { ok: true, data: toQuestView(updated) };
}

export async function deleteQuestAction(
  session: Session | null,
  id: string,
): Promise<StoryResult<{ id: string }>> {
  if (!session) return unauthorized();
  if (!canWrite(session)) return forbidden();
  const ok = await repo.deleteQuest(session.campaignId, id);
  if (!ok) return notFound();
  return { ok: true, data: { id } };
}

// ─────────────────────────────────────────────────────────────────────────────
// NPCS
// ─────────────────────────────────────────────────────────────────────────────

export async function listNpcsAction(
  session: Session | null,
  filters?: { isAlive?: boolean; faction?: string },
): Promise<StoryResult<NpcListItem[]>> {
  if (!session) return unauthorized();
  const rows = await repo.listNpcs(session.campaignId, filters);
  return { ok: true, data: rows.map(toNpcListItem) };
}

export async function getNpcAction(
  session: Session | null,
  id: string,
): Promise<StoryResult<NpcView>> {
  if (!session) return unauthorized();
  const row = await repo.getNpcById(session.campaignId, id);
  if (!row) return notFound();
  return { ok: true, data: toNpcView(row) };
}

export async function createNpcAction(
  session: Session | null,
  body: unknown,
): Promise<StoryResult<NpcView>> {
  if (!session) return unauthorized();
  if (!canWrite(session)) return forbidden();
  const b = (body ?? {}) as Record<string, unknown>;

  const v = validateNpc({
    name: b.name,
    role: b.role,
    faction: b.faction,
    isAlive: b.isAlive,
    isCreate: true,
  });
  if (!v.valid) return invalid(v.error);

  const row = await repo.createNpc(session.campaignId, {
    name: b.name as string,
    role: (b.role as string | null) ?? null,
    faction: (b.faction as string | null) ?? null,
    notes: (b.notes as string | null) ?? null,
    isAlive: (b.isAlive as boolean | undefined) ?? true,
    characterId: (b.characterId as string | null) ?? null,
  });
  return { ok: true, data: toNpcView(row) };
}

export async function updateNpcAction(
  session: Session | null,
  id: string,
  body: unknown,
): Promise<StoryResult<NpcView>> {
  if (!session) return unauthorized();
  if (!canWrite(session)) return forbidden();
  const b = (body ?? {}) as Record<string, unknown>;

  const v = validateNpc({ name: b.name, role: b.role, faction: b.faction, isAlive: b.isAlive });
  if (!v.valid) return invalid(v.error);

  const updated = await repo.updateNpc(session.campaignId, id, {
    ...(b.name !== undefined ? { name: b.name as string } : {}),
    ...(b.role !== undefined ? { role: b.role as string | null } : {}),
    ...(b.faction !== undefined ? { faction: b.faction as string | null } : {}),
    ...(b.notes !== undefined ? { notes: b.notes as string | null } : {}),
    ...(b.isAlive !== undefined ? { isAlive: b.isAlive as boolean } : {}),
    ...(b.characterId !== undefined ? { characterId: b.characterId as string | null } : {}),
  });
  if (!updated) return notFound();
  return { ok: true, data: toNpcView(updated) };
}

export async function deleteNpcAction(
  session: Session | null,
  id: string,
): Promise<StoryResult<{ id: string }>> {
  if (!session) return unauthorized();
  if (!canWrite(session)) return forbidden();
  const ok = await repo.deleteNpc(session.campaignId, id);
  if (!ok) return notFound();
  return { ok: true, data: { id } };
}

// ─────────────────────────────────────────────────────────────────────────────
// JOURNAL
// ─────────────────────────────────────────────────────────────────────────────

export async function listJournalAction(
  session: Session | null,
  sessionId?: string,
): Promise<StoryResult<JournalListItem[]>> {
  if (!session) return unauthorized();
  const rows = await repo.listJournal(session.campaignId, sessionId);
  return { ok: true, data: rows.map(toJournalListItem) };
}

export async function getJournalAction(
  session: Session | null,
  id: string,
): Promise<StoryResult<JournalEntryView>> {
  if (!session) return unauthorized();
  const row = await repo.getJournalEntryById(session.campaignId, id);
  if (!row) return notFound();
  return { ok: true, data: toJournalView(row) };
}

export async function createJournalAction(
  session: Session | null,
  body: unknown,
): Promise<StoryResult<JournalEntryView>> {
  if (!session) return unauthorized();
  if (!canWrite(session)) return forbidden();
  const b = (body ?? {}) as Record<string, unknown>;

  const v = validateJournalEntry({ content: b.content, title: b.title, isCreate: true });
  if (!v.valid) return invalid(v.error);

  // Cross-tenant guard (edge 5.20): a sessionId from another campaign → 422.
  if (b.sessionId != null) {
    const belongs = await repo.sessionExistsInCampaign(session.campaignId, b.sessionId as string);
    if (!belongs) return invalid("invalid_session");
  }

  const row = await repo.createJournalEntry(session.campaignId, {
    title: (b.title as string | null) ?? null,
    content: b.content as string,
    sessionId: (b.sessionId as string | null) ?? null,
  });
  return { ok: true, data: toJournalView(row) };
}

export async function updateJournalAction(
  session: Session | null,
  id: string,
  body: unknown,
): Promise<StoryResult<JournalEntryView>> {
  if (!session) return unauthorized();
  if (!canWrite(session)) return forbidden();
  const b = (body ?? {}) as Record<string, unknown>;

  const v = validateJournalEntry({ content: b.content, title: b.title });
  if (!v.valid) return invalid(v.error);

  if (b.sessionId != null) {
    const belongs = await repo.sessionExistsInCampaign(session.campaignId, b.sessionId as string);
    if (!belongs) return invalid("invalid_session");
  }

  const updated = await repo.updateJournalEntry(session.campaignId, id, {
    ...(b.title !== undefined ? { title: b.title as string | null } : {}),
    ...(b.content !== undefined ? { content: b.content as string } : {}),
    ...(b.sessionId !== undefined ? { sessionId: b.sessionId as string | null } : {}),
  });
  if (!updated) return notFound();
  return { ok: true, data: toJournalView(updated) };
}

export async function deleteJournalAction(
  session: Session | null,
  id: string,
): Promise<StoryResult<{ id: string }>> {
  if (!session) return unauthorized();
  if (!canWrite(session)) return forbidden();
  const ok = await repo.deleteJournalEntry(session.campaignId, id);
  if (!ok) return notFound();
  return { ok: true, data: { id } };
}
