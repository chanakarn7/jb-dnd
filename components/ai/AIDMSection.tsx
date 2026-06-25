"use client";
// File: components/ai/AIDMSection.tsx
// AI DM Assistant panel (Sprint 7) — DM-ONLY. Generate NPC/Loot/Quest/Recap drafts
// via the server LLM (Ollama) or import-from-paste; review → approve into the campaign.
// Graceful degrade: no provider → warning banner, Import still works.
// REST-only. Inherits DESIGN_SYSTEM tokens (no new colors). Never calls an LLM from the browser.

import { useCallback, useEffect, useRef, useState } from "react";
import { Sparkles, Wand2, AlertTriangle, ClipboardPaste, Loader2 } from "lucide-react";
import { useCampaign } from "@/app/providers";
import { PROMPT_MAX } from "@/lib/ai/rules";
import { ENTITY_TYPES, type AIDraftEntityType, type AIDraftView } from "@/lib/ai/types";
import DraftCard from "./DraftCard";
import ImportModal from "./ImportModal";

// ── token helper (mirrors StorySection) ─────────────────────────────────────
function getStoredToken(campaignId: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    const all = JSON.parse(localStorage.getItem("dnd.sessions") ?? "{}");
    return (all as Record<string, { token?: string }>)[campaignId]?.token ?? null;
  } catch {
    return null;
  }
}

type ApiResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string };

async function api<T>(
  campaignId: string,
  path: string,
  opts?: { method?: string; body?: unknown },
): Promise<ApiResult<T>> {
  const t = getStoredToken(campaignId);
  const res = await fetch(`/api/ai${path}`, {
    method: opts?.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      ...(t ? { Authorization: `Bearer ${t}` } : {}),
    },
    ...(opts?.body !== undefined ? { body: JSON.stringify(opts.body) } : {}),
  });
  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    /* empty */
  }
  if (!res.ok) {
    return { ok: false, status: res.status, error: (json as { error?: string })?.error ?? "error" };
  }
  return { ok: true, data: json as T };
}

const ENTITY_LABELS: Record<AIDraftEntityType, string> = {
  npc: "NPC",
  loot: "Loot",
  quest: "Quest",
  session_recap: "Recap",
};

interface SessionOption {
  id: string;
  title: string | null;
  date: string;
}

