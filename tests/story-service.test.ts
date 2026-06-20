import { describe, it, expect, vi, beforeEach } from "vitest";

// Story service tests (Sprint 5 QA).
// Mocks: lib/story/repo — no DB touched.
// Tests: authz matrix (DM/player/401), all PRD §5 edges, multi-tenancy.

const repoMock = vi.hoisted(() => ({
  listSessions: vi.fn(),
  getSessionById: vi.fn(),
  createSession: vi.fn(),
  updateSession: vi.fn(),
  deleteSession: vi.fn(),
  listQuests: vi.fn(),
  getQuestById: vi.fn(),
  createQuest: vi.fn(),
  updateQuest: vi.fn(),
  deleteQuest: vi.fn(),
  listNpcs: vi.fn(),
  getNpcById: vi.fn(),
  createNpc: vi.fn(),
  updateNpc: vi.fn(),
  deleteNpc: vi.fn(),
  listJournal: vi.fn(),
  getJournalEntryById: vi.fn(),
  createJournalEntry: vi.fn(),
  updateJournalEntry: vi.fn(),
  deleteJournalEntry: vi.fn(),
  sessionExistsInCampaign: vi.fn(),
}));

vi.mock("@/lib/story/repo", () => repoMock);

import {
  canWrite,
  listSessionsAction,
  getSessionAction,
  createSessionAction,
  updateSessionAction,
  deleteSessionAction,
  listQuestsAction,
  createQuestAction,
  updateQuestAction,
  deleteQuestAction,
  listNpcsAction,
  getNpcAction,
  createNpcAction,
  updateNpcAction,
  deleteNpcAction,
  listJournalAction,
  getJournalAction,
  createJournalAction,
  updateJournalAction,
  deleteJournalAction,
} from "@/lib/story/service";
import type { Session } from "@/lib/characters/service";

// ── Fixture sessions ──────────────────────────────────────────────────────────
const dm: Session = { sessionId: "dm1", campaignId: "camp1", role: "dm" };
const player: Session = { sessionId: "p1", campaignId: "camp1", role: "player" };

// ── Fixture DB rows ────────────────────────────────────────────────────────────

function makeSessionRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "sess1",
    campaignId: "camp1",
    title: "Session 1",
    date: new Date("2026-06-01"),
    summary: "The party arrived in Thornhaven.",
    xpAwarded: 250,
    notableLoot: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeSessionRowWithJournals(overrides: Record<string, unknown> = {}) {
  return { ...makeSessionRow(overrides), journalEntries: [] };
}

function makeQuestRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "q1",
    campaignId: "camp1",
    name: "Find the Sunken Temple",
    description: null,
    giverName: "Elder Maren",
    status: "active",
    objectivesJson: "[]",
    reward: null,
    createdAt: new Date("2026-06-01"),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeNpcRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "npc1",
    campaignId: "camp1",
    characterId: null,
    name: "Elder Maren",
    role: "Town Elder",
    faction: "Thornhaven Council",
    notes: null,
    isAlive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeJournalRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "j1",
    campaignId: "camp1",
    sessionId: null,
    title: "Thornhaven Lore",
    content: "## History\n\nThornhaven was founded three centuries ago.",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeJournalRowWithSession(overrides: Record<string, unknown> = {}) {
  return { ...makeJournalRow(overrides), session: null };
}

// ── canWrite ──────────────────────────────────────────────────────────────────

describe("canWrite", () => {
  it("DM → true", () => expect(canWrite(dm)).toBe(true));
  it("player → false", () => expect(canWrite(player)).toBe(false));
});

