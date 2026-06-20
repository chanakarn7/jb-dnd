import { describe, it, expect } from "vitest";
import {
  validateXp,
  parseObjectives,
  validateObjectives,
  serializeObjectives,
  validateQuestStatus,
  isQuestStatus,
  validateSession,
  validateQuest,
  validateNpc,
  validateJournalEntry,
  summaryExcerpt,
  statusSortWeight,
  LIMITS,
} from "@/lib/story/rules";

// ── validateXp ───────────────────────────────────────────────────────────────

describe("validateXp", () => {
  it("null → ok (optional field)", () => expect(validateXp(null).valid).toBe(true));
  it("undefined → ok (optional field)", () => expect(validateXp(undefined).valid).toBe(true));
  it("0 → ok (milestone XP campaigns, edge 5.2)", () => expect(validateXp(0).valid).toBe(true));
  it("positive integer → ok", () => expect(validateXp(250).valid).toBe(true));
  it("negative integer → fail (edge 5.19)", () => {
    const r = validateXp(-1);
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.error).toBe("invalid_xp");
  });
  it("float → fail", () => expect(validateXp(1.5).valid).toBe(false));
  it("NaN → fail", () => expect(validateXp(NaN).valid).toBe(false));
  it("string → fail", () => expect(validateXp("100").valid).toBe(false));
});

// ── parseObjectives ──────────────────────────────────────────────────────────

describe("parseObjectives", () => {
  it("null → []", () => expect(parseObjectives(null)).toEqual([]));
  it("undefined → []", () => expect(parseObjectives(undefined)).toEqual([]));
  it("empty string → []", () => expect(parseObjectives("")).toEqual([]));
  it("invalid JSON → [] (edge 5.18 read fallback)", () => {
    expect(parseObjectives("not-json")).toEqual([]);
    expect(parseObjectives("{bad}")).toEqual([]);
  });
  it("non-array JSON → []", () => {
    expect(parseObjectives('{"text":"x","checked":false}')).toEqual([]);
  });
  it("valid objectives → ObjectiveItem[]", () => {
    const json = JSON.stringify([
      { text: "Find the artifact", checked: false },
      { text: "Return it", checked: true },
    ]);
    expect(parseObjectives(json)).toEqual([
      { text: "Find the artifact", checked: false },
      { text: "Return it", checked: true },
    ]);
  });
  it("filters invalid items, keeps valid ones", () => {
    const json = JSON.stringify([
      { text: "valid", checked: false },
      { text: 123, checked: false },
      null,
    ]);
    expect(parseObjectives(json)).toEqual([{ text: "valid", checked: false }]);
  });
});

// ── validateObjectives ────────────────────────────────────────────────────────

describe("validateObjectives", () => {
  it("null → ok (optional)", () => expect(validateObjectives(null).valid).toBe(true));
  it("undefined → ok (optional)", () => expect(validateObjectives(undefined).valid).toBe(true));
  it("empty array → ok (edge 5.4 — zero objectives allowed)", () => {
    expect(validateObjectives([]).valid).toBe(true);
  });
  it("valid items → ok", () => {
    expect(validateObjectives([{ text: "Find the Sunken Temple", checked: false }]).valid).toBe(true);
  });
  it("item with empty text → fail (edge 5.18)", () => {
    expect(validateObjectives([{ text: "  ", checked: false }]).valid).toBe(false);
  });
  it("item with non-boolean checked → fail (edge 5.18)", () => {
    expect(validateObjectives([{ text: "x", checked: "true" }]).valid).toBe(false);
  });
  it("non-array → fail (edge 5.18)", () => {
    expect(validateObjectives("[]").valid).toBe(false);
    expect(validateObjectives({}).valid).toBe(false);
  });
});

// ── serializeObjectives ───────────────────────────────────────────────────────

