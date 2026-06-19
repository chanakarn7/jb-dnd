import { describe, it, expect } from "vitest";
import { crToXp, formatCr, abilityMod, slugify } from "@/lib/reference/srd";

describe("formatCr", () => {
  it("renders fractional CRs as fractions", () => {
    expect(formatCr(0)).toBe("0");
    expect(formatCr(0.125)).toBe("1/8");
    expect(formatCr(0.25)).toBe("1/4");
    expect(formatCr(0.5)).toBe("1/2");
  });
  it("renders whole CRs as integers", () => {
    expect(formatCr(1)).toBe("1");
    expect(formatCr(17)).toBe("17");
    expect(formatCr(30)).toBe("30");
  });
});

describe("crToXp", () => {
  it("maps the standard SRD CR→XP table", () => {
    expect(crToXp(0)).toBe(10);
    expect(crToXp(0.125)).toBe(25);
    expect(crToXp(0.25)).toBe(50);
    expect(crToXp(0.5)).toBe(100);
    expect(crToXp(1)).toBe(200);
    expect(crToXp(5)).toBe(1800);
    expect(crToXp(17)).toBe(18000);
    expect(crToXp(30)).toBe(155000);
  });
  it("returns 0 for unknown CR rather than throwing", () => {
    expect(crToXp(99)).toBe(0);
  });
});

describe("abilityMod", () => {
  it("formats signed modifiers from ability scores", () => {
    expect(abilityMod(10)).toBe("+0");
    expect(abilityMod(8)).toBe("-1");
    expect(abilityMod(14)).toBe("+2");
    expect(abilityMod(27)).toBe("+8");
    expect(abilityMod(1)).toBe("-5");
  });
});

describe("slugify", () => {
  it("lowercases and dashes", () => {
    expect(slugify("Adult Red Dragon")).toBe("adult-red-dragon");
    expect(slugify("Bag of Holding")).toBe("bag-of-holding");
  });
  it("strips punctuation and collapses separators", () => {
    expect(slugify("Mordenkainen's Sword!")).toBe("mordenkainens-sword");
    expect(slugify("  Spaced  Out  ")).toBe("spaced-out");
  });
});
