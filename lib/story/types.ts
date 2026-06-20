// File: lib/story/types.ts
// Shared TypeScript interfaces for the Story module (Sprint 5).
// Source of truth: docs/modules/story/SA_BLUEPRINT.md §5.2
// Story is REST-only (no Socket.io). All entities are campaign-scoped.

export type QuestStatus = "active" | "completed" | "failed" | "abandoned";

export const QUEST_STATUSES: QuestStatus[] = ["active", "completed", "failed", "abandoned"];

export interface ObjectiveItem {
  text: string;
  checked: boolean;
}

// ── Full detail views (GET [id]) ───────────────────────────────────────────

export interface SessionView {
  id: string;
  campaignId: string;
  title: string | null;
  date: string; // ISO string
  summary: string | null;
  xpAwarded: number;
  notableLoot: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SessionDetailView extends SessionView {
  journalEntries: Array<{ id: string; title: string | null; createdAt: string }>;
}

export interface QuestView {
  id: string;
  campaignId: string;
  name: string;
  description: string | null;
  giverName: string | null;
  status: QuestStatus;
  objectives: ObjectiveItem[];
  reward: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NpcView {
  id: string;
  campaignId: string;
  characterId: string | null;
  name: string;
  role: string | null;
  faction: string | null;
  notes: string | null;
  isAlive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface JournalEntryView {
  id: string;
  campaignId: string;
  sessionId: string | null;
  title: string | null;
  content: string;
  createdAt: string;
  updatedAt: string;
}

// ── Lean list-item views (GET list) ────────────────────────────────────────

export interface SessionListItem {
  id: string;
  title: string | null;
  date: string;
  xpAwarded: number;
  summaryExcerpt: string | null;
  createdAt: string;
}

export interface QuestListItem {
  id: string;
  name: string;
  giverName: string | null;
  status: QuestStatus;
  objectiveCount: number;
  completedCount: number;
  createdAt: string;
}

export interface NpcListItem {
  id: string;
  name: string;
  role: string | null;
  faction: string | null;
  isAlive: boolean;
  notesExcerpt: string | null;
}

export interface JournalListItem {
  id: string;
  title: string | null;
  sessionId: string | null;
  sessionTitle: string | null;
  createdAt: string;
}

// ── Service result wrapper ─────────────────────────────────────────────────

export type StoryErrorStatus = 401 | 403 | 404 | 422;

export type StoryResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status: StoryErrorStatus };