describe("serializeObjectives", () => {
  it("undefined → '[]'", () => expect(serializeObjectives(undefined)).toBe("[]"));
  it("empty array → '[]'", () => expect(serializeObjectives([])).toBe("[]"));
  it("items → JSON string (round-trip safe)", () => {
    const items = [{ text: "Kill the dragon", checked: true }];
    const result = serializeObjectives(items);
    expect(JSON.parse(result)).toEqual(items);
  });
});

// ── validateQuestStatus ───────────────────────────────────────────────────────

describe("validateQuestStatus", () => {
  it("null → ok (defaults to active)", () => expect(validateQuestStatus(null).valid).toBe(true));
  it.each(["active", "completed", "failed", "abandoned"] as const)(
    '"%s" → ok',
    (s) => expect(validateQuestStatus(s).valid).toBe(true),
  );
  it("unknown value → fail", () => {
    const r = validateQuestStatus("pending");
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.error).toBe("invalid_status");
  });
  it("isQuestStatus type guard", () => {
    expect(isQuestStatus("active")).toBe(true);
    expect(isQuestStatus("invalid")).toBe(false);
    expect(isQuestStatus(null)).toBe(false);
  });
});

// ── validateSession ──────────────────────────────────────────────────────────

describe("validateSession", () => {
  it("date required on create", () => {
    expect(validateSession({ isCreate: true }).valid).toBe(false);
  });
  it("future date → ok (edge 5.1 — pre-logging allowed)", () => {
    expect(validateSession({ date: "2099-01-01", isCreate: true }).valid).toBe(true);
  });
  it("invalid date string → fail", () => {
    expect(validateSession({ date: "not-a-date", isCreate: true }).valid).toBe(false);
  });
  it("xpAwarded = 0 → ok (edge 5.2)", () => {
    expect(validateSession({ date: "2026-06-01", xpAwarded: 0, isCreate: true }).valid).toBe(true);
  });
  it("negative xp → fail (edge 5.19)", () => {
    expect(validateSession({ date: "2026-06-01", xpAwarded: -10, isCreate: true }).valid).toBe(false);
  });
  it("title empty/null → ok (edge 5.3 — optional)", () => {
    expect(validateSession({ date: "2026-06-01", title: null, isCreate: true }).valid).toBe(true);
    expect(validateSession({ date: "2026-06-01", title: "", isCreate: true }).valid).toBe(true);
  });
  it("title over cap → fail", () => {
    expect(
      validateSession({ date: "2026-06-01", title: "x".repeat(LIMITS.sessionTitle + 1), isCreate: true }).valid,
    ).toBe(false);
  });
  it("patch without date → ok (date optional on update)", () => {
    expect(validateSession({ xpAwarded: 100 }).valid).toBe(true);
  });
});

// ── validateQuest ─────────────────────────────────────────────────────────────

describe("validateQuest", () => {
  it("name required on create; empty string → fail (edge 5.11)", () => {
    expect(validateQuest({ name: "", isCreate: true }).valid).toBe(false);
    expect(validateQuest({ name: "  ", isCreate: true }).valid).toBe(false);
  });
  it("valid name → ok", () => {
    expect(validateQuest({ name: "Find the Sunken Temple", isCreate: true }).valid).toBe(true);
  });
  it("name over cap → fail", () => {
    expect(
      validateQuest({ name: "x".repeat(LIMITS.questName + 1), isCreate: true }).valid,
    ).toBe(false);
  });
  it("giverName over cap → fail", () => {
    expect(
      validateQuest({ name: "Q", giverName: "x".repeat(LIMITS.giverName + 1), isCreate: true }).valid,
    ).toBe(false);
  });
  it("invalid status → fail", () => {
    expect(validateQuest({ name: "Q", status: "pending", isCreate: true }).valid).toBe(false);
  });
  it("zero objectives → ok (edge 5.4)", () => {
    expect(validateQuest({ name: "Q", objectives: [], isCreate: true }).valid).toBe(true);
  });
  it("malformed objectives → fail (edge 5.18)", () => {
    expect(
      validateQuest({ name: "Q", objectives: [{ text: "", checked: false }], isCreate: true }).valid,
    ).toBe(false);
  });
});

