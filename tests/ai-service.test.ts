// File: tests/ai-service.test.ts
// AI DM Assistant service tests (Sprint 7 QA).
// Mocks: lib/ai/repo (no DB), lib/llm/registry (no Ollama), lib/story/repo (approve targets).
// Covers: DM-only authz (401/403), PRD §5 edges, hybrid-rules determinism, the full
// human-in-the-loop approve/reject lifecycle.

import { describe, it, expect, vi, beforeEach } from "vitest";

const repoMock = vi.hoisted(() => ({
  createDraft: vi.fn(),
  getDraft: vi.fn(),
  listDrafts: vi.fn(),
  updateDraft: vi.fn(),
  softDeleteDraft: vi.fn(),
  countNpcs: vi.fn(),
  countQuests: vi.fn(),
  itemPoolForLoot: vi.fn(),
  sessionContext: vi.fn(),
  applyRecap: vi.fn(),
}));
const registryMock = vi.hoisted(() => ({ getLLMProvider: vi.fn() }));
const storyRepoMock = vi.hoisted(() => ({ createNpc: vi.fn(), createQuest: vi.fn() }));

vi.mock("@/lib/ai/repo", () => repoMock);
vi.mock("@/lib/llm/registry", () => registryMock);
vi.mock("@/lib/story/repo", () => storyRepoMock);

import {
  generateDraft,
  importDraft,
  approveDraft,
  rejectDraft,
  listDraftsAction,
  editDraft,
  getProviderStatus,
} from "@/lib/ai/service";
import { ProviderError } from "@/lib/ai/ollama";
import { crToXp } from "@/lib/reference/srd";
import type { Session } from "@/lib/characters/service";

const dm: Session = { sessionId: "dm1", campaignId: "camp1", role: "dm" };
const player: Session = { sessionId: "p1", campaignId: "camp1", role: "player" };

// ── fixtures ────────────────────────────────────────────────────────────────
function makeDraftRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "d1",
    campaignId: "camp1",
    entityType: "npc",
    prompt: "a grumpy dwarf",
    rawText: '{"name":"Borin"}',
    parsedJson: '{"name":"Borin"}',
    provider: "ollama",
    status: "pending",
    approvedEntityId: null,
    approvedEntityType: null,
    createdAt: new Date("2026-06-25T00:00:00Z"),
    ...overrides,
  };
}

/** A fake LLM provider with controllable availability + output. */
function fakeProvider(opts: { available?: boolean; output?: string; throws?: Error }) {
  return {
    id: "ollama",
    isAvailable: vi.fn().mockResolvedValue(opts.available ?? true),
    generate: opts.throws
      ? vi.fn().mockRejectedValue(opts.throws)
      : vi.fn().mockResolvedValue(opts.output ?? "{}"),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  repoMock.itemPoolForLoot.mockResolvedValue([]);
  repoMock.createDraft.mockImplementation((campaignId: string, data: Record<string, unknown>) =>
    Promise.resolve(makeDraftRow({ campaignId, ...data })),
  );
});

// ─────────────────────────────────────────────────────────────────────────────
describe("generateDraft — authz (DM-only)", () => {
  it("401 when no session", async () => {
    const r = await generateDraft(null, { entityType: "npc", prompt: "x" });
    expect(r).toMatchObject({ ok: false, status: 401 });
  });
  it("403 when player (edge 5.9)", async () => {
    const r = await generateDraft(player, { entityType: "npc", prompt: "x" });
    expect(r).toMatchObject({ ok: false, status: 403 });
  });
});

