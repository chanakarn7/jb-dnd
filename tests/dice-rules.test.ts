// File: tests/dice-rules.test.ts
// Unit tests for the pure dice engine (lib/player-ui/dice.ts).
// Focus: parseFormula + rollFromFaces — the latter is the SERVER-SIDE trust boundary that
// validates client-supplied 3D-dice faces before they're persisted/broadcast.

import { describe, it, expect } from "vitest";
import { parseFormula, rollFromFaces } from "@/lib/player-ui/dice";
import type { ParsedFormula } from "@/lib/player-ui/types";

const P = (count: number, sides: number, modifier = 0): ParsedFormula => ({ count, sides, modifier });

describe("parseFormula", () => {
  it("parses a bare die", () => {
    expect(parseFormula("d20")).toEqual({ count: 1, sides: 20, modifier: 0 });
  });
  it("parses count + modifier", () => {
    expect(parseFormula("2d6+3")).toEqual({ count: 2, sides: 6, modifier: 3 });
    expect(parseFormula("4d8-2")).toEqual({ count: 4, sides: 8, modifier: -2 });
  });
  it("rejects junk and out-of-range", () => {
    expect(parseFormula("abc")).toBeNull();
    expect(parseFormula("7d0")).toBeNull();      // sides < 2
    expect(parseFormula("0d6")).toBeNull();      // count < 1
    expect(parseFormula("101d6")).toBeNull();    // count > 100
  });
});

describe("rollFromFaces — normal mode (client faces are the RNG)", () => {
  it("accepts valid faces and sums with modifier", () => {
    expect(rollFromFaces(P(2, 6, 3), "normal", [4, 5])).toEqual({ total: 12, rolls: [4, 5] });
  });
  it("accepts a single die", () => {
    expect(rollFromFaces(P(1, 20), "normal", [17])).toEqual({ total: 17, rolls: [17] });
  });
  it("rejects wrong number of faces", () => {
    expect(rollFromFaces(P(2, 6), "normal", [4])).toBeNull();
    expect(rollFromFaces(P(2, 6), "normal", [4, 5, 6])).toBeNull();
  });
  it("rejects faces outside [1, sides] (anti-tamper)", () => {
    expect(rollFromFaces(P(1, 6), "normal", [7])).toBeNull();   // > sides
    expect(rollFromFaces(P(1, 6), "normal", [0])).toBeNull();   // < 1
    expect(rollFromFaces(P(1, 20), "normal", [99])).toBeNull(); // crit-forge attempt
  });
  it("rejects non-integer / non-array input", () => {
    expect(rollFromFaces(P(1, 6), "normal", [3.5])).toBeNull();
    // @ts-expect-error — exercising the runtime guard against bad input
    expect(rollFromFaces(P(1, 6), "normal", "5")).toBeNull();
  });
});

describe("rollFromFaces — advantage / disadvantage", () => {
  it("advantage keeps the higher of two d20", () => {
    expect(rollFromFaces(P(1, 20, 2), "advantage", [8, 15])).toEqual({
      total: 17, rolls: [8, 15], kept: 15, dropped: 8,
    });
  });
  it("disadvantage keeps the lower of two d20", () => {
    expect(rollFromFaces(P(1, 20, 2), "disadvantage", [8, 15])).toEqual({
      total: 10, rolls: [8, 15], kept: 8, dropped: 15,
    });
  });
  it("requires exactly two faces in [1,20]", () => {
    expect(rollFromFaces(P(1, 20), "advantage", [15])).toBeNull();
    expect(rollFromFaces(P(1, 20), "advantage", [15, 16, 1])).toBeNull();
    expect(rollFromFaces(P(1, 20), "advantage", [21, 5])).toBeNull();
  });
});
