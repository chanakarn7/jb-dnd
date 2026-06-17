import { describe, it, expect } from "vitest";
import { generateSessionToken } from "@/lib/tokens";

describe("tokens", () => {
  it("generates non-empty base64url tokens", () => {
    const t = generateSessionToken();
    expect(t.length).toBeGreaterThan(20);
    expect(t).toMatch(/^[A-Za-z0-9_-]+$/); // base64url charset
  });

  it("generates unique tokens", () => {
    const set = new Set(Array.from({ length: 1000 }, () => generateSessionToken()));
    expect(set.size).toBe(1000);
  });
});
