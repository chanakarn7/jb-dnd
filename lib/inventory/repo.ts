// File: lib/inventory/repo.ts
// Tenant-scoped persistence for CharacterItem + Character.currencyJson.
// Every query includes campaignId (ARCHITECTURE multi-tenancy). No business logic here.
import { prisma } from "@/lib/db";

export function listItems(campaignId: string, characterId: string) {
  return prisma.characterItem.findMany({
    where: { campaignId, characterId },
    orderBy: { itemSlug: "asc" },
  });
}

export function findItem(campaignId: string, characterItemId: string) {
  return prisma.characterItem.findFirst({ where: { id: characterItemId, campaignId } });
}

// @@unique([characterId, itemSlug]): if slug already exists → increment quantity (edge 5.13).
export function upsertItem(campaignId: string, characterId: string, itemSlug: string, quantity: number) {
  return prisma.characterItem.upsert({
    where: { characterId_itemSlug: { characterId, itemSlug } },
    create: { campaignId, characterId, itemSlug, quantity },
    update: { quantity: { increment: quantity } },
  });
}

export function updateItem(characterItemId: string, data: { equipped?: boolean; attuned?: boolean; quantity?: number }) {
  return prisma.characterItem.update({ where: { id: characterItemId }, data });
}

// deleteMany scopes by id + campaignId for tenant safety (mirrors removeSpell pattern).
export function removeItem(campaignId: string, characterItemId: string) {
  return prisma.characterItem.deleteMany({ where: { id: characterItemId, campaignId } });
}

export async function getCurrencyRaw(campaignId: string, characterId: string): Promise<string> {
  const c = await prisma.character.findFirst({
    where: { id: characterId, campaignId },
    select: { currencyJson: true },
  });
  return c?.currencyJson ?? "{}";
}

export function setCurrency(campaignId: string, characterId: string, currencyJson: string) {
  // update scoped by id (PK) — campaignId ownership verified by caller before this point.
  return prisma.character.update({ where: { id: characterId }, data: { currencyJson } });
}
