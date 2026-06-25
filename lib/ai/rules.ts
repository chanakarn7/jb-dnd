// File: lib/ai/rules.ts
// Pure, deterministic validation + parsing for the AI DM Assistant (Sprint 7).
// NO DB, NO I/O, NO LLM — fully unit-testable (ARCHITECTURE determinism rule).
// The LLM writes prose ONLY; all rules math (XP from CR, loot tiers) lives here.
// Source: docs/modules/ai-dm/SA_BLUEPRINT.md §3.

import { crToXp } from "@/lib/reference/srd";
import {
  ENTITY_TYPES,
  DRAFT_STATUSES,
  type AIDraftEntityType,
  type AIDraftStatus,
  type LootDraft,
  type LootItem,
} from "./types";

export type ValidationResult = { valid: true } | { valid: false; error: string };
const ok: ValidationResult = { valid: true };
const fail = (error: string): ValidationResult => ({ valid: false, error });

// App-enforced caps (SQLite TEXT is unbounded).
export const PROMPT_MAX = 2000;
export const IMPORT_MAX = 10000;
// Soft per-campaign caps checked on approve (edge 5.5 / 5.6).
export const NPC_LIMIT = 200;
export const QUEST_LIMIT = 200;

// ── primitives ───────────────────────────────────────────────────────────────

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

// ── validators ─────────────────────────────────────────────────────────────

/** Generate prompt: required, non-empty, ≤ PROMPT_MAX. */
export function validatePrompt(p: unknown): ValidationResult {
  if (!isNonEmptyString(p)) return fail("prompt_required");
  if ((p as string).length > PROMPT_MAX) return fail("prompt_too_long");
  return ok;
}

/** Import paste: required, non-empty, ≤ IMPORT_MAX. */
export function validateImportContent(c: unknown): ValidationResult {
  if (!isNonEmptyString(c)) return fail("content_required");
  if ((c as string).length > IMPORT_MAX) return fail("content_too_long");
  return ok;
}

export function validateEntityType(t: unknown): t is AIDraftEntityType {
  return typeof t === "string" && ENTITY_TYPES.includes(t as AIDraftEntityType);
}

export function isValidStatus(s: unknown): s is AIDraftStatus {
  return typeof s === "string" && DRAFT_STATUSES.includes(s as AIDraftStatus);
}

/** CR for loot: number in 0..30. */
export function validateCr(cr: unknown): ValidationResult {
  if (typeof cr !== "number" || Number.isNaN(cr) || cr < 0 || cr > 30) return fail("invalid_cr");
  return ok;
}

// ── JSON safety ────────────────────────────────────────────────────────────

/** Defensive parse: returns the parsed value, or null on any malformed input. Never throws. */
export function tryParseJson(raw: string | null | undefined): unknown | null {
  if (raw == null) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  // Tolerate models that wrap JSON in ```json fences or prose — extract the
  // outermost {...} or [...] block before parsing.
  const candidate = extractJsonBlock(trimmed);
  if (candidate == null) return null;
  try {
    return JSON.parse(candidate);
  } catch {
    return null;
  }
}

/** Find the first balanced {...} or [...] block in a string (handles ```json fences + chatty prose). */
export function extractJsonBlock(s: string): string | null {
  const start = s.search(/[{[]/);
  if (start === -1) return null;
  const open = s[start];
  const close = open === "{" ? "}" : "]";
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < s.length; i++) {
    const ch = s[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) return s.slice(start, i + 1);
    }
  }
  return null;
}

// ── Deterministic loot (rules math, NEVER the LLM) ───────────────────────────
// The LLM supplies item NAMES + flavor; rarity tier + item COUNT come from the
// CR bracket here. xp is crToXp(cr) — never asked of the model.

/** SRD-ish treasure tier by CR → {count, rarity}. Deterministic brackets. */
export function lootTierForCr(cr: number): { count: number; rarity: string } {
  if (cr < 1) return { count: 1, rarity: "common" };
  if (cr <= 4) return { count: 1, rarity: "common" };
  if (cr <= 10) return { count: 2, rarity: "uncommon" };
  if (cr <= 16) return { count: 2, rarity: "rare" };
  return { count: 3, rarity: "very rare" };
}

/**
 * Build a deterministic LootDraft from the LLM's raw item-name output + a CR.
 * - xp = crToXp(cr) (code, not model)
 * - rarity + max item count = lootTierForCr(cr) (code, not model)
 * - item names: pulled from the parsed LLM JSON if present, else from `fallbackNames`,
 *   truncated to the tier's deterministic count. Names are prose only.
 */
export function parseLootDraft(raw: string, cr: number, fallbackNames: string[] = []): LootDraft {
  const tier = lootTierForCr(cr);
  const parsed = tryParseJson(raw);

  let names: string[] = [];
  const flavors: Record<string, string> = {};
  if (parsed && typeof parsed === "object") {
    const arr =
      Array.isArray(parsed) ? parsed
      : Array.isArray((parsed as { items?: unknown }).items) ? (parsed as { items: unknown[] }).items
      : [];
    for (const it of arr) {
      if (typeof it === "string" && it.trim()) {
        names.push(it.trim());
      } else if (it && typeof it === "object") {
        const name = (it as { name?: unknown }).name;
        const flavor = (it as { flavor?: unknown }).flavor;
        if (typeof name === "string" && name.trim()) {
          names.push(name.trim());
          if (typeof flavor === "string" && flavor.trim()) flavors[name.trim()] = flavor.trim();
        }
      }
    }
  }
  if (names.length === 0) names = fallbackNames.filter((n) => n && n.trim());

  const items: LootItem[] = names.slice(0, tier.count).map((name) => ({
    name,
    rarity: tier.rarity,
    ...(flavors[name] ? { flavor: flavors[name] } : {}),
  }));

  return { cr, xp: crToXp(cr), items };
}
