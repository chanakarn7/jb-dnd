import { describe, it, expect } from "vitest";
import {
  abilityMod, profBonusForLevel, avgDie, maxHpFor, clampLevel, clampHp,
  STANDARD_ARRAY, validateStandardArray, pointBuyCost, validatePointBuy, totalPointBuyCost,
  effectiveAbilities, spellSlotsFor, derivedSaves, derivedSkills, featuresFor,
  type Abilities, type FeatureView,
} from "@/lib/characters/rules";

// Auto-fill rules must match the PHB exactly (PRD §3.4 / DoD #3). These assertions
// are the canonical table — if a number here is wrong, the sheet is wrong.

describe("abilityMod", () => {
  it("matches the PHB modifier table", () => {
    expect(abilityMod(10)).toBe(0);
    expect(abilityMod(11)).toBe(0);
    expect(abilityMod(8)).toBe(-1);
    expect(abilityMod(7)).toBe(-2);
    expect(abilityMod(1)).toBe(-5);
    expect(abilityMod(15)).toBe(2);
    expect(abilityMod(20)).toBe(5);
    expect(abilityMod(30)).toBe(10);
  });
});

describe("profBonusForLevel", () => {
  it("steps +2..+6 at the right level breakpoints", () => {
    expect([1, 2, 3, 4].map(profBonusForLevel)).toEqual([2, 2, 2, 2]);
    expect([5, 8].map(profBonusForLevel)).toEqual([3, 3]);
    expect([9, 12].map(profBonusForLevel)).toEqual([4, 4]);
    expect([13, 16].map(profBonusForLevel)).toEqual([5, 5]);
    expect([17, 20].map(profBonusForLevel)).toEqual([6, 6]);
  });
  it("clamps out-of-range levels", () => {
    expect(profBonusForLevel(0)).toBe(2);
    expect(profBonusForLevel(99)).toBe(6);
    expect(clampLevel(0)).toBe(1);
    expect(clampLevel(25)).toBe(20);
  });
});

describe("avgDie + maxHpFor", () => {
  it("avgDie rounds up the 5e way", () => {
    expect([6, 8, 10, 12].map(avgDie)).toEqual([4, 5, 6, 7]);
  });
  it("Fighter d10, CON +2: lvl1 = 12, lvl3 = 28 (matches Thorin)", () => {
    expect(maxHpFor(10, 1, 2)).toBe(12);
    expect(maxHpFor(10, 3, 2)).toBe(28); // 12 + 2*(6+2)
  });
  it("Wizard d6, CON +2: lvl1 = 8", () => {
    expect(maxHpFor(6, 1, 2)).toBe(8);
  });
  it("never drops below 1", () => {
    expect(maxHpFor(6, 1, -10)).toBe(1);
  });
  it("clampHp keeps current within [0, max+temp]", () => {
    expect(clampHp(50, 28)).toBe(28);
    expect(clampHp(-5, 28)).toBe(0);
    expect(clampHp(30, 28, 5)).toBe(30);
  });
});

