// File: lib/combat/repo.ts
// Prisma CRUD for the Combat module. All queries are campaign-scoped (multi-tenancy).
// Source: docs/modules/combat/SA_BLUEPRINT.md §5.2

import { prisma } from "@/lib/db";
import type { Encounter, Combatant } from "@prisma/client";

type EncounterWithCombatants = Encounter & { combatants: Combatant[] };

export async function createEncounter(
  campaignId: string,
  name?: string | null,
): Promise<Encounter> {
  return prisma.encounter.create({
    data: { campaignId, name: name ?? null, status: "active" },
  });
}

export async function getActiveEncounter(
  campaignId: string,
): Promise<EncounterWithCombatants | null> {
  return prisma.encounter.findFirst({
    where: { campaignId, status: "active" },
    include: { combatants: { orderBy: { createdAt: "asc" } } },
  });
}

export async function getEncounterById(
  campaignId: string,
  encounterId: string,
): Promise<EncounterWithCombatants | null> {
  return prisma.encounter.findFirst({
    where: { id: encounterId, campaignId },
    include: { combatants: { orderBy: { createdAt: "asc" } } },
  });
}

export async function updateEncounter(
  id: string,
  data: Partial<
    Pick<Encounter, "status" | "round" | "currentTurnIndex" | "allowPlayerHpEdit" | "name">
  >,
): Promise<Encounter> {
  return prisma.encounter.update({ where: { id }, data });
}

export interface CreateCombatantInput {
  encounterId: string;
  campaignId: string;
  type: "character" | "monster";
  characterId?: string | null;
  monsterSlug?: string | null;
  name: string;
  initiative?: number | null;
  maxHp: number;
  currentHp: number;
}

export async function createCombatant(input: CreateCombatantInput): Promise<Combatant> {
  return prisma.combatant.create({
    data: {
      encounterId: input.encounterId,
      campaignId: input.campaignId,
      type: input.type,
      characterId: input.characterId ?? null,
      monsterSlug: input.monsterSlug ?? null,
      name: input.name,
      initiative: input.initiative ?? null,
      maxHp: input.maxHp,
      currentHp: input.currentHp,
    },
  });
}

export async function getCombatant(
  campaignId: string,
  combatantId: string,
): Promise<Combatant | null> {
  return prisma.combatant.findFirst({
    where: { id: combatantId, campaignId },
  });
}

export async function updateCombatant(
  id: string,
  data: Partial<
    Pick<
      Combatant,
      "currentHp" | "conditionsJson" | "initiative" | "initiativeOrder" | "removed" | "name"
    >
  >,
): Promise<Combatant> {
  return prisma.combatant.update({ where: { id }, data });
}

export async function updateManyCombatantOrders(
  updates: Array<{ id: string; initiativeOrder: number }>,
): Promise<void> {
  await prisma.$transaction(
    updates.map((u) =>
      prisma.combatant.update({ where: { id: u.id }, data: { initiativeOrder: u.initiativeOrder } }),
    ),
  );
}
