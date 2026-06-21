// File: lib/player-ui/types.ts
// Shared types for Sprint 6 — Player UI + Dice + Dashboard.
// Source: docs/modules/player-ui/SA_BLUEPRINT.md §5.1

export interface ParsedFormula {
  count: number;   // 1–100
  sides: number;   // 2–1000
  modifier: number; // signed integer offset
}

export interface RollResult {
  total: number;
  rolls: number[];
  kept?: number;    // advantage/disadvantage: which d20 was kept
  dropped?: number; // advantage/disadvantage: the discarded d20
}

export interface DiceRollView {
  id: string;
  campaignId: string;
  playerSessionId: string;
  playerName: string;
  formula: string;
  result: number;
  rolls: number[];
  context: string | null;
  mode: "normal" | "advantage" | "disadvantage";
  keptRoll: number | null;
  createdAt: string;
}

export interface SearchResultItem {
  id: string;
  name: string;
  hint: string;
  type: "spell" | "item" | "monster" | "character" | "quest" | "npc" | "journal";
  slug?: string; // for 5e reference navigation
}

export interface SearchResults {
  spells: SearchResultItem[];
  items: SearchResultItem[];
  monsters: SearchResultItem[];
  characters: SearchResultItem[];
  quests: SearchResultItem[];
  npcs: SearchResultItem[];
  journalEntries: SearchResultItem[];
}

export interface RosterEntry {
  characterId: string;
  characterName: string;
  classSlug: string;
  level: number;
  currentHp: number;
  maxHp: number;
  conditions: string[];
  playerName: string | null;
}

export interface ActiveQuestSummary {
  id: string;
  name: string;
  giverName: string | null;
  objectivesTotal: number;
  objectivesChecked: number;
}

export interface LastSessionSummary {
  id: string;
  title: string | null;
  date: string;
  xpAwarded: number;
  summary: string | null;
}

export interface DashboardSnapshot {
  playerCount: number;
  activeQuestCount: number;
  sessionCount: number;
  totalXp: number;
  activeQuests: ActiveQuestSummary[];
  roster: RosterEntry[];
  lastSession: LastSessionSummary | null;
}

export interface SpellSlotLevel {
  total: number;
  used: number;
}

export interface QuickViewSnapshot {
  characterId: string;
  name: string;
  classSlug: string;
  level: number;
  currentHp: number;
  maxHp: number;
  ac: number;
  passivePerception: number;
  str: number; dex: number; con: number; int: number; wis: number; cha: number;
  spellSlots: Record<string, SpellSlotLevel>; // "1"–"9", only present levels
  conditions: string[];
}

// Raw search inputs from Prisma (internal to repo/search)
export interface SearchRaw {
  spells: Array<{ id: string; slug: string; name: string; level: number; school: string }>;
  items: Array<{ id: string; slug: string; name: string; type: string }>;
  monsters: Array<{ id: string; slug: string; name: string; cr: string }>;
  characters: Array<{ id: string; name: string; classSlug: string; level: number }>;
  quests: Array<{ id: string; name: string; giverName: string | null; status: string }>;
  npcs: Array<{ id: string; name: string; faction: string | null }>;
  journalEntries: Array<{ id: string; title: string | null; content: string }>;
}
