// File: lib/ai/types.ts
// Shared TypeScript interfaces for the AI DM Assistant module (Sprint 7).
// Source of truth: docs/modules/ai-dm/SA_BLUEPRINT.md §3.
// Human-in-the-loop: every draft is staged; nothing is live until the DM approves.

export type AIDraftEntityType = "npc" | "loot" | "quest" | "session_recap";
export type AIDraftStatus = "pending" | "approved" | "rejected";
export type AIProvider = "ollama" | "import";

export const ENTITY_TYPES: AIDraftEntityType[] = ["npc", "loot", "quest", "session_recap"];
export const DRAFT_STATUSES: AIDraftStatus[] = ["pending", "approved", "rejected"];

// ── Structured (parsed) draft shapes per entity type ────────────────────────
// The LLM is asked for JSON in these shapes; a non-conforming response → parsedJson:null.

export interface NpcDraft {
  name: string;
  appearance?: string;
  personality?: string;
  secret?: string;
  role?: string;
}

export interface LootItem {
  name: string;
  rarity: string;
  flavor?: string;
}

export interface LootDraft {
  cr: number;
  xp: number; // deterministic — crToXp(cr), never LLM-computed
  items: LootItem[];
}

export interface QuestDraft {
  name: string;
  giverHint?: string;
  objectives: string[];
  rewardHint?: string;
}

export interface RecapDraft {
  recap: string;
}

// ── View returned to the client ─────────────────────────────────────────────

export interface AIDraftView {
  id: string;
  campaignId: string;
  entityType: AIDraftEntityType;
  prompt: string;
  rawText: string;
  parsedJson: unknown | null; // typed per entityType at runtime; null = unparseable
  provider: AIProvider;
  status: AIDraftStatus;
  approvedEntityId: string | null;
  approvedEntityType: string | null;
  createdAt: string; // ISO
}

// ── Service inputs ──────────────────────────────────────────────────────────

export interface GenerateInput {
  entityType: AIDraftEntityType;
  prompt: string;
  context?: {
    cr?: number;
    sessionId?: string;
  };
}

export interface ImportInput {
  entityType: AIDraftEntityType;
  content: string;
}

// ── Provider health ─────────────────────────────────────────────────────────

export interface ProviderStatus {
  ollama: boolean;
  import: boolean;
}

// ── Service result wrapper (mirrors StoryResult, plus 502/503 for the LLM) ──

export type AIErrorStatus = 401 | 403 | 404 | 422 | 502 | 503;

export type AIResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status: AIErrorStatus };