export default function AIDMSection({ campaignId }: { campaignId: string }) {
  const { me, toast } = useCampaign();
  const isDM = me?.role === "dm";

  const [ollamaUp, setOllamaUp] = useState<boolean | null>(null);
  const [entityType, setEntityType] = useState<AIDraftEntityType>("npc");
  const [prompt, setPrompt] = useState("");
  const [cr, setCr] = useState<number>(5);
  const [sessionId, setSessionId] = useState<string>("");
  const [sessions, setSessions] = useState<SessionOption[]>([]);
  const [generating, setGenerating] = useState(false);
  const [drafts, setDrafts] = useState<AIDraftView[]>([]);
  const [showRejected, setShowRejected] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const loadedRef = useRef(false);

  // ── loaders ────────────────────────────────────────────────────────────────
  const loadStatus = useCallback(async () => {
    const r = await api<{ ollama: boolean }>(campaignId, "/status");
    setOllamaUp(r.ok ? r.data.ollama : false);
  }, [campaignId]);

  const loadDrafts = useCallback(async () => {
    const r = await api<{ drafts: AIDraftView[] }>(
      campaignId,
      `/drafts${showRejected ? "?includeRejected=true" : ""}`,
    );
    if (r.ok) setDrafts(r.data.drafts);
  }, [campaignId, showRejected]);

  const loadSessions = useCallback(async () => {
    const t = getStoredToken(campaignId);
    const res = await fetch("/api/story/sessions", {
      headers: { ...(t ? { Authorization: `Bearer ${t}` } : {}) },
    });
    if (res.ok) {
      const j = (await res.json()) as { sessions: SessionOption[] };
      setSessions(j.sessions ?? []);
      if (j.sessions?.length && !sessionId) setSessionId(j.sessions[0].id);
    }
  }, [campaignId, sessionId]);

  useEffect(() => {
    if (!isDM || loadedRef.current) return;
    loadedRef.current = true;
    void loadStatus();
    void loadDrafts();
    void loadSessions();
  }, [isDM, loadStatus, loadDrafts, loadSessions]);

  useEffect(() => {
    if (isDM) void loadDrafts();
  }, [showRejected, isDM, loadDrafts]);

  if (!isDM) return null; // hard DM-only guard

  // ── actions ──────────────────────────────────────────────────────────────
  const onGenerate = async () => {
    if (!prompt.trim() || generating) return;
    setGenerating(true);
    const context =
      entityType === "loot" ? { cr } : entityType === "session_recap" ? { sessionId } : undefined;
    const r = await api<{ draft: AIDraftView }>(campaignId, "/generate", {
      method: "POST",
      body: { entityType, prompt, context },
    });
    setGenerating(false);
    if (r.ok) {
      setDrafts((d) => [r.data.draft, ...d]);
      setPrompt("");
      toast("Draft generated — review below", "success");
    } else {
      toast(generateError(r.status, r.error), "danger");
    }
  };

  const onImport = async (et: AIDraftEntityType, content: string) => {
    setBusyId("import");
    const r = await api<{ draft: AIDraftView }>(campaignId, "/import", {
      method: "POST",
      body: { entityType: et, content },
    });
    setBusyId(null);
    if (r.ok) {
      setDrafts((d) => [r.data.draft, ...d]);
      setImportOpen(false);
      toast("Imported draft saved", "success");
    } else {
      toast(`Import failed: ${r.error}`, "danger");
    }
  };

  const onApprove = async (id: string) => {
    setBusyId(id);
    const r = await api<{ draft: AIDraftView; createdEntityId: string | null }>(
      campaignId,
      `/drafts/${id}`,
      { method: "PATCH", body: { action: "approve" } },
    );
    setBusyId(null);
    if (r.ok) {
      setDrafts((d) => d.filter((x) => x.id !== id));
      toast(approveMessage(r.data.draft.entityType), "success");
    } else {
      toast(r.error === "limit_reached" ? "Limit reached for this campaign" : `Approve failed: ${r.error}`, "danger");
    }
  };

  const onReject = async (id: string) => {
    setBusyId(id);
    const r = await api<{ rejected: { id: string } }>(campaignId, `/drafts/${id}`, {
      method: "DELETE",
    });
    setBusyId(null);
    if (r.ok) {
      if (showRejected) void loadDrafts();
      else setDrafts((d) => d.filter((x) => x.id !== id));
      toast("Draft rejected", "warning");
    } else {
      toast(`Reject failed: ${r.error}`, "danger");
    }
  };

  const onSaveEdit = async (id: string, rawText: string) => {
    setBusyId(id);
    const r = await api<{ draft: AIDraftView }>(campaignId, `/drafts/${id}`, {
      method: "PATCH",
      body: { rawText },
    });
    setBusyId(null);
    if (r.ok) {
      setDrafts((d) => d.map((x) => (x.id === id ? r.data.draft : x)));
      toast("Edits saved", "success");
    } else {
      toast(`Save failed: ${r.error}`, "danger");
    }
  };

  // ── render ─────────────────────────────────────────────────────────────────
  const canGenerate =
    ollamaUp === true &&
    prompt.trim().length > 0 &&
    !generating &&
    (entityType !== "session_recap" || !!sessionId);

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold flex items-center gap-2 font-display">
          <Sparkles className="w-5 h-5 text-accent" aria-hidden /> AI DM Assistant
        </h3>
      </div>

      {/* S5 Provider banner */}
      {ollamaUp === false && (
        <div className="mb-4 rounded-md border-l-4 border-warning bg-warning/10 px-4 py-3 text-sm flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-warning mt-0.5 shrink-0" aria-hidden />
          <div>
            <span className="text-text">Ollama not connected — AI generation disabled.</span>{" "}
            <span className="text-muted">Import from Claude / ChatGPT still works.</span>{" "}
            <a
              href="https://ollama.com/download"
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent hover:underline"
            >
              Set up Ollama ↗
            </a>
          </div>
        </div>
      )}

      {/* S2 Generate form */}
      <div className="rounded-lg border border-border bg-surface p-4 space-y-3">
        <div className="flex gap-2 overflow-x-auto">
          {ENTITY_TYPES.map((t) => (
            <button
              key={t}
              onClick={() => setEntityType(t)}
              className={`rounded-md px-3 py-1.5 text-sm border whitespace-nowrap ${
                entityType === t
                  ? "border-accent text-accent"
                  : "border-border text-muted hover:text-text"
              }`}
            >
              {ENTITY_LABELS[t]}
            </button>
          ))}
        </div>

        <div>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value.slice(0, PROMPT_MAX))}
            placeholder="Describe what you want (e.g. 'a friendly halfling innkeeper with a secret')"
            rows={3}
            aria-label="Prompt"
            className="w-full rounded-md bg-bg border border-border px-3 py-2 text-sm"
          />
          {prompt.length >= 1800 && (
            <div className="text-right text-xs text-faint tnum">
              {prompt.length} / {PROMPT_MAX}
            </div>
          )}
        </div>

        {/* Conditional context fields */}
        {entityType === "loot" && (
          <div className="flex items-center gap-2 text-sm">
            <label className="text-muted">Encounter CR</label>
            <input
              type="number"
              min={0}
              max={30}
              value={cr}
              onChange={(e) => setCr(Number(e.target.value))}
              className="w-20 rounded-md bg-bg border border-border px-2 py-1 font-mono tnum"
            />
          </div>
        )}
        {entityType === "session_recap" && (
          <div className="flex items-center gap-2 text-sm">
            <label className="text-muted">Session</label>
            <select
              value={sessionId}
              onChange={(e) => setSessionId(e.target.value)}
              className="rounded-md bg-bg border border-border px-2 py-1 text-sm"
            >
              {sessions.length === 0 && <option value="">No sessions — log one first</option>}
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {new Date(s.date).toLocaleDateString()} — {s.title ?? "Untitled"}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="flex items-center justify-between">
          <button
            onClick={() => setImportOpen(true)}
            className="inline-flex items-center gap-1 text-xs text-muted hover:text-accent"
          >
            <ClipboardPaste className="w-3.5 h-3.5" aria-hidden /> Or import from Claude / ChatGPT ↗
          </button>
          <button
            onClick={onGenerate}
            disabled={!canGenerate}
            aria-busy={generating}
            className="inline-flex items-center gap-1.5 rounded-md bg-accent text-bg px-4 py-2 text-sm font-semibold hover:opacity-90 disabled:opacity-40"
          >
            {generating ? (
              <Loader2 className="w-4 h-4 animate-spin" aria-label="Generating…" />
            ) : (
              <Wand2 className="w-4 h-4" aria-hidden />
            )}
            Generate {ENTITY_LABELS[entityType]}
          </button>
        </div>
      </div>

      {/* S3 Draft list */}
      <div className="flex items-center justify-between mt-5 mb-2">
        <h4 className="text-sm font-semibold text-muted">
          Drafts {drafts.filter((d) => d.status === "pending").length > 0 && `(${drafts.filter((d) => d.status === "pending").length} pending)`}
        </h4>
        <label className="flex items-center gap-1.5 text-xs text-muted cursor-pointer">
          <input
            type="checkbox"
            checked={showRejected}
            onChange={(e) => setShowRejected(e.target.checked)}
          />
          Show rejected
        </label>
      </div>

      {drafts.length === 0 ? (
        <p className="text-sm text-faint rounded-lg border border-dashed border-border p-6 text-center">
          No drafts yet. Generate one above, or import from a paste.
        </p>
      ) : (
        <ul className="space-y-3">
          {drafts.map((d) => (
            <DraftCard
              key={d.id}
              draft={d}
              busy={busyId === d.id}
              onApprove={onApprove}
              onReject={onReject}
              onSaveEdit={onSaveEdit}
            />
          ))}
        </ul>
      )}

      {importOpen && (
        <ImportModal busy={busyId === "import"} onClose={() => setImportOpen(false)} onSubmit={onImport} />
      )}
    </section>
  );
}

// ── error → human message ────────────────────────────────────────────────────
function generateError(status: number, error: string): string {
  if (status === 503) return "No AI provider connected. Start Ollama or use Import.";
  if (status === 502) return "The AI provider errored. Try again.";
  if (error === "no_active_session") return "Pick a session for the recap first.";
  if (error === "prompt_required") return "Enter a prompt first.";
  if (error === "invalid_cr") return "CR must be between 0 and 30.";
  return `Generation failed: ${error}`;
}

function approveMessage(entityType: string): string {
  switch (entityType) {
    case "npc":
      return "NPC added to campaign";
    case "quest":
      return "Quest created";
    case "session_recap":
      return "Recap saved to session";
    case "loot":
      return "Loot approved";
    default:
      return "Approved";
  }
}
