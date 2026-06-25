// File: lib/ai/service.ts
// Orchestration layer for the AI DM Assistant (Sprint 7).
// Re-derives session authz (DM-ONLY — players 403) → validates (pure rules) →
// resolves the active LLM provider → generates → stages a draft → on approve,
// creates a real Story entity. NEVER trusts client role/campaignId — campaignId
// always comes from the resolved session (ARCHITECTURE).
// Human-in-the-loop: nothing auto-applies; the DM approves every draft.
// Source: docs/modules/ai-dm/SA_BLUEPRINT.md §3 + PRD §5.

import type { Session } from "@/lib/characters/service";
import type { AIDraft as PAIDraft } from "@prisma/client";
import { getLLMProvider } from "@/lib/llm/registry";
import { createNpc as storyCreateNpc, createQuest as storyCreateQuest } from "@/lib/story/repo";
import { serializeObjectives } from "@/lib/story/rules";
import { ProviderError } from "./ollama";
import { ImportProvider } from "./import";
import * as repo from "./repo";
import {
  validatePrompt,
  validateImportContent,
  validateEntityType,
  validateCr,
  tryParseJson,
  parseLootDraft,
  NPC_LIMIT,
  QUEST_LIMIT,
} from "./rules";
import { buildPrompt, SYSTEM_BASE } from "./templates";
import type {
  AIDraftView,
  AIDraftEntityType,
  AIProvider,
  AIResult,
  GenerateInput,
  ImportInput,
  ProviderStatus,
  NpcDraft,
  QuestDraft,
} from "./types";

// ── result helpers ───────────────────────────────────────────────────────────
const unauthorized = <T>(): AIResult<T> => ({ ok: false, error: "unauthorized", status: 401 });
const forbidden = <T>(): AIResult<T> => ({ ok: false, error: "forbidden", status: 403 });
const notFound = <T>(): AIResult<T> => ({ ok: false, error: "not_found", status: 404 });
const invalid = <T>(error: string): AIResult<T> => ({ ok: false, error, status: 422 });
const providerErr = <T>(message: string): AIResult<T> => ({
  ok: false,
  error: `provider_error: ${message}`,
  status: 502,
});
const unavailable = <T>(): AIResult<T> => ({ ok: false, error: "provider_unavailable", status: 503 });

function isDM(session: Session): boolean {
  return session.role === "dm";
}

// ── view mapper ──────────────────────────────────────────────────────────────
export function toDraftView(d: PAIDraft): AIDraftView {
  return {
    id: d.id,
    campaignId: d.campaignId,
    entityType: d.entityType as AIDraftEntityType,
    prompt: d.prompt,
    rawText: d.rawText,
    parsedJson: d.parsedJson ? safeParse(d.parsedJson) : null,
    provider: d.provider as AIProvider,
    status: d.status as AIDraftView["status"],
    approvedEntityId: d.approvedEntityId,
    approvedEntityType: d.approvedEntityType,
    createdAt: d.createdAt.toISOString(),
  };
}

