import { randomBytes } from "node:crypto";

// Session tokens are reconnect-identity secrets (there is no password in v1).
// Never broadcast — delivered only to their owner alongside their own snapshot.
export function generateSessionToken(): string {
  return randomBytes(32).toString("base64url");
}
