// File: tests/player-ui-search.test.ts
// Unit tests for the pure search-result grouper (lib/player-ui/search.ts) — Sprint 6 QA gap-close.
// No DB — verifies the hint formatting + grouping for each of the 7 result kinds.

import { describe, it, expect } from "vitest";
import { groupSearchResults } from "@/lib/player-ui/search";
import type { SearchRaw } from "@/lib/player-ui/types";

const empty: SearchRaw = {
  spells: [],
  items: [],
  monsters: [],
  characters: [],
  quests: [],
  npcs: [],
  journalEntries: [],
};

describe("groupSearchResults", () => {
  it("returns seven empty groups for empty input", () => {
    const r = groupSearchResults(empty);
    expect(r).toEqual({
      spells: [],
      items: [],
      monsters: [],
      characters: [],
      quests: [],
      npcs: [],
      journalEntries: [],
    });
  });

  it("formats a cantrip hint as 'Cantrip · school' (level 0)", () => {
    const r = groupSearchResults({
      ...empty,
      spells: [{ id: "s1", slug: "light", name: "Light", level: 0, school: "Evocation" }],
    });
    expect(r.spells[0]).toEqual({
      id: "s1",
      slug: "light",
      name: "Light",
      hint: "Cantrip · Evocation",
      type: "spell",
    });
  });

  it("formats a leveled spell hint as 'Level N · school'", () => {
    const r = groupSearchResults({
      ...empty,
      spells: [{ id: "s2", slug: "fireball", name: "Fireball", level: 3, school: "Evocation" }],
    });
    expect(r.spells[0].hint).toBe("Level 3 · Evocation");
  });

  it("uses item type as the hint", () => {
    const r = groupSearchResults({
      ...empty,
      items: [{ id: "i1", slug: "longsword", name: "Longsword", type: "weapon" }],
    });
    expect(r.items[0]).toMatchObject({ hint: "weapon", type: "item" });
  });

  it("formats monster hint as 'CR x' (display fraction preserved)", () => {
    const r = groupSearchResults({
      ...empty,
      monsters: [{ id: "m1", slug: "goblin", name: "Goblin", cr: "1/4" }],
    });
    expect(r.monsters[0].hint).toBe("CR 1/4");
  });

  it("formats character hint as 'class · Lv N'", () => {
    const r = groupSearchResults({
      ...empty,
      characters: [{ id: "c1", name: "Aria", classSlug: "wizard", level: 5 }],
    });
    expect(r.characters[0]).toMatchObject({ hint: "wizard · Lv 5", type: "character" });
  });

  it("quest hint prefers giver, falls back to status", () => {
    const r = groupSearchResults({
      ...empty,
      quests: [
        { id: "q1", name: "Rescue", giverName: "Elder Maren", status: "active" },
        { id: "q2", name: "Lost", giverName: null, status: "failed" },
      ],
    });
    expect(r.quests[0].hint).toBe("from Elder Maren");
    expect(r.quests[1].hint).toBe("failed");
  });

  it("npc hint prefers faction, falls back to 'NPC'", () => {
    const r = groupSearchResults({
      ...empty,
      npcs: [
        { id: "n1", name: "Voss", faction: "Cult of the Dragon" },
        { id: "n2", name: "Stranger", faction: null },
      ],
    });
    expect(r.npcs[0].hint).toBe("Cult of the Dragon");
    expect(r.npcs[1].hint).toBe("NPC");
  });

  it("journal: title falls back to 'Untitled entry'; hint is a 60-char one-line excerpt", () => {
    const long = "First line\nSecond line that keeps going ".repeat(5);
    const r = groupSearchResults({
      ...empty,
      journalEntries: [
        { id: "j1", title: null, content: long },
        { id: "j2", title: "Session One", content: "We met the king." },
      ],
    });
    expect(r.journalEntries[0].name).toBe("Untitled entry");
    expect(r.journalEntries[0].hint.length).toBeLessThanOrEqual(60);
    expect(r.journalEntries[0].hint).not.toContain("\n"); // newlines flattened
    expect(r.journalEntries[1].name).toBe("Session One");
  });
});
