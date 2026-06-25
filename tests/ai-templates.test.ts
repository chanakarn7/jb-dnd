// File: tests/ai-templates.test.ts
// Unit tests for the prompt template builders (lib/ai/templates.ts) — Sprint 7 QA.
// Verifies each builder injects the DM input + requests JSON in the right schema,
// and the CRITICAL guard: the system prompt forbids the model from doing rules math.

import { describe, it, expect } from "vitest";
import {
  SYSTEM_BASE,
  buildNpcPrompt,
  buildLootPrompt,
  buildQuestPrompt,
  buildRecapPrompt,
  buildPrompt,
} from "@/lib/ai/templates";

describe("SYSTEM_BASE (hybrid-rules guard)", () => {
  it("instructs JSON-only output", () => {
    expect(SYSTEM_BASE.toLowerCase()).toContain("json");
  });
  it("forbids the model from computing numbers (ARCHITECTURE determinism rule)", () => {
    expect(SYSTEM_BASE.toLowerCase()).toContain("do not compute");
    // names the things that are deterministic code, not the model's job
    expect(SYSTEM_BASE.toLowerCase()).toMatch(/xp|dice|spell slots/);
  });
});

describe("buildNpcPrompt", () => {
  it("injects the DM prompt and the NPC schema keys", () => {
    const p = buildNpcPrompt("a suspicious tiefling merchant");
    expect(p).toContain("a suspicious tiefling merchant");
    for (const key of ["name", "appearance", "personality", "secret", "role"]) {
      expect(p).toContain(key);
    }
  });
  it("includes the campaign name when given", () => {
    expect(buildNpcPrompt("x", "Curse of Strahd")).toContain("Curse of Strahd");
  });
});

describe("buildLootPrompt", () => {
  it("includes the CR and asks for item names + flavor (no arithmetic)", () => {
    const p = buildLootPrompt("undead crypt haul", 7, []);
    expect(p).toContain("7");
    expect(p).toContain("undead crypt haul");
    expect(p.toLowerCase()).toContain("name");
    expect(p.toLowerCase()).toContain("flavor");
    // it must NOT delegate rarity/xp/quantity to the model
    expect(p.toLowerCase()).toMatch(/do not assign rarity|set by the system/);
  });
  it("surfaces a truncated item pool when provided", () => {
    const pool = Array.from({ length: 50 }, (_, i) => `Item${i}`);
    const p = buildLootPrompt("theme", 5, pool);
    expect(p).toContain("Item0");
    expect(p).not.toContain("Item45"); // pool sliced to 40
  });
});

describe("buildQuestPrompt", () => {
  it("injects the prompt and the quest schema", () => {
    const p = buildQuestPrompt("a sea voyage arc");
    expect(p).toContain("a sea voyage arc");
    for (const key of ["name", "giverHint", "objectives", "rewardHint"]) {
      expect(p).toContain(key);
    }
  });
  it("includes recent events when a last recap is supplied", () => {
    expect(buildQuestPrompt("x", "the party cleared the dungeon")).toContain(
      "the party cleared the dungeon",
    );
  });
});

describe("buildRecapPrompt", () => {
  it("includes the session date, encounters, and asks for a recap field", () => {
    const p = buildRecapPrompt("2026-06-25", ["Goblin Ambush", "Boss Fight"], "tense cliffhanger");
    expect(p).toContain("2026-06-25");
    expect(p).toContain("Goblin Ambush");
    expect(p).toContain("tense cliffhanger");
    expect(p).toContain("recap");
  });
});

describe("buildPrompt (dispatch)", () => {
  it("routes each entity type to its builder", () => {
    expect(buildPrompt("npc", "x")).toBe(buildNpcPrompt("x", undefined));
    expect(buildPrompt("loot", "x", { cr: 5, itemPool: [] })).toBe(buildLootPrompt("x", 5, []));
    expect(buildPrompt("quest", "x")).toBe(buildQuestPrompt("x", undefined));
    expect(buildPrompt("session_recap", "x", { sessionDate: "2026-06-25", encounterNames: [] })).toBe(
      buildRecapPrompt("2026-06-25", [], "x"),
    );
  });
  it("loot dispatch defaults CR to 0 when context missing", () => {
    expect(buildPrompt("loot", "x")).toBe(buildLootPrompt("x", 0, []));
  });
});
