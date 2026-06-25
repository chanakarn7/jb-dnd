// File: lib/ai/ollama.ts
// OllamaProvider — implements LLMProvider against a local Ollama server.
// Default, free, offline. No API key. Model from OLLAMA_MODEL env (default qwen2.5:14b).
// isAvailable() pings GET /api/tags (2s timeout). generate() POSTs /api/generate.
// LLM calls are ALWAYS server-side (ARCHITECTURE) — never imported into a client bundle.
// Source: docs/modules/ai-dm/SA_BLUEPRINT.md §3.

import type { LLMProvider, LLMOptions } from "@/lib/llm/provider";

export class ProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProviderError";
  }
}

const DEFAULT_HOST = "http://localhost:11434";
const DEFAULT_MODEL = "qwen2.5:14b";
const AVAILABILITY_TIMEOUT_MS = 2000;
const GENERATE_TIMEOUT_MS = 120_000;

function withTimeout(ms: number): { signal: AbortSignal; clear: () => void } {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  return { signal: ctrl.signal, clear: () => clearTimeout(t) };
}

export class OllamaProvider implements LLMProvider {
  readonly id = "ollama";
  private host: string;
  private model: string;

  constructor(opts?: { host?: string; model?: string }) {
    this.host = (opts?.host ?? process.env.OLLAMA_HOST ?? DEFAULT_HOST).replace(/\/+$/, "");
    this.model = opts?.model ?? process.env.OLLAMA_MODEL ?? DEFAULT_MODEL;
  }

  async isAvailable(): Promise<boolean> {
    const { signal, clear } = withTimeout(AVAILABILITY_TIMEOUT_MS);
    try {
      const res = await fetch(`${this.host}/api/tags`, { signal });
      return res.ok;
    } catch {
      return false;
    } finally {
      clear();
    }
  }

  async generate(prompt: string, opts?: LLMOptions): Promise<string> {
    const { signal, clear } = withTimeout(GENERATE_TIMEOUT_MS);
    try {
      const res = await fetch(`${this.host}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal,
        body: JSON.stringify({
          model: this.model,
          prompt,
          stream: false,
          ...(opts?.system ? { system: opts.system } : {}),
          ...(opts?.json ? { format: "json" } : {}),
          options: {
            ...(opts?.maxTokens ? { num_predict: opts.maxTokens } : {}),
          },
        }),
      });
      if (!res.ok) {
        throw new ProviderError(`Ollama returned ${res.status}`);
      }
      const data = (await res.json()) as { response?: string };
      if (typeof data.response !== "string") {
        throw new ProviderError("Ollama returned an unexpected payload");
      }
      return data.response;
    } catch (err) {
      if (err instanceof ProviderError) throw err;
      if (err instanceof Error && err.name === "AbortError") {
        throw new ProviderError("Ollama request timed out");
      }
      throw new ProviderError(
        err instanceof Error ? err.message : "Ollama request failed",
      );
    } finally {
      clear();
    }
  }
}
