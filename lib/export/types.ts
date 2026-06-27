// lib/export/types.ts
// Portable campaign snapshot format — version-stamped so future migrations are possible.
// Does NOT include: sessionTokens, internal IDs, DiceRolls, AIDrafts (operational noise).
// SRD reference data (spells/items/monsters) is linked by slug — assumed present on import.

export const EXPORT_VERSION = "1" as const;

export interface CampaignExport {
  version: typeof EXPORT_VERSION;
  exportedAt: string;
  campaign: { name: string };
  players: PlayerExport[];
  npcCharacters: CharacterExport[];
  story: StoryExport;
  encounters: EncounterExport[];
}

export interface PlayerExport {
  displayName: string;
  role: "dm" | "player";
  character: CharacterExport | null;
}

export interface CharacterExport {
  isNpc: boolean;
  name: string;
  raceSlug: string;
  subraceSlug: string | null;
  classSlug: string;
  subclassSlug: string | null;
  backgroundSlug: string | null;
  level: number;
  str: number; dex: number; con: number; int: number; wis: number; cha: number;
  abilityMethod: string;
  baseAbilitiesJson: string;
  proficiencyBonus: number;
  maxHp: number; currentHp: number; tempHp: number;
  ac: number; speed: number; initiative: number;
  savesJson: string;
  skillsJson: string;
  spellSlotsJson: string;
  spellSlotsUsedJson: string;
  conditionsJson: string;
  overridesJson: string;
  currencyJson: string;
  notes: string | null;
  spells: SpellExport[];
  items: ItemExport[];
}

export interface SpellExport {
  spellSlug: string;
  known: boolean;
  prepared: boolean;
}

export interface ItemExport {
  itemSlug: string;
  quantity: number;
  equipped: boolean;
  attuned: boolean;
}

export interface StoryExport {
  sessions: SessionExport[];
  quests: QuestExport[];
  npcs: NpcExport[];
  journal: JournalExport[];
}

export interface SessionExport {
  title: string | null;
  date: string;
  summary: string | null;
  xpAwarded: number;
  notableLoot: string | null;
}

export interface QuestExport {
  name: string;
  description: string | null;
  giverName: string | null;
  status: string;
  objectivesJson: string;
  reward: string | null;
}

export interface NpcExport {
  name: string;
  role: string | null;
  faction: string | null;
  notes: string | null;
  isAlive: boolean;
}

export interface JournalExport {
  title: string | null;
  content: string;
}

export interface EncounterExport {
  name: string | null;
  status: string;
  round: number;
  combatants: CombatantExport[];
}

export interface CombatantExport {
  type: string;
  name: string;
  monsterSlug: string | null;
  initiative: number | null;
  initiativeOrder: number;
  maxHp: number;
  currentHp: number;
  conditionsJson: string;
  removed: boolean;
}

export interface ImportResult {
  campaignId: string;
  inviteCode: string;
  dmToken: string;
  dmSessionId: string;
}
