// File: lib/ai/import.ts
// ImportProvider — implements LLMProvider for the "paste from Claude / ChatGPT" path.
// ALWAYS available (offline) — no network call. generate() returns the pasted text
// as-is; the service then runs the same deterministic JSON-extraction (rules.tryParseJson)
// used for the Ollama path, so a draft pasted as JSON parses; free prose stays rawText.
// Source: docs/modules/ai-dm/SA_BLUEPRINT.md §3.

import type { LLMProvider } from "@/lib/llm/provider";

export class ImportProvider implements LLMProvider {
  readonly id = "import";

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async generate(prompt: string): Promise<string> {
    // The "prompt" here is the pasted content itself — pass it straight through.
    return prompt;
  }
}
