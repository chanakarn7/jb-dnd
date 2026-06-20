// File: lib/inventory/types.ts
// API response shapes and input types for the Inventory module (Sprint 3).
export type { Currency } from "./rules";
import type { Currency } from "./rules";

export interface InventoryItemView {
  id: string;
  itemSlug: string;
  name: string;
  type: string;
  rarity: string;
  requiresAttunement: boolean;
  weight?: number;
  cost?: string;
  quantity: number;
  equipped: boolean;
  attuned: boolean;
  missingRef?: true; // edge 5.15: item slug no longer in SRD — show slug, don't crash
}

export interface InventoryView {
  items: InventoryItemView[];
  attunedCount: number;
  attunementCap: number;
  currency: Currency;
}

export interface AddItemInput {
  itemSlug: string;
  quantity?: number;
}

export interface UpdateItemInput {
  equipped?: boolean;
  attuned?: boolean;
  quantity?: number;
}

export type SetCurrencyInput = Partial<Currency>;
