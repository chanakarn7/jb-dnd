// File: lib/player-ui/repo.ts
// Prisma queries for Sprint 6 — Player UI + Dice + Dashboard.
// Every query includes campaignId for multi-tenancy. No authz here — that lives in service.ts.
// Source: docs/modules/player-ui/SA_BLUEPRINT.md §5.4

import { prisma } from "@/lib/db";
import type { DiceRollView, DashboardSnapshot, QuickViewSnapshot, SearchResults, ActiveQuestSummary, RosterEntry } from "./types";
import { groupSearchResults } from "./search";
import { abilityMod } from "@/lib/characters/rules";

// ── DiceRoll ─────────────────────────────────────────────────────────────────

interface SaveDiceRollInput {
  campaignId: string;
  playerSessionId: string;
  formula: string;
  result: number;
  rolls: number[];
  context: string | null;
  mode: string;
  keptRoll: number | null;
}

export async function saveDiceRoll(data: SaveDiceRollInput): Promise<DiceRollView> {
  const row = await prisma.diceRoll.create({
    data: {
      campaignId: data.campaignId,
      playerSessionId: data.playerSessionId,
      formula: data.formula.slice(0, 100),
      result: data.result,
      rolls: JSON.stringify(data.rolls),
      context: data.context ? data.context.slice(0, 80) : null,
      mode: data.mode,
      keptRoll: data.keptRoll,
    },
    include: { playerSession: { select: { displayName: true } } },
  });
  return toDiceRollView(row);
}

export async function getRecentRolls(campaignId: string, limit = 20): Promise<DiceRollView[]> {
  const rows = await prisma.diceRoll.findMany({
    where: { campaignId },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { playerSession: { select: { displayName: true } } },
  });
  return rows.map(toDiceRollView);
}

