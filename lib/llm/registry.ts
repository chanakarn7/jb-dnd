import type { LLMProvider } from "./provider";

// Provider registry. DEFAULT: none — no adapter ships in Sprint 0.
// The app must run fully with no provider configured (graceful degrade):
// anything AI-dependent checks isLLMEnabled() and is simply absent when false.
// Sprint 7 calls setLLMProvider(new OllamaProvider()) — no call-site changes needed.

let active: LLMProvider | null = null;

export function getLLMProvider(): LLMProvider | null {
  return active;
}

export function setLLMProvider(provider: LLMProvider | null): void {
  active = provider;
}

export async function isLLMEnabled(): Promise<boolean> {
  return !!active && (await active.isAvailable());
}
