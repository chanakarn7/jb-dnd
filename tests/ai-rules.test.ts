// File: tests/ai-rules.test.ts
// Unit tests for the pure AI rules layer (lib/ai/rules.ts) — Sprint 7 QA.
// NO DB, NO LLM. Covers validation, JSON-extraction safety (edge 5.3),
// and the DETERMINISTIC loot math (rarity/count/xp are code, never the model).

import { describe, it, expect } from "vitest";
import {
  validatePrompt,
  validateImportContent,
  validateEntityType,
  isValidStatus,
  validateCr,
  tryParseJson,
  extractJsonBlock,
  lootTierForCr,
  parseLootDraft,
  PROMPT_MAX,
  IMPORT_MAX,
} from "@/lib/ai/rules";
import { crToXp } from "@/lib/reference/srd";

describe("validatePrompt", () => {
  it("accepts a normal prompt", () => {
    expect(validatePrompt("a grumpy dwarf smith")).toEqual({ valid: true });
  });
  it("rejects empty / whitespace (edge 5.4)", () => {
    expect(validatePrompt("")).toEqual({ valid: false, error: "prompt_required" });
    expect(validatePrompt("   ")).toEqual({ valid: false, error: "prompt_required" });
    expect(validatePrompt(undefined)).toEqual({ valid: false, error: "prompt_required" });
    expect(validatePrompt(123)).toEqual({ valid: false, error: "prompt_required" });
  });
  it("accepts exactly PROMPT_MAX chars (boundary)", () => {
    expect(validatePrompt("a".repeat(PROMPT_MAX))).toEqual({ valid: true });
  });
  it("rejects PROMPT_MAX+1 chars (boundary)", () => {
    expect(validatePrompt("a".repeat(PROMPT_MAX + 1))).toEqual({
      valid: false,
      error: "prompt_too_long",
    });
  });
});

describe("validateImportContent", () => {
  it("accepts pasted content", () => {
    expect(validateImportContent("some pasted text")).toEqual({ valid: true });
  });
  it("rejects empty (edge 5.11)", () => {
    expect(validateImportContent("")).toEqual({ valid: false, error: "content_required" });
    expect(validateImportContent("   ")).toEqual({ valid: false, error: "content_required" });
  });
  it("accepts exactly IMPORT_MAX, rejects +1 (edge 5.12 boundary)", () => {
    expect(validateImportContent("x".repeat(IMPORT_MAX))).toEqual({ valid: true });
    expect(validateImportContent("x".repeat(IMPORT_MAX + 1))).toEqual({
      valid: false,
      error: "content_too_long",
    });
  });
});

describe("validateEntityType", () => {
  it("accepts the four valid types", () => {
    for (const t of ["npc", "loot", "quest", "session_recap"]) {
      expect(validateEntityType(t)).toBe(true);
    }
  });
  it("rejects anything else", () => {
    expect(validateEntityType("monster")).toBe(false);
    expect(validateEntityType("")).toBe(false);
    expect(validateEntityType(null)).toBe(false);
    expect(validateEntityType(42)).toBe(false);
  });
});

describe("isValidStatus", () => {
  it("accepts pending/approved/rejected only", () => {
    expect(isValidStatus("pending")).toBe(true);
    expect(isValidStatus("approved")).toBe(true);
    expect(isValidStatus("rejected")).toBe(true);
    expect(isValidStatus("draft")).toBe(false);
    expect(isValidStatus(undefined)).toBe(false);
  });
});

describe("validateCr", () => {
  it("accepts 0..30 inclusive (boundary)", () => {
    expect(validateCr(0)).toEqual({ valid: true });
    expect(validateCr(30)).toEqual({ valid: true });
    expect(validateCr(0.25)).toEqual({ valid: true });
  });
  it("rejects out-of-range / non-number (edge: invalid_cr)", () => {
    expect(validateCr(-1)).toEqual({ valid: false, error: "invalid_cr" });
    expect(validateCr(31)).toEqual({ valid: false, error: "invalid_cr" });
    expect(validateCr(NaN)).toEqual({ valid: false, error: "invalid_cr" });
    expect(validateCr("5")).toEqual({ valid: false, error: "invalid_cr" });
    expect(validateCr(undefined)).toEqual({ valid: false, error: "invalid_cr" });
  });
});