describe("generateDraft — validation", () => {
  it("422 invalid_entity_type", async () => {
    const r = await generateDraft(dm, { entityType: "monster" as never, prompt: "x" });
    expect(r).toMatchObject({ ok: false, status: 422, error: "invalid_entity_type" });
  });
  it("422 prompt_required on empty prompt (edge 5.4)", async () => {
    const r = await generateDraft(dm, { entityType: "npc", prompt: "" });
    expect(r).toMatchObject({ ok: false, status: 422, error: "prompt_required" });
  });
  it("422 invalid_cr for loot with bad CR", async () => {
    const r = await generateDraft(dm, { entityType: "loot", prompt: "x", context: { cr: 99 } });
    expect(r).toMatchObject({ ok: false, status: 422, error: "invalid_cr" });
  });
  it("422 no_active_session for recap without sessionId (edge 5.14)", async () => {
    const r = await generateDraft(dm, { entityType: "session_recap", prompt: "x" });
    expect(r).toMatchObject({ ok: false, status: 422, error: "no_active_session" });
  });
  it("422 no_active_session when sessionId not in campaign (cross-tenant)", async () => {
    repoMock.sessionContext.mockResolvedValue(null);
    const r = await generateDraft(dm, {
      entityType: "session_recap",
      prompt: "x",
      context: { sessionId: "other" },
    });
    expect(r).toMatchObject({ ok: false, status: 422, error: "no_active_session" });
  });
});

describe("generateDraft — provider availability", () => {
  it("503 when no provider configured (edge 5.1)", async () => {
    registryMock.getLLMProvider.mockReturnValue(null);
    const r = await generateDraft(dm, { entityType: "npc", prompt: "x" });
    expect(r).toMatchObject({ ok: false, status: 503, error: "provider_unavailable" });
  });
  it("503 when provider present but unavailable (Ollama down)", async () => {
    registryMock.getLLMProvider.mockReturnValue(fakeProvider({ available: false }));
    const r = await generateDraft(dm, { entityType: "npc", prompt: "x" });
    expect(r).toMatchObject({ ok: false, status: 503 });
  });
  it("502 when provider.generate throws ProviderError (edge 5.2) — draft NOT saved", async () => {
    registryMock.getLLMProvider.mockReturnValue(
      fakeProvider({ throws: new ProviderError("timeout") }),
    );
    const r = await generateDraft(dm, { entityType: "npc", prompt: "x" });
    expect(r).toMatchObject({ ok: false, status: 502 });
    expect(r.ok === false && r.error).toContain("provider_error");
    expect(repoMock.createDraft).not.toHaveBeenCalled();
  });
});