describe("ability-score generation", () => {
  it("standard array accepts exactly the canonical multiset (any order)", () => {
    expect(validateStandardArray([15, 14, 13, 12, 10, 8])).toBe(true);
    expect(validateStandardArray([8, 10, 12, 13, 14, 15])).toBe(true);
    expect(validateStandardArray([15, 15, 13, 12, 10, 8])).toBe(false);
    expect(validateStandardArray([15, 14, 13, 12, 10])).toBe(false);
    expect(STANDARD_ARRAY).toEqual([15, 14, 13, 12, 10, 8]);
  });
  it("point-buy cost table (PHB)", () => {
    expect([8, 9, 10, 11, 12, 13].map(pointBuyCost)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(pointBuyCost(14)).toBe(7);
    expect(pointBuyCost(15)).toBe(9);
    expect(pointBuyCost(16)).toBe(Infinity);
    expect(pointBuyCost(7)).toBe(Infinity);
  });
  it("validatePointBuy enforces the 27-point budget and 8-15 range", () => {
    expect(totalPointBuyCost([15, 14, 13, 12, 10, 8])).toBe(27);
    expect(validatePointBuy([15, 14, 13, 12, 10, 8])).toBe(true);
    expect(validatePointBuy([15, 15, 15, 8, 8, 8])).toBe(true); // 9*3 = 27
    expect(validatePointBuy([15, 15, 15, 15, 8, 8])).toBe(false); // 36 > 27
    expect(validatePointBuy([16, 8, 8, 8, 8, 8])).toBe(false); // out of range
  });
});

describe("effectiveAbilities", () => {
  it("adds racial (and subrace) bonuses onto the assigned scores", () => {
    const base = { str: 15, dex: 13, con: 14, int: 8, wis: 12, cha: 10 };
    const eff = effectiveAbilities(base, { str: 2, con: 2 }); // Mountain Dwarf
    expect(eff).toEqual({ str: 17, dex: 13, con: 16, int: 8, wis: 12, cha: 10 });
  });
  it("stacks subrace bonus too", () => {
    const eff = effectiveAbilities({ dex: 14 }, { dex: 2 }, { int: 1 }); // Elf + High Elf
    expect(eff.dex).toBe(16);
    expect(eff.int).toBe(1);
  });
});

describe("spellSlotsFor", () => {
  it("returns positive slots only; hides zero/non-caster/malformed", () => {
    expect(spellSlotsFor('{"1":2,"2":0}')).toEqual({ "1": 2 });
    expect(spellSlotsFor("{}")).toEqual({});
    expect(spellSlotsFor(null)).toEqual({});
    expect(spellSlotsFor("{ broken")).toEqual({});
  });
});

describe("derivedSaves / derivedSkills", () => {
  const abilities: Abilities = { str: 16, dex: 13, con: 15, int: 10, wis: 12, cha: 8 };
  it("saves add prof bonus only on proficient abilities (Fighter str/con, PB+2)", () => {
    const s = derivedSaves(["str", "con"], abilities, 2);
    expect(s.str).toEqual({ proficient: true, mod: 5 }); // +3 +2
    expect(s.con).toEqual({ proficient: true, mod: 4 }); // +2 +2
    expect(s.dex).toEqual({ proficient: false, mod: 1 }); // +1
  });
  it("skills use the governing ability + prof bonus when proficient", () => {
    const sk = derivedSkills(["Athletics", "Intimidation"], abilities, 2);
    expect(sk["Athletics"]).toEqual({ proficient: true, mod: 5 }); // STR +3 +2
    expect(sk["Intimidation"]).toEqual({ proficient: true, mod: 1 }); // CHA -1 +2
    expect(sk["Acrobatics"]).toEqual({ proficient: false, mod: 1 }); // DEX +1
    expect(sk["Stealth"].proficient).toBe(false);
  });
});

describe("featuresFor", () => {
  const mk = (name: string, level: number, source: FeatureView["source"]): FeatureView => ({ name, level, source, desc: "" });
  it("includes only features at/below level, ordered by level then source", () => {
    const out = featuresFor({
      classFeatures: [mk("Second Wind", 1, "class"), mk("Action Surge", 2, "class"), mk("Indomitable", 9, "class")],
      subclassFeatures: [mk("Improved Critical", 3, "subclass")],
      raceFeatures: [mk("Darkvision", 1, "race")],
      backgroundFeatures: [mk("Military Rank", 1, "background")],
      level: 3,
    });
    expect(out.map((f) => f.name)).toEqual([
      "Second Wind", "Darkvision", "Military Rank", "Action Surge", "Improved Critical",
    ]);
    expect(out.find((f) => f.name === "Indomitable")).toBeUndefined(); // level 9 > 3
  });
});
