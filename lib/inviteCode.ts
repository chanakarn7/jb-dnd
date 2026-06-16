import { randomInt } from "node:crypto";

// Unambiguous alphabet — no 0/O, 1/I/L — so codes are easy to read aloud across a table.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 6;

/** Generate a raw (no-dash) invite code, e.g. "K7QM2P". Uniqueness is enforced by the caller (DB @unique + retry). */
export function generateInviteCode(): string {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += ALPHABET[randomInt(ALPHABET.length)];
  }
  return code;
}

/** Display form with a dash for readability: "K7QM2P" -> "K7Q-M2P". */
export function formatInviteCode(code: string): string {
  const c = code.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return c.length > 3 ? `${c.slice(0, 3)}-${c.slice(3)}` : c;
}

/** Normalize user input back to storage form (strip dash, uppercase). */
export function normalizeInviteCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, "");
}