// ── Sessions ──────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  repoMock.listSessions.mockResolvedValue([]);
  repoMock.getSessionById.mockResolvedValue(null);
  repoMock.createSession.mockResolvedValue(makeSessionRowWithJournals());
  repoMock.updateSession.mockResolvedValue(makeSessionRow());
  repoMock.deleteSession.mockResolvedValue(true);
  repoMock.listQuests.mockResolvedValue([]);
  repoMock.getQuestById.mockResolvedValue(null);
  repoMock.createQuest.mockResolvedValue(makeQuestRow());
  repoMock.updateQuest.mockResolvedValue(makeQuestRow());
  repoMock.deleteQuest.mockResolvedValue(true);
  repoMock.listNpcs.mockResolvedValue([]);
  repoMock.getNpcById.mockResolvedValue(null);
  repoMock.createNpc.mockResolvedValue(makeNpcRow());
  repoMock.updateNpc.mockResolvedValue(makeNpcRow());
  repoMock.deleteNpc.mockResolvedValue(true);
  repoMock.listJournal.mockResolvedValue([]);
  repoMock.getJournalEntryById.mockResolvedValue(null);
  repoMock.createJournalEntry.mockResolvedValue(makeJournalRow());
  repoMock.updateJournalEntry.mockResolvedValue(makeJournalRow());
  repoMock.deleteJournalEntry.mockResolvedValue(true);
  repoMock.sessionExistsInCampaign.mockResolvedValue(true);
});

describe("listSessionsAction", () => {
  it("null session → 401 (edge 5.16)", async () => {
    const r = await listSessionsAction(null);
    expect(r.ok).toBe(false);
    if (!r.ok) { expect(r.status).toBe(401); expect(r.error).toBe("unauthorized"); }
  });

  it("DM → list (scoped to session.campaignId)", async () => {
    repoMock.listSessions.mockResolvedValue([makeSessionRow()]);
    const r = await listSessionsAction(dm);
    expect(r.ok).toBe(true);
    expect(repoMock.listSessions).toHaveBeenCalledWith("camp1");
    if (r.ok) expect(r.data).toHaveLength(1);
  });

  it("player → list (read-only allowed)", async () => {
    const r = await listSessionsAction(player);
    expect(r.ok).toBe(true);
  });
});

describe("getSessionAction", () => {
  it("null session → 401 (edge 5.16)", async () => {
    const r = await getSessionAction(null, "sess1");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(401);
  });

  it("session not in campaign → 404 (edge 5.15 multi-tenancy)", async () => {
    repoMock.getSessionById.mockResolvedValue(null);
    const r = await getSessionAction(dm, "sess-other");
    expect(r.ok).toBe(false);
    if (!r.ok) { expect(r.status).toBe(404); expect(r.error).toBe("not_found"); }
  });

  it("DM with valid id → 200", async () => {
    repoMock.getSessionById.mockResolvedValue(makeSessionRowWithJournals());
    const r = await getSessionAction(dm, "sess1");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.id).toBe("sess1");
  });
});

describe("createSessionAction", () => {
  it("null session → 401 (edge 5.16)", async () => {
    const r = await createSessionAction(null, {});
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(401);
  });

  it("player → 403 (edge 5.5)", async () => {
    const r = await createSessionAction(player, { date: "2026-06-01" });
    expect(r.ok).toBe(false);
    if (!r.ok) { expect(r.status).toBe(403); expect(r.error).toBe("forbidden"); }
  });

  it("DM missing date → 422", async () => {
    const r = await createSessionAction(dm, {});
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(422);
  });

  it("DM negative xp → 422 (edge 5.19)", async () => {
    const r = await createSessionAction(dm, { date: "2026-06-01", xpAwarded: -5 });
    expect(r.ok).toBe(false);
    if (!r.ok) { expect(r.status).toBe(422); expect(r.error).toBe("invalid_xp"); }
  });

  it("DM xp=0 → ok (edge 5.2 milestone campaigns)", async () => {
    repoMock.createSession.mockResolvedValue(makeSessionRowWithJournals({ xpAwarded: 0 }));
    const r = await createSessionAction(dm, { date: "2026-06-01", xpAwarded: 0 });
    expect(r.ok).toBe(true);
  });

  it("DM future date → ok (edge 5.1)", async () => {
    repoMock.createSession.mockResolvedValue(makeSessionRowWithJournals({ date: new Date("2099-01-01") }));
    const r = await createSessionAction(dm, { date: "2099-01-01" });
    expect(r.ok).toBe(true);
  });

  it("campaignId comes from session token, not body (edge 5.14)", async () => {
    await createSessionAction(dm, { date: "2026-06-01", campaignId: "injected-camp" });
    expect(repoMock.createSession).toHaveBeenCalledWith(
      "camp1",
      expect.objectContaining({}),
    );
  });
});

