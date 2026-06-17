import { describe, it, expect, afterEach } from "vitest";
import { getLLMProvider, setLLMProvider, isLLMEnabled } from "@/lib/llm/registry";
import type { LLMProvider } from "@/lib/llm/provider";

// PRD §5.13 / AC 7.8 — the app must run fully with NO LLM provider configured.
afterEach(() => setLLMProvider(null));

describe("TC-LLM — graceful degrade with no provider", () => {
  it("resolves to no provider by default (Sprint 0 ships no adapter)", async () => {
    expect(getLLMProvider()).toBeNull();
    expect(await isLLMEnabled()).toBe(false);
  });

  it("reports enabled only when a registered provider is available", async () => {
    const provider: LLMProvider = {
      id: "fake",
      generate: async () => "x",
      isAvailable: async () => true,
    };
    setLLMProvider(provider);
    expect(await isLLMEnabled()).toBe(true);

    // An unavailable provider (e.g. Ollama not running) still degrades gracefully.
    setLLMProvider({ ...provider, isAvailable: async () => false });
    expect(await isLLMEnabled()).toBe(false);
  });
});
