import { describe, it, expect } from "vitest";
import {
  generateInviteCode,
  formatInviteCode,
  normalizeInviteCode,
} from "@/lib/inviteCode";

const ALLOWED = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]+$/;
const AMBIGUOUS = /[0O1IL]/;

describe("inviteCode", () => {
  it("generates a 6-char code from the unambiguous alphabet", () => {
    for (let i = 0; i < 200; i++) {
      const code = generateInviteCode();
      expect(code).toHaveLength(6);
      expect(code).toMatch(ALLOWED);
      expect(code).not.toMatch(AMBIGUOUS); // no 0/O/1/I/L — readable aloud
    }
  });

  it("formats with a dash after 3 chars", () => {
    expect(formatInviteCode("K7QM2P")).toBe("K7Q-M2P");
    expect(formatInviteCode("AB")).toBe("AB");
  });

  it("normalizes input back to storage form (strip dash, uppercase)", () => {
    expect(normalizeInviteCode("k7q-m2p")).toBe("K7QM2P");
    expect(normalizeInviteCode(" K7Q M2P ")).toBe("K7QM2P");
  });

  it("round-trips format <-> normalize", () => {
    const raw = generateInviteCode();
    expect(normalizeInviteCode(formatInviteCode(raw))).toBe(raw);
  });
});