describe("extractJsonBlock", () => {
  it("returns a bare object untouched", () => {
    expect(extractJsonBlock('{"a":1}')).toBe('{"a":1}');
  });
  it("strips ```json fences + chatty prose around an object", () => {
    const s = 'Sure! Here is your NPC:\n```json\n{"name":"Bob"}\n```\nHope that helps!';
    expect(extractJsonBlock(s)).toBe('{"name":"Bob"}');
  });
  it("handles nested braces and braces inside strings", () => {
    const s = 'prefix {"a":{"b":2},"c":"}not the end{"} suffix';
    expect(extractJsonBlock(s)).toBe('{"a":{"b":2},"c":"}not the end{"}');
  });
  it("extracts an array block", () => {
    expect(extractJsonBlock('noise [1,2,3] tail')).toBe("[1,2,3]");
  });
  it("returns null when there is no JSON", () => {
    expect(extractJsonBlock("just words")).toBeNull();
  });
});

describe("tryParseJson (edge 5.3 — unparseable → null, never throws)", () => {
  it("parses clean JSON", () => {
    expect(tryParseJson('{"name":"X"}')).toEqual({ name: "X" });
  });
  it("parses JSON wrapped in fences/prose", () => {
    expect(tryParseJson('```json\n{"k":1}\n```')).toEqual({ k: 1 });
  });
  it("returns null for null/empty/garbage (no throw)", () => {
    expect(tryParseJson(null)).toBeNull();
    expect(tryParseJson("")).toBeNull();
    expect(tryParseJson("   ")).toBeNull();
    expect(tryParseJson("not json at all")).toBeNull();
    expect(tryParseJson("{ broken: ")).toBeNull();
  });
});

describe("lootTierForCr (deterministic brackets — code, not the model)", () => {
  it("maps CR to rarity tier + count", () => {
    expect(lootTierForCr(0.25)).toEqual({ count: 1, rarity: "common" });
    expect(lootTierForCr(4)).toEqual({ count: 1, rarity: "common" });
    expect(lootTierForCr(5)).toEqual({ count: 2, rarity: "uncommon" });
    expect(lootTierForCr(10)).toEqual({ count: 2, rarity: "uncommon" });
    expect(lootTierForCr(11)).toEqual({ count: 2, rarity: "rare" });
    expect(lootTierForCr(16)).toEqual({ count: 2, rarity: "rare" });
    expect(lootTierForCr(17)).toEqual({ count: 3, rarity: "very rare" });
  });
});

describe("parseLootDraft (US-2 — model supplies names; xp/rarity/count are code)", () => {
  it("computes xp deterministically from crToXp, never the model", () => {
    const raw = '{"items":[{"name":"Flametongue","flavor":"glows"}]}';
    const loot = parseLootDraft(raw, 5);
    expect(loot.xp).toBe(crToXp(5)); // 1800
    expect(loot.cr).toBe(5);
  });
  it("applies the CR tier's rarity + truncates to the tier's count", () => {
    // CR 17 → very rare, count 3. Provide 5 names → only 3 kept, all very rare.
    const raw = JSON.stringify({
      items: ["A", "B", "C", "D", "E"].map((n) => ({ name: n })),
    });
    const loot = parseLootDraft(raw, 17);
    expect(loot.items).toHaveLength(3);
    expect(loot.items.every((i) => i.rarity === "very rare")).toBe(true);
    expect(loot.items.map((i) => i.name)).toEqual(["A", "B", "C"]);
  });
  it("keeps per-item flavor prose when provided", () => {
    const raw = '{"items":[{"name":"Cloak","flavor":"shimmers in moonlight"}]}';
    const loot = parseLootDraft(raw, 5);
    expect(loot.items[0]).toEqual({
      name: "Cloak",
      rarity: "uncommon",
      flavor: "shimmers in moonlight",
    });
  });
  it("accepts a bare string array of names", () => {
    const loot = parseLootDraft('["Wand of X","Ring of Y"]', 8);
    expect(loot.items.map((i) => i.name)).toEqual(["Wand of X", "Ring of Y"]);
  });
  it("falls back to provided names when the model output is unparseable (edge 5.3 safe)", () => {
    const loot = parseLootDraft("the model rambled with no json", 5, ["Potion of Healing"]);
    expect(loot.items).toEqual([{ name: "Potion of Healing", rarity: "uncommon" }]);
    expect(loot.xp).toBe(crToXp(5));
  });
  it("yields an empty item list (but valid xp) when nothing parseable and no fallback", () => {
    const loot = parseLootDraft("garbage", 3);
    expect(loot.items).toEqual([]);
    expect(loot.xp).toBe(crToXp(3));
  });
});
