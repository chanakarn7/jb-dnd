// Pluggable LLM provider interface (docs/program/ARCHITECTURE.md §Pluggable LLM provider).
// Defined in Foundation so Sprint 7 only ADDS adapters (Ollama / import / claude) — no refactor.
// LLM calls always run server-side, never from the browser.

export interface LLMOptions {
  system?: string;
  maxTokens?: number;
  /** Request structured JSON output. */
  json?: boolean;
}

export interface LLMProvider {
  /** e.g. "ollama" | "import" | "claude" */
  readonly id: string;
  generate(prompt: string, opts?: LLMOptions): Promise<string>;
  isAvailable(): Promise<boolean>;
}
