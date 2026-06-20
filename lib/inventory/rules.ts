// File: lib/inventory/rules.ts
// Pure deterministic rules for the Inventory module — no DB, no LLM.
// All attunement/quantity/currency constraints live here so they can be
// unit-tested against the 5e SRD without mocking anything.
export const ATTUNEMENT_CAP = 3;
export const CURRENCIES = ["pp", "gp", "ep", "sp", "cp"] as const;
export type Currency = Record<(typeof CURRENCIES)[number], number>;

export function isAttunable(item: { requiresAttunement: boolean }): boolean {
  return item.requiresAttunement;
}

export function validateQuantity(q: unknown): q is number {
  return Number.isInteger(q) && (q as number) >= 1;
}

// Every supplied key must be a non-negative integer. Missing keys are OK (filled by normalizeCurrency).
export function validateCurrency(c: Partial<Currency>): boolean {
  return Object.values(c).every((v) => Number.isInteger(v) && (v as number) >= 0);
}

// Fill any missing denominations with 0.
export function normalizeCurrency(c: Partial<Currency>): Currency {
  return { pp: 0, gp: 0, ep: 0, sp: 0, cp: 0, ...c };
}

export function countAttuned(items: { attuned: boolean }[]): number {
  return items.filter((i) => i.attuned).length;
}

export function canAttuneMore(items: { attuned: boolean }[], cap = ATTUNEMENT_CAP): boolean {
  return countAttuned(items) < cap;
}
