// lib/export/exporter.ts
// Reads all campaign-scoped data from DB and serialises to a portable snapshot.
// Excludes: sessionTokens, internal IDs, DiceRolls, AIDrafts.

import { prisma } from "@/lib/db";
import type {
  CampaignExport, PlayerExport, CharacterExport,
  SpellExport, ItemExport, StoryExport, EncounterExport, CombatantExport,
} from "./types";
import { EXPORT_VERSION } from "./types";

function serializeCharacter(
  c: Awaited<ReturnType<typeof prisma.character.findFirstOrThrow>> & {
    spells: { spellSlug: string; known: boolean; prepared: boolean }[];
    items: { itemSlug: string; quantity: number; equipped: boolean; attuned: boolean }[];
  },
): CharacterExport {
  return {
    isNpc: c.isNpc,
    name: c.name,
    raceSlug: c.raceSlug,
    subraceSlug: c.subraceSlug,
    classSlug: c.classSlug,
    subclassSlug: c.subclassSlug,
    backgroundSlug: c.backgroundSlug,
    level: c.level,
    str: c.str, dex: c.dex, con: c.con,
    int: c.int, wis: c.wis, cha: c.cha,
    abilityMethod: c.abilityMethod,
    baseAbilitiesJson: c.baseAbilitiesJson,
    proficiencyBonus: c.proficiencyBonus,
    maxHp: c.maxHp, currentHp: c.currentHp, tempHp: c.tempHp,
    ac: c.ac, speed: c.speed, initiative: c.initiative,
    savesJson: c.savesJson,
    skillsJson: c.skillsJson,
    spellSlotsJson: c.spellSlotsJson,
    spellSlotsUsedJson: c.spellSlotsUsedJson,
    conditionsJson: c.conditionsJson,
    overridesJson: c.overridesJson,
    currencyJson: c.currencyJson,
    notes: c.notes,
    spells: c.spells.map((s): SpellExport => ({ spellSlug: s.spellSlug, known: s.known, prepared: s.prepared })),
    items: c.items.map((i): ItemExport => ({ itemSlug: i.itemSlug, quantity: i.quantity, equipped: i.equipped, attuned: i.attuned })),
  };
}

const charInclude = { spells: true, items: true } as const;

export async function exportCampaign(campaignId: string): Promise<CampaignExport> {
  const [campaign, playerSessions, npcChars, storySessions, quests, npcs, journal, encounters] =
    await Promise.all([
      prisma.campaign.findUniqueOrThrow({ where: { id: campaignId } }),
      prisma.playerSession.findMany({
        where: { campaignId },
        include: { character: { include: charInclude } },
        orderBy: { connectedAt: "asc" },
      }),
      prisma.character.findMany({
        where: { campaignId, isNpc: true },
        include: charInclude,
        orderBy: { createdAt: "asc" },
      }),
      prisma.session.findMany({ where: { campaignId }, orderBy: { date: "asc" } }),
      prisma.quest.findMany({ where: { campaignId }, orderBy: { createdAt: "asc" } }),
      prisma.npc.findMany({ where: { campaignId }, orderBy: { createdAt: "asc" } }),
      prisma.journalEntry.findMany({ where: { campaignId }, orderBy: { createdAt: "asc" } }),
      prisma.encounter.findMany({
        where: { campaignId },
        include: { combatants: { orderBy: { initiativeOrder: "asc" } } },
        orderBy: { createdAt: "asc" },
      }),
    ]);

  const players: PlayerExport[] = playerSessions.map((ps) => ({
    displayName: ps.displayName,
    role: ps.role as "dm" | "player",
    character: ps.character && !ps.character.isNpc ? serializeCharacter(ps.character) : null,
  }));

  const story: StoryExport = {
    sessions: storySessions.map((s) => ({
      title: s.title, date: s.date.toISOString(),
      summary: s.summary, xpAwarded: s.xpAwarded, notableLoot: s.notableLoot,
    })),
    quests: quests.map((q) => ({
      name: q.name, description: q.description, giverName: q.giverName,
      status: q.status, objectivesJson: q.objectivesJson, reward: q.reward,
    })),
    npcs: npcs.map((n) => ({
      name: n.name, role: n.role, faction: n.faction, notes: n.notes, isAlive: n.isAlive,
    })),
    journal: journal.map((j) => ({ title: j.title, content: j.content })),
  };

  const encounterExports: EncounterExport[] = encounters.map((enc) => ({
    name: enc.name,
    status: enc.status,
    round: enc.round,
    combatants: enc.combatants.map((cb): CombatantExport => ({
      type: cb.type,
      name: cb.name,
      monsterSlug: cb.monsterSlug,
      initiative: cb.initiative,
      initiativeOrder: cb.initiativeOrder,
      maxHp: cb.maxHp,
      currentHp: cb.currentHp,
      conditionsJson: cb.conditionsJson,
      removed: cb.removed,
    })),
  }));

  return {
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    campaign: { name: campaign.name },
    players,
    npcCharacters: npcChars.map(serializeCharacter),
    story,
    encounters: encounterExports,
  };
}
