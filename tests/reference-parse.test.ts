import { describe, it, expect } from "vitest";
import { parseJson } from "@/lib/reference/parse";

describe("parseJson", () => {
  it("parses valid JSON", () => {
    expect(parseJson('["a","b"]', [])).toEqual(["a", "b"]);
    expect(parseJson('{"v":true}', {})).toEqual({ v: true });
  });
  it("returns the fallback on broken/empty JSON instead of throwing", () => {
    expect(parseJson("{not json", [] as string[])).toEqual([]);
    expect(parseJson("", { x: 1 })).toEqual({ x: 1 });
    expect(parseJson(undefined as unknown as string, "fb")).toBe("fb");
  });
});
