// File: lib/ai/templates.ts
// Prompt template builders for the AI DM Assistant (Sprint 7).
// Versioned IN SOURCE — never stored in the DB. Each builder assembles a tight,
// structured prompt that asks the model for JSON ONLY in a defined schema.
// CRITICAL: never ask the model to compute dice, XP, AC, or spell slots — that
// is deterministic code (lib/ai/rules.ts). The model writes prose only.
// Source: docs/modules/ai-dm/SA_BLUEPRINT.md §3 + PRD §8.

import type { AIDraftEntityType } from "./types";

/** Shared system instruction: prose only, JSON only, no rules math. */
export const SYSTEM_BASE =
  "You are a Dungeons & Dragons 5e Dungeon Master's writing assistant. " +
  "You write evocative, concise prose for a fantasy tabletop campaign. " +
  "Return ONLY a single valid JSON object — no markdown fences, no commentary. " +
  "Do NOT compute any numbers (XP, dice, hit points, spell slots, gold) — those are handled separately. " +
  "Keep every field short (1–3 sentences).";

export function buildNpcPrompt(prompt: string, campaignName?: string): string {
  const ctx = campaignName ? `Campaign: "${campaignName}". ` : "";
  return (
    `${ctx}Create a non-player character from this brief: "${prompt}".\n` +
    `Return JSON with exactly these keys:\n` +
    `{ "name": string, "appearance": string, "personality": string, "secret": string, "role": string }\n` +
    `"secret" is a hidden hook only the DM knows. "role" is their function in the world (merchant, guard, cultist…).`
  );
}

export function buildLootPrompt(prompt: string, cr: number, itemPool: string[]): string {
  const pool = itemPool.length
    ? `Prefer item names from this pool when they fit: ${itemPool.slice(0, 40).join(", ")}.\n`
    : "";
  return (
    `Suggest magic item NAMES with one-line flavor for an encounter of challenge rating ${cr}.\n` +
    `Theme/context: "${prompt}".\n` +
    pool +
    `Return JSON: { "items": [ { "name": string, "flavor": string } ] }.\n` +
    `Provide up to 4 candidate names. Do NOT assign rarity, quantity, gold value, or XP — those are set by the system.`
  );
}

export function buildQuestPrompt(prompt: string, lastSessionRecap?: string): string {
  const ctx = lastSessionRecap ? `Recent events: "${lastSessionRecap}".\n` : "";
  return (
    `${ctx}Create a quest / plot hook from this brief: "${prompt}".\n` +
    `Return JSON with exactly these keys:\n` +
    `{ "name": string, "giverHint": string, "objectives": string[], "rewardHint": string }\n` +
    `"objectives" is 2–4 short steps. "rewardHint" describes the payoff in prose (no gold amounts).`
  );
}

export function buildRecapPrompt(
  sessionDate: string,
  encounterNames: string[],
  prompt: string,
): string {
  const enc = encounterNames.length ? `Notable encounters: ${encounterNames.join(", ")}.\n` : "";
  return (
    `Write a short "previously on…" recap / opening narration for a session played on ${sessionDate}.\n` +
    enc +
    `DM notes: "${prompt}".\n` +
    `Return JSON: { "recap": string }. The recap is 1–2 evocative paragraphs of prose.`
  );
}

/** Dispatch helper: build the right prompt for an entity type. */
export function buildPrompt(
  entityType: AIDraftEntityType,
  prompt: string,
  context?: {
    campaignName?: string;
    cr?: number;
    itemPool?: string[];
    lastSessionRecap?: string;
    sessionDate?: string;
    encounterNames?: string[];
  },
): string {
  switch (entityType) {
    case "npc":
      return buildNpcPrompt(prompt, context?.campaignName);
    case "loot":
      return buildLootPrompt(prompt, context?.cr ?? 0, context?.itemPool ?? []);
    case "quest":
      return buildQuestPrompt(prompt, context?.lastSessionRecap);
    case "session_recap":
      return buildRecapPrompt(
        context?.sessionDate ?? new Date().toISOString().slice(0, 10),
        context?.encounterNames ?? [],
        prompt,
      );
  }
}
