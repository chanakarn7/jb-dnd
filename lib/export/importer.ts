// lib/export/importer.ts
// Creates a fresh campaign from a CampaignExport snapshot.
// All IDs are regenerated; SRD slugs are trusted as-is (present on every install).
// Returns new campaignId, new invite code, and the DM's session token so the caller
// can persist it to localStorage and redirect without a second join step.

import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { generateSessionToken } from "@/lib/tokens";
import { generateInviteCode } from "@/lib/inviteCode";
import type { CampaignExport, CharacterExport, ImportResult } from "./types";

// NOTE: takes the transaction client `tx` — using the global `prisma` here would
// open a second connection that can't see the still-uncommitted campaign row,
// causing a campaignId foreign-key violation (and, on SQLite, write-lock contention).
async function createCharacter(
  tx: Prisma.TransactionClient,
  campaignId: string,
  ownerSessionId: string | null,
  c: CharacterExport,
): Promise<string> {
  const char = await tx.character.create({
    data: {
      campaignId,
      ownerSessionId,
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
    },
  });
  if (c.spells.length > 0) {
    await tx.characterSpell.createMany({
      data: c.spells.map((s) => ({
        campaignId,
        characterId: char.id,
        spellSlug: s.spellSlug,
        known: s.known,
        prepared: s.prepared,
      })),
    });
  }
  if (c.items.length > 0) {
    await tx.characterItem.createMany({
      data: c.items.map((i) => ({
        campaignId,
        characterId: char.id,
        itemSlug: i.itemSlug,
        quantity: i.quantity,
        equipped: i.equipped,
        attuned: i.attuned,
      })),
    });
  }
  return char.id;
}

export async function importCampaign(data: CampaignExport): Promise<ImportResult> {
  const campaignId = randomUUID();
  const inviteCode = generateInviteCode();
  const dmToken = generateSessionToken();
  const dmSessionId = randomUUID();

  await prisma.$transaction(async (tx) => {
    await tx.campaign.create({
      data: {
        id: campaignId,
        name: data.campaign.name,
        inviteCode,
        dmSessionToken: dmToken,
        status: "active",
      },
    });

    // Create sessions + characters in order, preserving DM-first convention.
    for (const player of data.players) {
      const isDM = player.role === "dm";
      const sessionToken = isDM ? dmToken : generateSessionToken();
      const sessionId = isDM ? dmSessionId : randomUUID();

      await tx.playerSession.create({
        data: {
          id: sessionId,
          campaignId,
          displayName: player.displayName,
          role: player.role,
          sessionToken,
          isConnected: false,
        },
      });

      if (player.character) {
        const charId = await createCharacter(tx, campaignId, sessionId, player.character);
        await tx.playerSession.update({
          where: { id: sessionId },
          data: { characterId: charId },
        });
      }
    }

    // NPC character stat blocks (not linked to any player session).
    for (const npc of data.npcCharacters) {
      await createCharacter(tx, campaignId, null, npc);
    }

    // Story.
    for (const s of data.story.sessions) {
      await tx.session.create({
        data: {
          campaignId,
          title: s.title,
          date: new Date(s.date),
          summary: s.summary,
          xpAwarded: s.xpAwarded,
          notableLoot: s.notableLoot,
        },
      });
    }
    for (const q of data.story.quests) {
      await tx.quest.create({
        data: {
          campaignId,
          name: q.name,
          description: q.description,
          giverName: q.giverName,
          status: q.status,
          objectivesJson: q.objectivesJson,
          reward: q.reward,
        },
      });
    }
    for (const n of data.story.npcs) {
      await tx.npc.create({
        data: {
          campaignId,
          name: n.name,
          role: n.role,
          faction: n.faction,
          notes: n.notes,
          isAlive: n.isAlive,
        },
      });
    }
    for (const j of data.story.journal) {
      await tx.journalEntry.create({
        data: { campaignId, title: j.title, content: j.content },
      });
    }

    // Encounters (combatants are name-only; character FKs not restored to avoid mapping complexity).
    for (const enc of data.encounters) {
      const encounter = await tx.encounter.create({
        data: {
          campaignId,
          name: enc.name,
          status: enc.status,
          round: enc.round,
        },
      });
      for (const cb of enc.combatants) {
        await tx.combatant.create({
          data: {
            encounterId: encounter.id,
            campaignId,
            type: cb.type,
            name: cb.name,
            monsterSlug: cb.monsterSlug,
            initiative: cb.initiative,
            initiativeOrder: cb.initiativeOrder,
            maxHp: cb.maxHp,
            currentHp: cb.currentHp,
            conditionsJson: cb.conditionsJson,
            removed: cb.removed,
          },
        });
      }
    }
  });

  return { campaignId, inviteCode, dmToken, dmSessionId };
}

export function validateExport(raw: unknown): raw is CampaignExport {
  if (!raw || typeof raw !== "object") return false;
  const d = raw as Record<string, unknown>;
  return (
    d["version"] === "1" &&
    typeof d["exportedAt"] === "string" &&
    typeof (d["campaign"] as Record<string, unknown>)?.["name"] === "string" &&
    Array.isArray(d["players"]) &&
    Array.isArray(d["npcCharacters"]) &&
    typeof d["story"] === "object" &&
    Array.isArray(d["encounters"])
  );
}