// ── validateNpc ───────────────────────────────────────────────────────────────

describe("validateNpc", () => {
  it("name required on create; empty → fail (edge 5.12)", () => {
    expect(validateNpc({ name: "", isCreate: true }).valid).toBe(false);
    expect(validateNpc({ name: "  ", isCreate: true }).valid).toBe(false);
  });
  it("valid name → ok", () => {
    expect(validateNpc({ name: "Elder Maren", isCreate: true }).valid).toBe(true);
  });
  it("role over cap → fail", () => {
    expect(validateNpc({ name: "X", role: "x".repeat(LIMITS.npcRole + 1), isCreate: true }).valid).toBe(false);
  });
  it("faction over cap → fail", () => {
    expect(
      validateNpc({ name: "X", faction: "x".repeat(LIMITS.npcFaction + 1), isCreate: true }).valid,
    ).toBe(false);
  });
  it("isAlive non-boolean → fail", () => {
    expect(validateNpc({ name: "X", isAlive: "yes", isCreate: true }).valid).toBe(false);
  });
  it("isAlive null → ok (treated as absent / optional)", () => {
    expect(validateNpc({ name: "X", isAlive: null, isCreate: true }).valid).toBe(true);
  });
});

// ── validateJournalEntry ──────────────────────────────────────────────────────

describe("validateJournalEntry", () => {
  it("content required on create; empty → fail (edge 5.13)", () => {
    expect(validateJournalEntry({ content: "", isCreate: true }).valid).toBe(false);
    expect(validateJournalEntry({ content: "  ", isCreate: true }).valid).toBe(false);
  });
  it("missing content on create → fail", () => {
    expect(validateJournalEntry({ isCreate: true }).valid).toBe(false);
  });
  it("valid content → ok", () => {
    expect(validateJournalEntry({ content: "Today we fought the dragon.", isCreate: true }).valid).toBe(true);
  });
  it("title over cap → fail", () => {
    expect(
      validateJournalEntry({ content: "x", title: "x".repeat(LIMITS.journalTitle + 1), isCreate: true }).valid,
    ).toBe(false);
  });
  it("title null → ok (optional)", () => {
    expect(validateJournalEntry({ content: "x", title: null, isCreate: true }).valid).toBe(true);
  });
  it("patch without content → ok (optional on update)", () => {
    expect(validateJournalEntry({ title: "Updated Title" }).valid).toBe(true);
  });
});

// ── summaryExcerpt ────────────────────────────────────────────────────────────

describe("summaryExcerpt", () => {
  it("null → null", () => expect(summaryExcerpt(null)).toBeNull());
  it("empty string → null", () => expect(summaryExcerpt("")).toBeNull());
  it("whitespace-only → null", () => expect(summaryExcerpt("   ")).toBeNull());
  it("short text ≤ 120 → returned as-is (trimmed)", () => {
    expect(summaryExcerpt("  The party arrived.  ")).toBe("The party arrived.");
  });
  it("text longer than 120 chars → truncated to 120", () => {
    const long = "x".repeat(130);
    const result = summaryExcerpt(long);
    expect(result).toHaveLength(120);
  });
  it("custom len respected", () => {
    const result = summaryExcerpt("hello world", 5);
    expect(result).toBe("hello");
  });
});

// ── statusSortWeight ──────────────────────────────────────────────────────────

describe("statusSortWeight", () => {
  it.each([
    ["active", 0],
    ["completed", 1],
    ["failed", 2],
    ["abandoned", 3],
  ] as const)('"%s" → %i', (s, w) => {
    expect(statusSortWeight(s)).toBe(w);
  });
  it("active sorts before completed in array sort", () => {
    const weights = (["completed", "active", "failed"] as const).map(statusSortWeight);
    const sorted = [...weights].sort((a, b) => a - b);
    // active (0) < completed (1) < failed (2)
    expect(sorted).toEqual([0, 1, 2]);
  });
});
