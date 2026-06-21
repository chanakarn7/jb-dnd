// File: lib/player-ui/dice.ts
// Pure dice-engine functions — no DB, no IO, no LLM. Fully deterministic/testable.
// Formula regex: /^(\d+)?[dD](\d+)([+-]\d+)?$/ — e.g. "d20", "2d6+3", "4d8-2"
// Source: docs/modules/player-ui/SA_BLUEPRINT.md §5.3

import type { ParsedFormula, RollResult } from "./types";

const FORMULA_RE = /^(\d+)?[dD](\d+)([+-]\d+)?$/;

export function parseFormula(formula: string): ParsedFormula | null {
  if (!formula || formula.length > 100) return null;
  const m = FORMULA_RE.exec(formula.trim());
  if (!m) return null;
  const count = m[1] ? parseInt(m[1], 10) : 1;
  const sides = parseInt(m[2], 10);
  const modifier = m[3] ? parseInt(m[3], 10) : 0;
  if (count < 1 || count > 100) return null;
  if (sides < 2 || sides > 1000) return null;
  return { count, sides, modifier };
}

function rollDie(sides: number): number {
  return Math.floor(Math.random() * sides) + 1;
}

export function rollFormula(parsed: ParsedFormula): RollResult {
  const rolls: number[] = [];
  for (let i = 0; i < parsed.count; i++) {
    rolls.push(rollDie(parsed.sides));
  }
  const sum = rolls.reduce((a, b) => a + b, 0);
  return { total: sum + parsed.modifier, rolls };
}

export function rollAdvantage(modifier: number): RollResult {
  const r1 = rollDie(20);
  const r2 = rollDie(20);
  const kept = Math.max(r1, r2);
  const dropped = Math.min(r1, r2);
  return { total: kept + modifier, rolls: [r1, r2], kept, dropped };
}

export function rollDisadvantage(modifier: number): RollResult {
  const r1 = rollDie(20);
  const r2 = rollDie(20);
  const kept = Math.min(r1, r2);
  const dropped = Math.max(r1, r2);
  return { total: kept + modifier, rolls: [r1, r2], kept, dropped };
}

// ── Client-supplied faces ──────────────────────────────────────────────────────
// The 3D dice (BabylonJS physics) are the RNG: the client sends the faces the dice
// landed on, and the server VALIDATES them and recomputes the total/kept itself.
// Faces are trusted (you can see them roll); the math is not (total can't be forged).
// Returns null if the faces don't match the formula/mode (count, range), so the
// caller can reject the roll. Pure + deterministic — no Math.random.

export function rollFromFaces(
  parsed: ParsedFormula,
  mode: "normal" | "advantage" | "disadvantage",
  faces: number[],
): RollResult | null {
  if (!Array.isArray(faces) || faces.some((f) => !Number.isInteger(f))) return null;

  if (mode === "advantage" || mode === "disadvantage") {
    if (faces.length !== 2) return null;
    if (faces.some((f) => f < 1 || f > 20)) return null;
    const [r1, r2] = faces;
    const kept = mode === "advantage" ? Math.max(r1, r2) : Math.min(r1, r2);
    const dropped = mode === "advantage" ? Math.min(r1, r2) : Math.max(r1, r2);
    return { total: kept + parsed.modifier, rolls: [r1, r2], kept, dropped };
  }

  if (faces.length !== parsed.count) return null;
  if (faces.some((f) => f < 1 || f > parsed.sides)) return null;
  const sum = faces.reduce((a, b) => a + b, 0);
  return { total: sum + parsed.modifier, rolls: faces };
}
