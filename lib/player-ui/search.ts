// File: lib/player-ui/search.ts
// Pure function: assembles grouped search results from raw Prisma data.
// No DB access here — called by repo.ts after parallel findMany queries.
// Source: docs/modules/player-ui/SA_BLUEPRINT.md §5.5

import type { SearchRaw, SearchResultItem, SearchResults } from "./types";

export function groupSearchResults(raw: SearchRaw): SearchResults {
  const spells: SearchResultItem[] = raw.spells.map((s) => ({
    id: s.id,
    name: s.name,
    slug: s.slug,
    hint: s.level === 0 ? `Cantrip · ${s.school}` : `Level ${s.level} · ${s.school}`,
    type: "spell",
  }));

  const items: SearchResultItem[] = raw.items.map((i) => ({
    id: i.id,
    name: i.name,
    slug: i.slug,
    hint: i.type,
    type: "item",
  }));

  const monsters: SearchResultItem[] = raw.monsters.map((m) => ({
    id: m.id,
    name: m.name,
    slug: m.slug,
    hint: `CR ${m.cr}`,
    type: "monster",
  }));

  const characters: SearchResultItem[] = raw.characters.map((c) => ({
    id: c.id,
    name: c.name,
    hint: `${c.classSlug} · Lv ${c.level}`,
    type: "character",
  }));

  const quests: SearchResultItem[] = raw.quests.map((q) => ({
    id: q.id,
    name: q.name,
    hint: q.giverName ? `from ${q.giverName}` : q.status,
    type: "quest",
  }));

  const npcs: SearchResultItem[] = raw.npcs.map((n) => ({
    id: n.id,
    name: n.name,
    hint: n.faction ?? "NPC",
    type: "npc",
  }));

  const journalEntries: SearchResultItem[] = raw.journalEntries.map((j) => ({
    id: j.id,
    name: j.title ?? "Untitled entry",
    hint: j.content.slice(0, 60).replace(/\n/g, " "),
    type: "journal",
  }));

  return { spells, items, monsters, characters, quests, npcs, journalEntries };
}