function safeParse(json: string): unknown {
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GENERATE (Ollama / active provider)
// ─────────────────────────────────────────────────────────────────────────────

export async function generateDraft(
  session: Session | null,
  input: GenerateInput,
): Promise<AIResult<AIDraftView>> {
  if (!session) return unauthorized();
  if (!isDM(session)) return forbidden();

  if (!validateEntityType(input.entityType)) return invalid("invalid_entity_type");
  const vp = validatePrompt(input.prompt);
  if (!vp.valid) return invalid(vp.error);

  // Per-entity context validation + assembly.
  const context: Parameters<typeof buildPrompt>[2] = {};
  let recapSessionId: string | null = null;

  if (input.entityType === "loot") {
    const vc = validateCr(input.context?.cr);
    if (!vc.valid) return invalid(vc.error);
    context.cr = input.context!.cr;
    context.itemPool = await repo.itemPoolForLoot();
  }

  if (input.entityType === "session_recap") {
    const sid = input.context?.sessionId;
    if (!sid) return invalid("no_active_session");
    const sctx = await repo.sessionContext(session.campaignId, sid);
    if (!sctx) return invalid("no_active_session");
    recapSessionId = sid;
    context.sessionDate = sctx.date;
    context.encounterNames = sctx.title ? [sctx.title] : [];
  }

  // Resolve the active provider (Ollama). Graceful 503 when none / unavailable (edge 5.1).
  const provider = getLLMProvider();
  if (!provider) return unavailable();
  if (!(await provider.isAvailable())) return unavailable();

  // Call the model (edge 5.2: any failure → 502, draft NOT saved).
  let raw: string;
  try {
    raw = await provider.generate(buildPrompt(input.entityType, input.prompt, context), {
      system: SYSTEM_BASE,
      json: true,
      maxTokens: 1500,
    });
  } catch (err) {
    if (err instanceof ProviderError) return providerErr(err.message);
    return providerErr(err instanceof Error ? err.message : "unknown");
  }

  const parsedJson = buildParsedJson(input.entityType, raw, {
    cr: context.cr,
    itemPool: context.itemPool,
    recapSessionId,
  });

  const row = await repo.createDraft(session.campaignId, {
    entityType: input.entityType,
    prompt: input.prompt,
    rawText: raw,
    parsedJson,
    provider: "ollama",
  });
  return { ok: true, data: toDraftView(row) };
}

// ─────────────────────────────────────────────────────────────────────────────
// IMPORT (paste from Claude / ChatGPT — always available, offline)
// ─────────────────────────────────────────────────────────────────────────────

export async function importDraft(
  session: Session | null,
  input: ImportInput,
): Promise<AIResult<AIDraftView>> {
  if (!session) return unauthorized();
  if (!isDM(session)) return forbidden();

  if (!validateEntityType(input.entityType)) return invalid("invalid_entity_type");
  const vc = validateImportContent(input.content);
  if (!vc.valid) return invalid(vc.error);

  const provider = new ImportProvider();
  const raw = await provider.generate(input.content); // no network call

  // Import has no CR/session context — parse generically; loot stays display-only.
  const parsed = tryParseJson(raw);
  const parsedJson = parsed != null ? JSON.stringify(parsed) : null;

  const row = await repo.createDraft(session.campaignId, {
    entityType: input.entityType,
    prompt: "(imported)",
    rawText: raw,
    parsedJson,
    provider: "import",
  });
  return { ok: true, data: toDraftView(row) };
}

// ─────────────────────────────────────────────────────────────────────────────
// LIST
// ─────────────────────────────────────────────────────────────────────────────

export async function listDraftsAction(
  session: Session | null,
  opts?: { includeRejected?: boolean },
): Promise<AIResult<AIDraftView[]>> {
  if (!session) return unauthorized();
  if (!isDM(session)) return forbidden();
  const rows = await repo.listDrafts(session.campaignId, {
    includeRejected: opts?.includeRejected,
  });
  return { ok: true, data: rows.map(toDraftView) };
}

// ─────────────────────────────────────────────────────────────────────────────
// EDIT raw text (DM tweaks a pending draft before approving)
// ─────────────────────────────────────────────────────────────────────────────

export async function editDraft(
  session: Session | null,
  id: string,
  rawText: unknown,
): Promise<AIResult<AIDraftView>> {
  if (!session) return unauthorized();
  if (!isDM(session)) return forbidden();
  if (typeof rawText !== "string" || rawText.trim().length === 0) return invalid("invalid_rawText");

  const draft = await repo.getDraft(session.campaignId, id);
  if (!draft) return notFound();
  if (draft.status !== "pending") return invalid("not_pending"); // edge 5.13

  // Re-parse the edited text so the preview/approve sees fresh structure.
  const parsed = tryParseJson(rawText);
  const updated = await repo.updateDraft(session.campaignId, id, {
    rawText,
    parsedJson: parsed != null ? JSON.stringify(parsed) : null,
  });
  if (!updated) return notFound();
  return { ok: true, data: toDraftView(updated) };
}

// ─────────────────────────────────────────────────────────────────────────────
// APPROVE (creates a real Story entity; loot is display-only)
// ─────────────────────────────────────────────────────────────────────────────

export async function approveDraft(
  session: Session | null,
  id: string,
): Promise<AIResult<{ draft: AIDraftView; createdEntityId: string | null }>> {
  if (!session) return unauthorized();
  if (!isDM(session)) return forbidden();

  const draft = await repo.getDraft(session.campaignId, id);
  if (!draft) return notFound();
  if (draft.status !== "pending") return invalid("not_pending"); // edge 5.13

  const parsed = draft.parsedJson ? safeParse(draft.parsedJson) : null;
  let createdEntityId: string | null = null;
  let approvedEntityType: string | null = null;

  switch (draft.entityType as AIDraftEntityType) {
    case "npc": {
      const npc = parsed as NpcDraft | null;
      if (!npc || typeof npc.name !== "string" || !npc.name.trim()) return invalid("unparseable_draft");
      if ((await repo.countNpcs(session.campaignId)) >= NPC_LIMIT) return invalid("limit_reached"); // 5.5
      const row = await storyCreateNpc(session.campaignId, {
        name: npc.name.trim().slice(0, 100),
        role: npc.role?.slice(0, 80) ?? null,
        faction: null,
        notes: npcNotes(npc),
        isAlive: true,
        characterId: null,
      });
      createdEntityId = row.id;
      approvedEntityType = "npc";
      break;
    }
    case "quest": {
      const quest = parsed as QuestDraft | null;
      if (!quest || typeof quest.name !== "string" || !quest.name.trim()) return invalid("unparseable_draft");
      if ((await repo.countQuests(session.campaignId)) >= QUEST_LIMIT) return invalid("limit_reached"); // 5.6
      const objectives = Array.isArray(quest.objectives)
        ? quest.objectives
            .filter((o): o is string => typeof o === "string" && o.trim().length > 0)
            .map((text) => ({ text: text.trim(), checked: false }))
        : [];
      const row = await storyCreateQuest(session.campaignId, {
        name: quest.name.trim().slice(0, 120),
        description: quest.rewardHint ? `**Reward:** ${quest.rewardHint}` : null,
        giverName: quest.giverHint?.slice(0, 100) ?? null,
        status: "active",
        objectivesJson: serializeObjectives(objectives),
        reward: quest.rewardHint ?? null,
      });
      createdEntityId = row.id;
      approvedEntityType = "quest";
      break;
    }
    case "session_recap": {
      // sessionId was stashed in parsedJson at generate time.
      const sid = (parsed as { sessionId?: unknown } | null)?.sessionId;
      if (typeof sid !== "string") return invalid("no_active_session");
      const applied = await repo.applyRecap(session.campaignId, sid, draft.rawText);
      if (!applied) return invalid("no_active_session");
      createdEntityId = sid;
      approvedEntityType = "session_recap";
      break;
    }
    case "loot": {
      // Display-only: no entity created (no LootAward table in this app).
      createdEntityId = null;
      approvedEntityType = "loot";
      break;
    }
  }

  const updated = await repo.updateDraft(session.campaignId, id, {
    status: "approved",
    approvedEntityId: createdEntityId,
    approvedEntityType,
  });
  if (!updated) return notFound();
  return { ok: true, data: { draft: toDraftView(updated), createdEntityId } };
}

// ─────────────────────────────────────────────────────────────────────────────
// REJECT (soft delete → status:"rejected")
// ─────────────────────────────────────────────────────────────────────────────

export async function rejectDraft(
  session: Session | null,
  id: string,
): Promise<AIResult<{ id: string }>> {
  if (!session) return unauthorized();
  if (!isDM(session)) return forbidden();
  const updated = await repo.softDeleteDraft(session.campaignId, id);
  if (!updated) return notFound();
  return { ok: true, data: { id } };
}

// ─────────────────────────────────────────────────────────────────────────────
// PROVIDER STATUS (no role gate — health only)
// ─────────────────────────────────────────────────────────────────────────────

export async function getProviderStatus(): Promise<ProviderStatus> {
  const provider = getLLMProvider();
  let ollama = false;
  if (provider) {
    try {
      ollama = await provider.isAvailable();
    } catch {
      ollama = false;
    }
  }
  return { ollama, import: true };
}

// ── internal helpers ────────────────────────────────────────────────────────

/** Build the parsedJson string stored on a draft, per entity type. */
function buildParsedJson(
  entityType: AIDraftEntityType,
  raw: string,
  ctx: { cr?: number; itemPool?: string[]; recapSessionId?: string | null },
): string | null {
  if (entityType === "loot") {
    // Deterministic: rarity/count/xp are code, not the model (edge 5.3 safe).
    const loot = parseLootDraft(raw, ctx.cr ?? 0, ctx.itemPool ?? []);
    return JSON.stringify(loot);
  }
  if (entityType === "session_recap") {
    const parsed = tryParseJson(raw) as { recap?: unknown } | null;
    const recap = typeof parsed?.recap === "string" ? parsed.recap : raw.trim();
    // Stash sessionId so approve knows which session to patch.
    return JSON.stringify({ recap, sessionId: ctx.recapSessionId ?? null });
  }
  // npc / quest: store parsed JSON, or null if the model didn't return valid JSON (edge 5.3).
  const parsed = tryParseJson(raw);
  return parsed != null ? JSON.stringify(parsed) : null;
}

/** Compose an NPC's markdown notes from the parsed draft fields. */
function npcNotes(npc: NpcDraft): string {
  const parts: string[] = [];
  if (npc.appearance) parts.push(`**Appearance:** ${npc.appearance}`);
  if (npc.personality) parts.push(`**Personality:** ${npc.personality}`);
  if (npc.secret) parts.push(`**Secret (DM):** ${npc.secret}`);
  return parts.join("\n\n");
}
