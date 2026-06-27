import type { LLMProvider } from "./provider";

// Provider registry. DEFAULT: none — no adapter ships in Sprint 0.
// The app must run fully with no provider configured (graceful degrade):
// anything AI-dependent checks isLLMEnabled() and is simply absent when false.
// Sprint 7 calls setLLMProvider(new OllamaProvider()) — no call-site changes needed.
//
// NOTE: stored on globalThis so that server/index.ts (Node native module) and
// Next.js App Router API routes (Next's own module system) share one instance.
// A plain module-level variable would create two separate registries in the same
// process, leaving API routes always seeing null even after boot sets the provider.
declare const globalThis: { __llmProvider?: LLMProvider | null };

export function getLLMProvider(): LLMProvider | null {
  return globalThis.__llmProvider ?? null;
}

export function setLLMProvider(provider: LLMProvider | null): void {
  globalThis.__llmProvider = provider;
}

export async function isLLMEnabled(): Promise<boolean> {
  const p = getLLMProvider();
  return !!p && (await p.isAvailable());
}