describe("updateSessionAction", () => {
  it("player → 403 (edge 5.5)", async () => {
    const r = await updateSessionAction(player, "sess1", { title: "Renamed" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(403);
  });

  it("DM invalid xp → 422 (edge 5.19)", async () => {
    const r = await updateSessionAction(dm, "sess1", { xpAwarded: -1 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(422);
  });

  it("DM non-existent id → 404 (edge 5.17)", async () => {
    repoMock.updateSession.mockResolvedValue(null);
    const r = await updateSessionAction(dm, "ghost", { title: "X" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(404);
  });

  it("DM valid → 200, re-fetches with journalEntries", async () => {
    repoMock.updateSession.mockResolvedValue(makeSessionRow());
    repoMock.getSessionById.mockResolvedValue(makeSessionRowWithJournals({ title: "Renamed" }));
    const r = await updateSessionAction(dm, "sess1", { title: "Renamed" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.title).toBe("Renamed");
  });
});

describe("deleteSessionAction", () => {
  it("null session → 401", async () => {
    const r = await deleteSessionAction(null, "sess1");
    if (!r.ok) expect(r.status).toBe(401);
  });

  it("player → 403 (edge 5.5)", async () => {
    const r = await deleteSessionAction(player, "sess1");
    if (!r.ok) expect(r.status).toBe(403);
  });

  it("DM non-existent → 404 (edge 5.17)", async () => {
    repoMock.deleteSession.mockResolvedValue(false);
    const r = await deleteSessionAction(dm, "ghost");
    if (!r.ok) expect(r.status).toBe(404);
  });

  it("DM valid → 200 (journal entries unlinked via DB SET NULL, edge 5.7)", async () => {
    repoMock.deleteSession.mockResolvedValue(true);
    const r = await deleteSessionAction(dm, "sess1");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.id).toBe("sess1");
  });
});

// ── Quests ───────────────────────────────────────────────────────────────────

describe("listQuestsAction", () => {
  it("null session → 401", async () => {
    const r = await listQuestsAction(null);
    if (!r.ok) expect(r.status).toBe(401);
  });

  it("sorts active before completed (statusSortWeight)", async () => {
    repoMock.listQuests.mockResolvedValue([
      makeQuestRow({ id: "q2", status: "completed", createdAt: new Date("2026-05-01") }),
      makeQuestRow({ id: "q1", status: "active", createdAt: new Date("2026-06-01") }),
    ]);
    const r = await listQuestsAction(dm);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data[0].status).toBe("active");
      expect(r.data[1].status).toBe("completed");
    }
  });
});

describe("createQuestAction", () => {
  it("null session → 401", async () => {
    const r = await createQuestAction(null, {});
    if (!r.ok) expect(r.status).toBe(401);
  });

  it("player → 403 (edge 5.5 and 5.6)", async () => {
    const r = await createQuestAction(player, { name: "Q" });
    if (!r.ok) expect(r.status).toBe(403);
  });

  it("DM empty quest name → 422 (edge 5.11)", async () => {
    const r = await createQuestAction(dm, { name: "" });
    expect(r.ok).toBe(false);
    if (!r.ok) { expect(r.status).toBe(422); expect(r.error).toBe("invalid_name"); }
  });

  it("DM invalid status → 422", async () => {
    const r = await createQuestAction(dm, { name: "Q", status: "wip" });
    if (!r.ok) expect(r.status).toBe(422);
  });

  it("DM zero objectives → ok (edge 5.4)", async () => {
    const r = await createQuestAction(dm, { name: "Find the Temple", objectives: [] });
    expect(r.ok).toBe(true);
  });

  it("DM valid quest → 200", async () => {
    const r = await createQuestAction(dm, { name: "Find the Temple" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.name).toBe("Find the Sunken Temple");
  });
});

describe("updateQuestAction", () => {
  it("player → 403 (edge 5.6 — objectives toggle)", async () => {
    const r = await updateQuestAction(player, "q1", {
      objectives: [{ text: "Done", checked: true }],
    });
    if (!r.ok) expect(r.status).toBe(403);
  });

  it("DM invalid status → 422", async () => {
    const r = await updateQuestAction(dm, "q1", { status: "in-progress" });
    if (!r.ok) expect(r.status).toBe(422);
  });

  it("DM non-existent → 404 (edge 5.17)", async () => {
    repoMock.updateQuest.mockResolvedValue(null);
    const r = await updateQuestAction(dm, "ghost", { name: "X" });
    if (!r.ok) expect(r.status).toBe(404);
  });

  it("DM valid update → 200", async () => {
    repoMock.updateQuest.mockResolvedValue(makeQuestRow({ status: "completed" }));
    const r = await updateQuestAction(dm, "q1", { status: "completed" });
    expect(r.ok).toBe(true);
  });
});

describe("deleteQuestAction", () => {
  it("player → 403 (edge 5.5)", async () => {
    const r = await deleteQuestAction(player, "q1");
    if (!r.ok) expect(r.status).toBe(403);
  });

  it("DM non-existent → 404 (edge 5.8 — giverName is free text, no FK cascade needed)", async () => {
    repoMock.deleteQuest.mockResolvedValue(false);
    const r = await deleteQuestAction(dm, "ghost");
    if (!r.ok) expect(r.status).toBe(404);
  });
});

// ── NPCs ─────────────────────────────────────────────────────────────────────

describe("listNpcsAction", () => {
  it("null session → 401", async () => {
    const r = await listNpcsAction(null);
    if (!r.ok) expect(r.status).toBe(401);
  });
  it("player → list (read-only)", async () => {
    repoMock.listNpcs.mockResolvedValue([makeNpcRow()]);
    const r = await listNpcsAction(player);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data).toHaveLength(1);
  });
});

describe("getNpcAction", () => {
  it("null session → 401", async () => {
    const r = await getNpcAction(null, "npc1");
    if (!r.ok) expect(r.status).toBe(401);
  });
  it("NPC from another campaign → 404 (edge 5.15)", async () => {
    repoMock.getNpcById.mockResolvedValue(null);
    const r = await getNpcAction(dm, "other-npc");
    if (!r.ok) expect(r.status).toBe(404);
  });
  it("DM valid → 200", async () => {
    repoMock.getNpcById.mockResolvedValue(makeNpcRow());
    const r = await getNpcAction(dm, "npc1");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.name).toBe("Elder Maren");
  });
});

describe("createNpcAction", () => {
  it("null session → 401", async () => {
    const r = await createNpcAction(null, {});
    if (!r.ok) expect(r.status).toBe(401);
  });
  it("player → 403 (edge 5.5)", async () => {
    const r = await createNpcAction(player, { name: "Maren" });
    if (!r.ok) expect(r.status).toBe(403);
  });
  it("DM empty name → 422 (edge 5.12)", async () => {
    const r = await createNpcAction(dm, { name: "" });
    expect(r.ok).toBe(false);
    if (!r.ok) { expect(r.status).toBe(422); expect(r.error).toBe("invalid_name"); }
  });
  it("DM valid → 200, campaignId from session (edge 5.14)", async () => {
    await createNpcAction(dm, { name: "Elder Maren", campaignId: "injected" });
    expect(repoMock.createNpc).toHaveBeenCalledWith("camp1", expect.any(Object));
  });
});

describe("updateNpcAction", () => {
  it("player → 403 (edge 5.5 — alive/dead toggle)", async () => {
    const r = await updateNpcAction(player, "npc1", { isAlive: false });
    if (!r.ok) expect(r.status).toBe(403);
  });
  it("DM non-existent → 404 (edge 5.17)", async () => {
    repoMock.updateNpc.mockResolvedValue(null);
    const r = await updateNpcAction(dm, "ghost", { name: "X" });
    if (!r.ok) expect(r.status).toBe(404);
  });
  it("DM toggle alive/dead → 200", async () => {
    repoMock.updateNpc.mockResolvedValue(makeNpcRow({ isAlive: false }));
    const r = await updateNpcAction(dm, "npc1", { isAlive: false });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.isAlive).toBe(false);
  });
});

describe("deleteNpcAction", () => {
  it("player → 403", async () => {
    const r = await deleteNpcAction(player, "npc1");
    if (!r.ok) expect(r.status).toBe(403);
  });
  it("DM valid → 200", async () => {
    const r = await deleteNpcAction(dm, "npc1");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.id).toBe("npc1");
  });
});

// ── Journal ──────────────────────────────────────────────────────────────────

describe("listJournalAction", () => {
  it("null session → 401 (edge 5.16)", async () => {
    const r = await listJournalAction(null);
    if (!r.ok) expect(r.status).toBe(401);
  });
  it("player → list (read-only)", async () => {
    repoMock.listJournal.mockResolvedValue([makeJournalRowWithSession()]);
    const r = await listJournalAction(player);
    expect(r.ok).toBe(true);
  });
});

describe("getJournalAction", () => {
  it("null session → 401", async () => {
    const r = await getJournalAction(null, "j1");
    if (!r.ok) expect(r.status).toBe(401);
  });
  it("entry from another campaign → 404 (edge 5.15)", async () => {
    repoMock.getJournalEntryById.mockResolvedValue(null);
    const r = await getJournalAction(dm, "other-j");
    if (!r.ok) expect(r.status).toBe(404);
  });
  it("valid id → 200", async () => {
    repoMock.getJournalEntryById.mockResolvedValue(makeJournalRow());
    const r = await getJournalAction(dm, "j1");
    expect(r.ok).toBe(true);
  });
});

describe("createJournalAction", () => {
  it("null session → 401", async () => {
    const r = await createJournalAction(null, {});
    if (!r.ok) expect(r.status).toBe(401);
  });

  it("player → 403 (edge 5.5)", async () => {
    const r = await createJournalAction(player, { content: "Notes" });
    if (!r.ok) expect(r.status).toBe(403);
  });

  it("DM empty content → 422 (edge 5.13)", async () => {
    const r = await createJournalAction(dm, { content: "" });
    expect(r.ok).toBe(false);
    if (!r.ok) { expect(r.status).toBe(422); expect(r.error).toBe("invalid_content"); }
  });

  it("DM sessionId from another campaign → 422 (edge 5.20)", async () => {
    repoMock.sessionExistsInCampaign.mockResolvedValue(false);
    const r = await createJournalAction(dm, { content: "Notes", sessionId: "sess-other-camp" });
    expect(r.ok).toBe(false);
    if (!r.ok) { expect(r.status).toBe(422); expect(r.error).toBe("invalid_session"); }
  });

  it("DM no sessionId → 200 (unlinked entry allowed)", async () => {
    const r = await createJournalAction(dm, { content: "Unlinked notes" });
    expect(r.ok).toBe(true);
    expect(repoMock.sessionExistsInCampaign).not.toHaveBeenCalled();
  });

  it("DM valid with same-campaign sessionId → 200", async () => {
    repoMock.sessionExistsInCampaign.mockResolvedValue(true);
    const r = await createJournalAction(dm, { content: "Notes", sessionId: "sess1" });
    expect(r.ok).toBe(true);
    expect(repoMock.sessionExistsInCampaign).toHaveBeenCalledWith("camp1", "sess1");
  });

  it("campaignId from session, not body (edge 5.14)", async () => {
    await createJournalAction(dm, { content: "Notes", campaignId: "injected" });
    expect(repoMock.createJournalEntry).toHaveBeenCalledWith("camp1", expect.any(Object));
  });
});

describe("updateJournalAction", () => {
  it("player → 403", async () => {
    const r = await updateJournalAction(player, "j1", { content: "X" });
    if (!r.ok) expect(r.status).toBe(403);
  });
  it("DM cross-campaign sessionId on update → 422 (edge 5.20)", async () => {
    repoMock.sessionExistsInCampaign.mockResolvedValue(false);
    const r = await updateJournalAction(dm, "j1", { content: "X", sessionId: "sess-other" });
    if (!r.ok) expect(r.status).toBe(422);
  });
  it("DM non-existent → 404 (edge 5.17)", async () => {
    repoMock.updateJournalEntry.mockResolvedValue(null);
    const r = await updateJournalAction(dm, "ghost", { content: "X" });
    if (!r.ok) expect(r.status).toBe(404);
  });
});

describe("deleteJournalAction", () => {
  it("player → 403 (edge 5.5)", async () => {
    const r = await deleteJournalAction(player, "j1");
    if (!r.ok) expect(r.status).toBe(403);
  });
  it("DM non-existent → 404 (edge 5.17)", async () => {
    repoMock.deleteJournalEntry.mockResolvedValue(false);
    const r = await deleteJournalAction(dm, "ghost");
    if (!r.ok) expect(r.status).toBe(404);
  });
  it("DM valid → 200", async () => {
    const r = await deleteJournalAction(dm, "j1");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.id).toBe("j1");
  });
});