describe("generateDraft — happy paths", () => {
  it("npc: parses JSON output into parsedJson + saves draft (provider=ollama)", async () => {
    registryMock.getLLMProvider.mockReturnValue(
      fakeProvider({ output: '{"name":"Malachar","role":"merchant"}' }),
    );
    const r = await generateDraft(dm, { entityType: "npc", prompt: "shady merchant" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.parsedJson).toMatchObject({ name: "Malachar", role: "merchant" });
      expect(r.data.provider).toBe("ollama");
    }
    expect(repoMock.createDraft).toHaveBeenCalledWith(
      "camp1",
      expect.objectContaining({ entityType: "npc", provider: "ollama" }),
    );
  });

  it("npc: unparseable model output → parsedJson null but draft still saved (edge 5.3)", async () => {
    registryMock.getLLMProvider.mockReturnValue(
      fakeProvider({ output: "I am a chatty model with no JSON." }),
    );
    const r = await generateDraft(dm, { entityType: "npc", prompt: "x" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.parsedJson).toBeNull();
    expect(repoMock.createDraft).toHaveBeenCalledWith(
      "camp1",
      expect.objectContaining({ parsedJson: null }),
    );
  });

  it("loot: xp/rarity are deterministic code, not the model (US-2)", async () => {
    registryMock.getLLMProvider.mockReturnValue(
      fakeProvider({ output: '{"items":[{"name":"Flametongue"}]}' }),
    );
    const r = await generateDraft(dm, { entityType: "loot", prompt: "fire haul", context: { cr: 5 } });
    expect(r.ok).toBe(true);
    if (r.ok) {
      const loot = r.data.parsedJson as { xp: number; items: Array<{ rarity: string }> };
      expect(loot.xp).toBe(crToXp(5));
      expect(loot.items[0].rarity).toBe("uncommon");
    }
  });

  it("recap: stashes sessionId in parsedJson for later approve", async () => {
    repoMock.sessionContext.mockResolvedValue({ date: "2026-06-25", title: "S1" });
    registryMock.getLLMProvider.mockReturnValue(fakeProvider({ output: '{"recap":"It was dark."}' }));
    const r = await generateDraft(dm, {
      entityType: "session_recap",
      prompt: "recap it",
      context: { sessionId: "sess1" },
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.parsedJson).toMatchObject({ recap: "It was dark.", sessionId: "sess1" });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("importDraft (US-5 — always available, no network)", () => {
  it("401 / 403 authz", async () => {
    expect(await importDraft(null, { entityType: "npc", content: "x" })).toMatchObject({ status: 401 });
    expect(await importDraft(player, { entityType: "npc", content: "x" })).toMatchObject({ status: 403 });
  });
  it("422 content_required on empty paste (edge 5.11)", async () => {
    const r = await importDraft(dm, { entityType: "npc", content: "" });
    expect(r).toMatchObject({ ok: false, status: 422, error: "content_required" });
  });
  it("422 invalid_entity_type", async () => {
    const r = await importDraft(dm, { entityType: "bogus" as never, content: "hi" });
    expect(r).toMatchObject({ ok: false, status: 422, error: "invalid_entity_type" });
  });
  it("parses pasted JSON + saves with provider=import (no provider needed)", async () => {
    registryMock.getLLMProvider.mockReturnValue(null); // prove import needs no LLM
    const r = await importDraft(dm, {
      entityType: "npc",
      content: '{"name":"Borin","role":"smith"}',
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.parsedJson).toMatchObject({ name: "Borin" });
      expect(r.data.provider).toBe("import");
    }
  });
  it("non-JSON paste → parsedJson null but still 201 (edit-manually path)", async () => {
    const r = await importDraft(dm, { entityType: "session_recap", content: "free prose recap" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.parsedJson).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("approveDraft — authz + lifecycle guards", () => {
  it("401 / 403", async () => {
    expect(await approveDraft(null, "d1")).toMatchObject({ status: 401 });
    expect(await approveDraft(player, "d1")).toMatchObject({ status: 403 });
  });
  it("404 when draft missing / cross-campaign", async () => {
    repoMock.getDraft.mockResolvedValue(null);
    expect(await approveDraft(dm, "d1")).toMatchObject({ status: 404 });
  });
  it("422 not_pending when already approved (edge 5.13)", async () => {
    repoMock.getDraft.mockResolvedValue(makeDraftRow({ status: "approved" }));
    expect(await approveDraft(dm, "d1")).toMatchObject({ status: 422, error: "not_pending" });
  });
});

describe("approveDraft — NPC", () => {
  it("creates a real Npc and marks the draft approved (DoD 5)", async () => {
    repoMock.getDraft.mockResolvedValue(
      makeDraftRow({ entityType: "npc", parsedJson: '{"name":"Voss","role":"cultist","secret":"is a spy"}' }),
    );
    repoMock.countNpcs.mockResolvedValue(3);
    storyRepoMock.createNpc.mockResolvedValue({ id: "npcNew" });
    repoMock.updateDraft.mockResolvedValue(makeDraftRow({ status: "approved", approvedEntityId: "npcNew" }));

    const r = await approveDraft(dm, "d1");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.createdEntityId).toBe("npcNew");
    expect(storyRepoMock.createNpc).toHaveBeenCalledWith(
      "camp1",
      expect.objectContaining({ name: "Voss", role: "cultist" }),
    );
    expect(repoMock.updateDraft).toHaveBeenCalledWith(
      "camp1",
      "d1",
      expect.objectContaining({ status: "approved", approvedEntityId: "npcNew" }),
    );
  });
  it("422 unparseable_draft when parsedJson is null", async () => {
    repoMock.getDraft.mockResolvedValue(makeDraftRow({ entityType: "npc", parsedJson: null }));
    expect(await approveDraft(dm, "d1")).toMatchObject({ status: 422, error: "unparseable_draft" });
    expect(storyRepoMock.createNpc).not.toHaveBeenCalled();
  });
  it("422 limit_reached when NPC cap hit (edge 5.5)", async () => {
    repoMock.getDraft.mockResolvedValue(makeDraftRow({ entityType: "npc", parsedJson: '{"name":"X"}' }));
    repoMock.countNpcs.mockResolvedValue(200);
    expect(await approveDraft(dm, "d1")).toMatchObject({ status: 422, error: "limit_reached" });
    expect(storyRepoMock.createNpc).not.toHaveBeenCalled();
  });
});

describe("approveDraft — Quest", () => {
  it("creates a Quest, mapping objectives[] → checklist (DoD 5)", async () => {
    repoMock.getDraft.mockResolvedValue(
      makeDraftRow({
        entityType: "quest",
        parsedJson: '{"name":"Sunken Temple","objectives":["Find map","Sail there"],"rewardHint":"gold"}',
      }),
    );
    repoMock.countQuests.mockResolvedValue(1);
    storyRepoMock.createQuest.mockResolvedValue({ id: "questNew" });
    repoMock.updateDraft.mockResolvedValue(makeDraftRow({ status: "approved", approvedEntityId: "questNew" }));

    const r = await approveDraft(dm, "d1");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.createdEntityId).toBe("questNew");
    const arg = storyRepoMock.createQuest.mock.calls[0][1];
    expect(arg.name).toBe("Sunken Temple");
    expect(JSON.parse(arg.objectivesJson)).toEqual([
      { text: "Find map", checked: false },
      { text: "Sail there", checked: false },
    ]);
  });
  it("422 limit_reached when Quest cap hit (edge 5.6)", async () => {
    repoMock.getDraft.mockResolvedValue(makeDraftRow({ entityType: "quest", parsedJson: '{"name":"X","objectives":[]}' }));
    repoMock.countQuests.mockResolvedValue(200);
    expect(await approveDraft(dm, "d1")).toMatchObject({ status: 422, error: "limit_reached" });
  });
});

describe("approveDraft — Loot (display-only) + Recap", () => {
  it("loot: no entity created, draft just flipped to approved", async () => {
    repoMock.getDraft.mockResolvedValue(
      makeDraftRow({ entityType: "loot", parsedJson: '{"cr":5,"xp":1800,"items":[]}' }),
    );
    repoMock.updateDraft.mockResolvedValue(makeDraftRow({ status: "approved" }));
    const r = await approveDraft(dm, "d1");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.createdEntityId).toBeNull();
    expect(storyRepoMock.createNpc).not.toHaveBeenCalled();
    expect(storyRepoMock.createQuest).not.toHaveBeenCalled();
  });
  it("recap: writes rawText to the stashed session (US-4)", async () => {
    repoMock.getDraft.mockResolvedValue(
      makeDraftRow({
        entityType: "session_recap",
        rawText: "Previously, the heroes…",
        parsedJson: '{"recap":"Previously…","sessionId":"sess1"}',
      }),
    );
    repoMock.applyRecap.mockResolvedValue(true);
    repoMock.updateDraft.mockResolvedValue(makeDraftRow({ status: "approved", approvedEntityId: "sess1" }));
    const r = await approveDraft(dm, "d1");
    expect(r.ok).toBe(true);
    expect(repoMock.applyRecap).toHaveBeenCalledWith("camp1", "sess1", "Previously, the heroes…");
  });
  it("recap: 422 no_active_session when sessionId missing from parsedJson", async () => {
    repoMock.getDraft.mockResolvedValue(
      makeDraftRow({ entityType: "session_recap", parsedJson: '{"recap":"x"}' }),
    );
    expect(await approveDraft(dm, "d1")).toMatchObject({ status: 422, error: "no_active_session" });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("rejectDraft (edge 5.7 — soft delete)", () => {
  it("401 / 403", async () => {
    expect(await rejectDraft(null, "d1")).toMatchObject({ status: 401 });
    expect(await rejectDraft(player, "d1")).toMatchObject({ status: 403 });
  });
  it("404 when nothing to reject", async () => {
    repoMock.softDeleteDraft.mockResolvedValue(null);
    expect(await rejectDraft(dm, "d1")).toMatchObject({ status: 404 });
  });
  it("flips status to rejected via softDeleteDraft", async () => {
    repoMock.softDeleteDraft.mockResolvedValue(makeDraftRow({ status: "rejected" }));
    const r = await rejectDraft(dm, "d1");
    expect(r.ok).toBe(true);
    expect(repoMock.softDeleteDraft).toHaveBeenCalledWith("camp1", "d1");
  });
});

describe("listDraftsAction", () => {
  it("401 / 403", async () => {
    expect(await listDraftsAction(null)).toMatchObject({ status: 401 });
    expect(await listDraftsAction(player)).toMatchObject({ status: 403 });
  });
  it("maps rows to views, scoped to the campaign", async () => {
    repoMock.listDrafts.mockResolvedValue([makeDraftRow(), makeDraftRow({ id: "d2" })]);
    const r = await listDraftsAction(dm, { includeRejected: false });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.map((d) => d.id)).toEqual(["d1", "d2"]);
    expect(repoMock.listDrafts).toHaveBeenCalledWith("camp1", { includeRejected: false });
  });
});

describe("editDraft", () => {
  it("401 / 403", async () => {
    expect(await editDraft(null, "d1", "x")).toMatchObject({ status: 401 });
    expect(await editDraft(player, "d1", "x")).toMatchObject({ status: 403 });
  });
  it("422 invalid_rawText on empty edit", async () => {
    expect(await editDraft(dm, "d1", "")).toMatchObject({ status: 422, error: "invalid_rawText" });
  });
  it("404 when draft missing", async () => {
    repoMock.getDraft.mockResolvedValue(null);
    expect(await editDraft(dm, "d1", "new")).toMatchObject({ status: 404 });
  });
  it("422 not_pending when locked (edge 5.13)", async () => {
    repoMock.getDraft.mockResolvedValue(makeDraftRow({ status: "approved" }));
    expect(await editDraft(dm, "d1", "new")).toMatchObject({ status: 422, error: "not_pending" });
  });
  it("re-parses edited JSON and persists", async () => {
    repoMock.getDraft.mockResolvedValue(makeDraftRow());
    repoMock.updateDraft.mockResolvedValue(makeDraftRow({ rawText: '{"name":"Edited"}', parsedJson: '{"name":"Edited"}' }));
    const r = await editDraft(dm, "d1", '{"name":"Edited"}');
    expect(r.ok).toBe(true);
    expect(repoMock.updateDraft).toHaveBeenCalledWith(
      "camp1",
      "d1",
      expect.objectContaining({ rawText: '{"name":"Edited"}', parsedJson: '{"name":"Edited"}' }),
    );
  });
});

describe("getProviderStatus (graceful degrade)", () => {
  it("ollama=false when no provider", async () => {
    registryMock.getLLMProvider.mockReturnValue(null);
    expect(await getProviderStatus()).toEqual({ ollama: false, import: true });
  });
  it("ollama=true when provider available", async () => {
    registryMock.getLLMProvider.mockReturnValue(fakeProvider({ available: true }));
    expect(await getProviderStatus()).toEqual({ ollama: true, import: true });
  });
  it("ollama=false (never throws) when isAvailable rejects", async () => {
    registryMock.getLLMProvider.mockReturnValue({
      id: "ollama",
      isAvailable: vi.fn().mockRejectedValue(new Error("boom")),
      generate: vi.fn(),
    });
    expect(await getProviderStatus()).toEqual({ ollama: false, import: true });
  });
});
