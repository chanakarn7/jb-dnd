// File: lib/inventory/service.ts
// Orchestrates authz + inventory rules + view assembly.
// Reuses canWrite/resolveSession/parseJson from Sprint 1+2 — no duplication.
// Attunement cap is enforced inside a $transaction (edge 5.11: concurrent writes).
import { prisma } from "@/lib/db";
import { parseJson } from "@/lib/reference/parse";
import { findInCampaign } from "@/lib/characters/charRepo";
import { canWrite, type Session } from "@/lib/characters/service";
import * as repo from "./repo";
import {
  ATTUNEMENT_CAP, isAttunable, validateQuantity, validateCurrency, normalizeCurrency, countAttuned,
  type Currency,
} from "./rules";
import type { InventoryView, InventoryItemView, AddItemInput, UpdateItemInput, SetCurrencyInput } from "./types";

// ── View assembly ─────────────────────────────────────────────────────
export async function toInventoryView(campaignId: string, characterId: string): Promise<InventoryView> {
  const rows = await repo.listItems(campaignId, characterId);
  const slugs = [...new Set(rows.map((r) => r.itemSlug))];
  const refMap = slugs.length
    ? new Map(
        (
          await prisma.item.findMany({
            where: { slug: { in: slugs } },
            select: { slug: true, name: true, type: true, rarity: true, requiresAttunement: true, propertiesJson: true },
          })
        ).map((i) => [i.slug, i]),
      )
    : new Map<string, { slug: string; name: string; type: string; rarity: string; requiresAttunement: boolean; propertiesJson: string }>();

  const currencyRaw = await repo.getCurrencyRaw(campaignId, characterId);
  const currency = normalizeCurrency(parseJson<Partial<Currency>>(currencyRaw, {}));

  const items: InventoryItemView[] = rows.map((r) => {
    const ref = refMap.get(r.itemSlug);
    if (!ref) {
      // edge 5.15: slug no longer in SRD — show slug, don't crash
      return {
        id: r.id, itemSlug: r.itemSlug, name: r.itemSlug, type: "unknown", rarity: "unknown",
        requiresAttunement: false, quantity: r.quantity, equipped: r.equipped, attuned: r.attuned,
        missingRef: true,
      };
    }
    const props = parseJson<{ weight?: number; cost?: string }>(ref.propertiesJson, {}); // edge 5.8: malformed → {}
    return {
      id: r.id, itemSlug: r.itemSlug, name: ref.name, type: ref.type, rarity: ref.rarity,
      requiresAttunement: ref.requiresAttunement,
      ...(props.weight !== undefined ? { weight: props.weight } : {}),
      ...(props.cost !== undefined ? { cost: props.cost } : {}),
      quantity: r.quantity, equipped: r.equipped, attuned: r.attuned,
    };
  });

  return { items, attunedCount: countAttuned(items), attunementCap: ATTUNEMENT_CAP, currency };
}

// ── addItem ───────────────────────────────────────────────────────────
export async function addItem(
  session: Session, characterId: string, input: AddItemInput,
): Promise<InventoryView | { error: string }> {
  const character = await findInCampaign(session.campaignId, characterId);
  if (!character) return { error: "not_found" };
  if (!canWrite(character, session)) return { error: "forbidden" };

  const qty = input.quantity ?? 1;
  if (!validateQuantity(qty)) return { error: "invalid_quantity" };

  // edge 5.3: itemSlug must exist in the SRD Item table
  const item = await prisma.item.findUnique({ where: { slug: input.itemSlug }, select: { slug: true } });
  if (!item) return { error: "not_found" };

  // edge 5.13: upsert — if slug already exists, quantity is incremented (@@unique)
  await repo.upsertItem(session.campaignId, characterId, input.itemSlug, qty);
  return toInventoryView(session.campaignId, characterId);
}

// ── setItemFields ─────────────────────────────────────────────────────
export async function setItemFields(
  session: Session, characterId: string, characterItemId: string, patch: UpdateItemInput,
): Promise<InventoryView | { error: string }> {
  const character = await findInCampaign(session.campaignId, characterId);
  if (!character) return { error: "not_found" };
  if (!canWrite(character, session)) return { error: "forbidden" };

  const ci = await repo.findItem(session.campaignId, characterItemId);
  // Scope check: item must belong to this character (multi-tenant + ownership)
  if (!ci || ci.characterId !== characterId) return { error: "not_found" };

  if (patch.quantity !== undefined && !validateQuantity(patch.quantity)) {
    return { error: "invalid_quantity" };
  }

  if (patch.attuned === true && !ci.attuned) {
    // Cap check must happen inside a transaction to handle concurrent requests (edge 5.11).
    try {
      await prisma.$transaction(async (tx) => {
        const ref = await tx.item.findUnique({
          where: { slug: ci.itemSlug },
          select: { requiresAttunement: true },
        });
        // edge 5.1: not attunable
        if (!ref || !isAttunable(ref)) {
          throw Object.assign(new Error("not_attunable"), { code: "not_attunable" });
        }
        // edge 5.2 + 5.11: count live attuned from DB, not from client
        const liveCount = await tx.characterItem.count({
          where: { campaignId: session.campaignId, characterId, attuned: true },
        });
        if (liveCount >= ATTUNEMENT_CAP) {
          throw Object.assign(new Error("attunement_limit"), { code: "attunement_limit" });
        }
        await tx.characterItem.update({
          where: { id: characterItemId },
          data: {
            attuned: true,
            ...(patch.equipped !== undefined ? { equipped: patch.equipped } : {}),
            ...(patch.quantity !== undefined ? { quantity: patch.quantity } : {}),
          },
        });
      });
    } catch (e: unknown) {
      const code = (e as { code?: string }).code;
      if (code) return { error: code };
      throw e;
    }
  } else {
    // edge 5.12: idempotent unattune/unequip; also handles attuned=true when already attuned.
    await repo.updateItem(characterItemId, {
      ...(patch.equipped !== undefined ? { equipped: patch.equipped } : {}),
      ...(patch.attuned !== undefined ? { attuned: patch.attuned } : {}),
      ...(patch.quantity !== undefined ? { quantity: patch.quantity } : {}),
    });
  }

  return toInventoryView(session.campaignId, characterId);
}

// ── removeItem ────────────────────────────────────────────────────────
export async function removeItem(
  session: Session, characterId: string, characterItemId: string,
): Promise<InventoryView | { error: string }> {
  const character = await findInCampaign(session.campaignId, characterId);
  if (!character) return { error: "not_found" };
  if (!canWrite(character, session)) return { error: "forbidden" };

  const ci = await repo.findItem(session.campaignId, characterItemId);
  if (!ci || ci.characterId !== characterId) return { error: "not_found" };

  await repo.removeItem(session.campaignId, characterItemId);
  // edge 5.6: last item removed → returns empty list (not an error)
  return toInventoryView(session.campaignId, characterId);
}

// ── setCurrency ───────────────────────────────────────────────────────
export async function setCurrency(
  session: Session, characterId: string, input: SetCurrencyInput,
): Promise<{ currency: Currency } | { error: string }> {
  const character = await findInCampaign(session.campaignId, characterId);
  if (!character) return { error: "not_found" };
  if (!canWrite(character, session)) return { error: "forbidden" };

  // edge 5.7: any negative or non-integer value → reject (don't clamp — wrong intent)
  if (!validateCurrency(input as Partial<Currency>)) return { error: "invalid_currency" };
  const currency = normalizeCurrency(input as Partial<Currency>);
  await repo.setCurrency(session.campaignId, characterId, JSON.stringify(currency));
  return { currency };
}
