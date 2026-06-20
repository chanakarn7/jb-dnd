// File: lib/story/rules.ts
// Pure, deterministic validation + parsing for the Story module (Sprint 5).
// NO DB, NO I/O, NO LLM — fully unit-testable (ARCHITECTURE determinism rule).
// Source: docs/modules/story/SA_BLUEPRINT.md §5.3

import type { ObjectiveItem, QuestStatus } from "./types";
import { QUEST_STATUSES } from "./types";

export type ValidationResult = { valid: true } | { valid: false; error: string };

const ok: ValidationResult = { valid: true };
const fail = (error: string): ValidationResult => ({ valid: false, error });

// Field length caps (app-enforced; SQLite TEXT is unbounded).
export const LIMITS = {
  sessionTitle: 120,
  questName: 120,
  giverName: 100,
  npcName: 100,
  npcRole: 80,
  npcFaction: 80,
  journalTitle: 200,
} as const;

// ── primitives ─────────────────────────────────────────────────────────────

function isString(v: unknown): v is string {
  return typeof v === "string";
}

/** A non-empty string after trimming. */
function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

/** Optional string within a length cap; null/undefined pass. */
function withinCap(v: unknown, cap: number): boolean {
  if (v == null) return true;
  if (!isString(v)) return false;
  return v.length <= cap;
}

// ── XP ───────────────────────────────────────────────────────────────────────

/** Integer ≥ 0. Rejects floats, negatives, NaN, non-numbers. Undefined → defaults handled by caller. */
export function validateXp(n: unknown): ValidationResult {
  if (n == null) return ok; // optional → repo applies default 0
  if (typeof n !== "number" || !Number.isInteger(n) || n < 0) return fail("invalid_xp");
  return ok;
}

// ── Objectives ────────────────────────────────────────────────────────────────

/** Defensive parse: malformed JSON or wrong shape → []. Never throws. */
export function parseObjectives(json: string | null | undefined): ObjectiveItem[] {
  if (!json) return [];
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return [];
  }
  if (!Array.isArray(raw)) return [];
  const out: ObjectiveItem[] = [];
  for (const item of raw) {
    if (
      item &&
      typeof item === "object" &&
      typeof (item as { text?: unknown }).text === "string" &&
      typeof (item as { checked?: unknown }).checked === "boolean"
    ) {
      out.push({ text: (item as ObjectiveItem).text, checked: (item as ObjectiveItem).checked });
    }
  }
  return out;
}

/** Validates a client-supplied objectives array. Empty array is allowed (objectives optional). */
export function validateObjectives(items: unknown): ValidationResult {
  if (items == null) return ok; // optional
  if (!Array.isArray(items)) return fail("invalid_objectives");
  for (const item of items) {
    if (!item || typeof item !== "object") return fail("invalid_objectives");
    const text = (item as { text?: unknown }).text;
    const checked = (item as { checked?: unknown }).checked;
    if (!isNonEmptyString(text)) return fail("invalid_objectives");
    if (typeof checked !== "boolean") return fail("invalid_objectives");
  }
  return ok;
}

/** Serialize a validated objectives array to the JSON-string column. */
export function serializeObjectives(items: ObjectiveItem[] | undefined): string {
  if (!items || items.length === 0) return "[]";
  return JSON.stringify(items.map((o) => ({ text: o.text, checked: o.checked })));
}

// ── Quest status ──────────────────────────────────────────────────────────────

export function validateQuestStatus(s: unknown): ValidationResult {
  if (s == null) return ok; // optional → repo applies default "active"
  if (!isString(s) || !QUEST_STATUSES.includes(s as QuestStatus)) return fail("invalid_status");
  return ok;
}

export function isQuestStatus(s: unknown): s is QuestStatus {
  return isString(s) && QUEST_STATUSES.includes(s as QuestStatus);
}

// ── Entity validators (create + patch share these; patch passes only present fields) ──

export function validateSession(fields: {
  date?: unknown;
  xpAwarded?: unknown;
  title?: unknown;
  isCreate?: boolean;
}): ValidationResult {
  // date required on create; if present on patch must be a valid date
  if (fields.isCreate) {
    if (fields.date == null) return fail("invalid_date");
  }
  if (fields.date != null) {
    const d = new Date(fields.date as string | number | Date);
    if (Number.isNaN(d.getTime())) return fail("invalid_date");
  }
  if (!withinCap(fields.title, LIMITS.sessionTitle)) return fail("invalid_title");
  const xp = validateXp(fields.xpAwarded);
  if (!xp.valid) return xp;
  return ok;
}

export function validateQuest(fields: {
  name?: unknown;
  status?: unknown;
  objectives?: unknown;
  giverName?: unknown;
  isCreate?: boolean;
}): ValidationResult {
  if (fields.isCreate || fields.name !== undefined) {
    if (!isNonEmptyString(fields.name)) return fail("invalid_name");
    if (!withinCap(fields.name, LIMITS.questName)) return fail("invalid_name");
  }
  if (!withinCap(fields.giverName, LIMITS.giverName)) return fail("invalid_giver");
  const st = validateQuestStatus(fields.status);
  if (!st.valid) return st;
  const obj = validateObjectives(fields.objectives);
  if (!obj.valid) return obj;
  return ok;
}

export function validateNpc(fields: {
  name?: unknown;
  role?: unknown;
  faction?: unknown;
  isAlive?: unknown;
  isCreate?: boolean;
}): ValidationResult {
  if (fields.isCreate || fields.name !== undefined) {
    if (!isNonEmptyString(fields.name)) return fail("invalid_name");
    if (!withinCap(fields.name, LIMITS.npcName)) return fail("invalid_name");
  }
  if (!withinCap(fields.role, LIMITS.npcRole)) return fail("invalid_role");
  if (!withinCap(fields.faction, LIMITS.npcFaction)) return fail("invalid_faction");
  if (fields.isAlive != null && typeof fields.isAlive !== "boolean") return fail("invalid_alive");
  return ok;
}

export function validateJournalEntry(fields: {
  content?: unknown;
  title?: unknown;
  isCreate?: boolean;
}): ValidationResult {
  if (fields.isCreate || fields.content !== undefined) {
    if (!isNonEmptyString(fields.content)) return fail("invalid_content");
  }
  if (!withinCap(fields.title, LIMITS.journalTitle)) return fail("invalid_title");
  return ok;
}

// ── Excerpts (lean list shapes) ───────────────────────────────────────────────

export function summaryExcerpt(text: string | null, len = 120): string | null {
  if (text == null) return null;
  const trimmed = text.trim();
  if (trimmed.length === 0) return null;
  return trimmed.length <= len ? trimmed : trimmed.slice(0, len);
}

// ── Quest list sort weight (active first, then completed/failed/abandoned) ─────

export function statusSortWeight(status: QuestStatus): number {
  switch (status) {
    case "active":
      return 0;
    case "completed":
      return 1;
    case "failed":
      return 2;
    case "abandoned":
      return 3;
    default:
      return 4;
  }
}
