import { describe, it, expect } from "vitest";
import {
  ATTUNEMENT_CAP, isAttunable, validateQuantity, validateCurrency,
  normalizeCurrency, countAttuned, canAttuneMore,
} from "@/lib/inventory/rules";

describe("ATTUNEMENT_CAP", () => {
  it("is 3 (5e SRD)", () => expect(ATTUNEMENT_CAP).toBe(3));
});

describe("isAttunable", () => {
  it("true when requiresAttunement=true", () => expect(isAttunable({ requiresAttunement: true })).toBe(true));
  it("false when requiresAttunement=false", () => expect(isAttunable({ requiresAttunement: false })).toBe(false));
});

describe("validateQuantity", () => {
  it("accepts 1", () => expect(validateQuantity(1)).toBe(true));
  it("accepts 99", () => expect(validateQuantity(99)).toBe(true));
  it("rejects 0", () => expect(validateQuantity(0)).toBe(false));   // edge 5.4
  it("rejects -1", () => expect(validateQuantity(-1)).toBe(false));
  it("rejects 0.5 (float)", () => expect(validateQuantity(0.5)).toBe(false));
  it("rejects null", () => expect(validateQuantity(null)).toBe(false));
  it("rejects string '1'", () => expect(validateQuantity("1")).toBe(false));
});

describe("validateCurrency", () => {
  it("accepts all-zero", () => expect(validateCurrency({ pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 })).toBe(true));
  it("accepts positive values", () => expect(validateCurrency({ gp: 100 })).toBe(true));
  it("rejects negative gp (edge 5.7)", () => expect(validateCurrency({ gp: -1 })).toBe(false));
  it("rejects float gp", () => expect(validateCurrency({ gp: 1.5 })).toBe(false));
  it("rejects negative cp", () => expect(validateCurrency({ cp: -5 })).toBe(false));
  it("empty object is valid (all defaults)", () => expect(validateCurrency({})).toBe(true));
});

describe("normalizeCurrency", () => {
  it("fills missing denominations with 0", () => {
    expect(normalizeCurrency({ gp: 50 })).toEqual({ pp: 0, gp: 50, ep: 0, sp: 0, cp: 0 });
  });
  it("preserves all five if all supplied", () => {
    expect(normalizeCurrency({ pp: 1, gp: 2, ep: 3, sp: 4, cp: 5 })).toEqual({ pp: 1, gp: 2, ep: 3, sp: 4, cp: 5 });
  });
  it("empty input → all-zero", () => {
    expect(normalizeCurrency({})).toEqual({ pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 });
  });
});

describe("countAttuned / canAttuneMore", () => {
  const make = (attuned: boolean) => ({ attuned });
  it("counts correctly", () => {
    expect(countAttuned([make(true), make(false), make(true)])).toBe(2);
    expect(countAttuned([])).toBe(0);
  });
  it("canAttuneMore false at cap (5.2)", () => {
    const items = [make(true), make(true), make(true)];
    expect(canAttuneMore(items)).toBe(false);
  });
  it("canAttuneMore true below cap", () => {
    const items = [make(true), make(true)];
    expect(canAttuneMore(items)).toBe(true);
  });
  it("canAttuneMore true with 0 attuned", () => {
    expect(canAttuneMore([])).toBe(true);
  });
  it("boundary: exactly cap-1 items → can still attune", () => {
    const items = Array.from({ length: ATTUNEMENT_CAP - 1 }, () => make(true));
    expect(canAttuneMore(items)).toBe(true);
  });
  it("boundary: exactly cap items → cannot attune (5.2)", () => {
    const items = Array.from({ length: ATTUNEMENT_CAP }, () => make(true));
    expect(canAttuneMore(items)).toBe(false);
  });
});
