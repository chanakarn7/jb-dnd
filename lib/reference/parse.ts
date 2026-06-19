// Safe JSON-column parser — reference rows store nested data as JSON strings
// (SQLite has no native JSON/array). Never throw on a malformed column
// (PRD edge 5.6): return the caller's fallback instead.
export function parseJson<T>(s: string | null | undefined, fallback: T): T {
  if (typeof s !== "string" || s.length === 0) return fallback;
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
}