function toDiceRollView(
  row: {
    id: string; campaignId: string; playerSessionId: string; formula: string; result: number;
    rolls: string; context: string | null; mode: string; keptRoll: number | null;
    createdAt: Date; playerSession: { displayName: string };
  },
): DiceRollView {
  return {
    id: row.id,
    campaignId: row.campaignId,
    playerSessionId: row.playerSessionId,
    playerName: row.playerSession.displayName,
    formula: row.formula,
    result: row.result,
    rolls: JSON.parse(row.rolls) as number[],
    context: row.context,
    mode: row.mode as DiceRollView["mode"],
    keptRoll: row.keptRoll,
    createdAt: row.createdAt.toISOString(),
  };
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export async function getDashboardData(campaignId: string): Promise<DashboardSnapshot> {
  const [
    playerCount,
    activeQuestCount,
    sessionCount,
    xpAggregate,
    activeQuestsRaw,
    playerSessions,
    lastSession,
    activeEncounter,
  ] = await Promise.all([
    prisma.playerSession.count({ where: { campaignId } }),
    prisma.quest.count({ where: { campaignId, status: "active" } }),
    prisma.session.count({ where: { campaignId } }),
    prisma.session.aggregate({ where: { campaignId }, _sum: { xpAwarded: true } }),
    prisma.quest.findMany({ where: { campaignId, status: "active" }, take: 10, orderBy: { createdAt: "asc" } }),
    prisma.playerSession.findMany({
      where: { campaignId },
      include: { character: { select: { id: true, name: true, classSlug: true, level: true, currentHp: true, maxHp: true } } },
    }),
    prisma.session.findFirst({ where: { campaignId }, orderBy: { date: "desc" } }),
    prisma.encounter.findFirst({
      where: { campaignId, status: "active" },
      include: { combatants: { where: { removed: false }, select: { characterId: true, conditionsJson: true } } },
    }),
  ]);

  // Build condition map: characterId → condition names
  const conditionMap = new Map<string, string[]>();
  if (activeEncounter) {
    for (const c of activeEncounter.combatants) {
      if (c.characterId) {
        const conds = (JSON.parse(c.conditionsJson) as Array<{ name: string }>) .map((x) => x.name);
        conditionMap.set(c.characterId, conds);
      }
    }
  }

  const activeQuests: ActiveQuestSummary[] = activeQuestsRaw.map((q) => {
    const objectives = JSON.parse(q.objectivesJson) as Array<{ checked: boolean }>;
    return {
      id: q.id,
      name: q.name,
      giverName: q.giverName,
      objectivesTotal: objectives.length,
      objectivesChecked: objectives.filter((o) => o.checked).length,
    };
  });

  const roster: RosterEntry[] = playerSessions
    .filter((ps) => ps.character !== null)
    .map((ps) => {
      const ch = ps.character!;
      return {
        characterId: ch.id,
        characterName: ch.name,
        classSlug: ch.classSlug,
        level: ch.level,
        currentHp: ch.currentHp,
        maxHp: ch.maxHp,
        conditions: conditionMap.get(ch.id) ?? [],
        playerName: ps.displayName,
      };
    });

  return {
    playerCount,
    activeQuestCount,
    sessionCount,
    totalXp: xpAggregate._sum.xpAwarded ?? 0,
    activeQuests,
    roster,
    lastSession: lastSession
      ? {
          id: lastSession.id,
          title: lastSession.title,
          date: lastSession.date.toISOString(),
          xpAwarded: lastSession.xpAwarded,
          summary: lastSession.summary,
        }
      : null,
  };
}

// ── Quick View ────────────────────────────────────────────────────────────────

export async function getQuickViewData(
  campaignId: string,
  characterId: string,
): Promise<QuickViewSnapshot | null> {
  const [character, activeEncounter] = await Promise.all([
    prisma.character.findFirst({
      where: { id: characterId, campaignId },
      select: {
        id: true, name: true, classSlug: true, level: true,
        currentHp: true, maxHp: true, ac: true,
        str: true, dex: true, con: true, int: true, wis: true, cha: true,
        proficiencyBonus: true, skillsJson: true,
        spellSlotsJson: true, spellSlotsUsedJson: true,
      },
    }),
    prisma.encounter.findFirst({
      where: { campaignId, status: "active" },
      include: { combatants: { where: { characterId, removed: false }, select: { conditionsJson: true } } },
    }),
  ]);

  if (!character) return null;

  const skills = JSON.parse(character.skillsJson) as Record<string, boolean>;
  const perceptionProf = skills["perception"] === true;
  const wisMod = abilityMod(character.wis);
  const passivePerception = 10 + wisMod + (perceptionProf ? character.proficiencyBonus : 0);

  const totalSlots = JSON.parse(character.spellSlotsJson) as Record<string, number>;
  const usedSlots = JSON.parse(character.spellSlotsUsedJson) as Record<string, number>;
  const spellSlots: Record<string, { total: number; used: number }> = {};
  for (const [lvl, total] of Object.entries(totalSlots)) {
    if (total > 0) {
      spellSlots[lvl] = { total, used: usedSlots[lvl] ?? 0 };
    }
  }

  const activeCombatant = activeEncounter?.combatants[0] ?? null;
  const conditions = activeCombatant
    ? (JSON.parse(activeCombatant.conditionsJson) as Array<{ name: string }>).map((c) => c.name)
    : [];

  return {
    characterId: character.id,
    name: character.name,
    classSlug: character.classSlug,
    level: character.level,
    currentHp: character.currentHp,
    maxHp: character.maxHp,
    ac: character.ac,
    passivePerception,
    str: character.str,
    dex: character.dex,
    con: character.con,
    int: character.int,
    wis: character.wis,
    cha: character.cha,
    spellSlots,
    conditions,
  };
}

// ── Character HP + Spell Slots ────────────────────────────────────────────────

export async function updateCharacterHp(
  campaignId: string,
  characterId: string,
  hpCurrent: number,
): Promise<{ currentHp: number }> {
  const character = await prisma.character.findFirst({
    where: { id: characterId, campaignId },
    select: { maxHp: true },
  });
  if (!character) throw new Error("not_found");
  const clamped = Math.max(0, Math.min(hpCurrent, character.maxHp));
  await prisma.character.update({ where: { id: characterId }, data: { currentHp: clamped } });
  return { currentHp: clamped };
}

export async function updateSpellSlotsUsed(
  campaignId: string,
  characterId: string,
  spellSlotsUsed: Record<string, number>,
): Promise<void> {
  await prisma.character.updateMany({
    where: { id: characterId, campaignId },
    data: { spellSlotsUsedJson: JSON.stringify(spellSlotsUsed) },
  });
}

// ── Global Search ─────────────────────────────────────────────────────────────

export async function searchAll(campaignId: string, q: string): Promise<SearchResults> {
  const [spells, items, monsters, characters, quests, npcs, journalEntries] = await Promise.all([
    prisma.spell.findMany({
      where: { name: { contains: q } },
      select: { id: true, slug: true, name: true, level: true, school: true },
      take: 10,
    }),
    prisma.item.findMany({
      where: { name: { contains: q } },
      select: { id: true, slug: true, name: true, type: true },
      take: 10,
    }),
    prisma.monster.findMany({
      where: { name: { contains: q } },
      select: { id: true, slug: true, name: true, cr: true },
      take: 10,
    }),
    prisma.character.findMany({
      where: { campaignId, name: { contains: q } },
      select: { id: true, name: true, classSlug: true, level: true },
      take: 10,
    }),
    prisma.quest.findMany({
      where: {
        campaignId,
        OR: [
          { name: { contains: q } },
          { giverName: { contains: q } },
          { description: { contains: q } },
        ],
      },
      select: { id: true, name: true, giverName: true, status: true },
      take: 10,
    }),
    prisma.npc.findMany({
      where: {
        campaignId,
        OR: [
          { name: { contains: q } },
          { faction: { contains: q } },
        ],
      },
      select: { id: true, name: true, faction: true },
      take: 10,
    }),
    prisma.journalEntry.findMany({
      where: {
        campaignId,
        OR: [
          { title: { contains: q } },
          { content: { contains: q } },
        ],
      },
      select: { id: true, title: true, content: true },
      take: 10,
    }),
  ]);

  return groupSearchResults({ spells, items, monsters, characters, quests, npcs, journalEntries });
}
