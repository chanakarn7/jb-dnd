// File: lib/characters/charRepo.ts
// CRUD for the campaign-scoped Character table. EVERY query is tenant-scoped by
// campaignId (ARCHITECTURE multi-tenancy: no query crosses campaigns). Mutable, so
// no cache. Returns raw rows; the service layer derives/parses for responses.
import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";

export type CharacterRow = Prisma.CharacterGetPayload<{ include: { spells: true } }>;

export function listByCampaign(campaignId: string) {
  return prisma.character.findMany({ where: { campaignId }, include: { spells: true }, orderBy: { createdAt: "asc" } });
}

export function findInCampaign(campaignId: string, id: string) {
  return prisma.character.findFirst({ where: { id, campaignId }, include: { spells: true } });
}

export function create(data: Prisma.CharacterUncheckedCreateInput) {
  return prisma.character.create({ data, include: { spells: true } });
}

export function update(id: string, data: Prisma.CharacterUncheckedUpdateInput) {
  return prisma.character.update({ where: { id }, data, include: { spells: true } });
}

export function remove(id: string) {
  return prisma.character.delete({ where: { id } });
}

// Claim/unclaim the 1:1 PlayerSession ↔ Character link (kept consistent with
// Character.ownerSessionId in a single transaction by the service).
export function claim(sessionId: string, characterId: string) {
  return prisma.playerSession.update({ where: { id: sessionId }, data: { characterId } });
}

// ── CharacterSpell (known/prepared) ─────────────────────────────────
export function addSpell(campaignId: string, characterId: string, spellSlug: string) {
  return prisma.characterSpell.upsert({
    where: { characterId_spellSlug: { characterId, spellSlug } },
    create: { campaignId, characterId, spellSlug, known: true, prepared: false },
    update: { known: true },
  });
}
export function setPrepared(characterId: string, spellSlug: string, prepared: boolean) {
  return prisma.characterSpell.update({
    where: { characterId_spellSlug: { characterId, spellSlug } },
    data: { prepared },
  });
}
export function removeSpell(characterId: string, spellSlug: string) {
  return prisma.characterSpell.deleteMany({ where: { characterId, spellSlug } });
}
