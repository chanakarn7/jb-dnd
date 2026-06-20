"use client";
// File: app/campaign/[id]/StorySection.tsx
// Story hub — Sessions · Quests · NPCs · Journal (Sprint 5). REST-only (no socket).
// DM = full CRUD; player = read-only. Inherits DESIGN_SYSTEM tokens (no new colors).
// Markdown rendered safely via <Markdown> (no dangerouslySetInnerHTML).

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ScrollText,
  Map as MapIcon,
  Users,
  BookOpen,
  Plus,
  Pencil,
  Trash2,
  X,
  ChevronDown,
  ChevronUp,
  Skull,
  Heart,
  Sparkles,
} from "lucide-react";
import { useCampaign } from "../../providers";
import Markdown from "./Markdown";
import type {
  SessionListItem,
  SessionDetailView,
  QuestListItem,
  QuestView,
  QuestStatus,
  NpcListItem,
  NpcView,
  JournalListItem,
  JournalEntryView,
  ObjectiveItem,
} from "@/lib/story/types";

// ── token helper (mirrors CombatTracker) ───────────────────────────────────
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
  const res = await fetch(`/api/story${path}`, {
    method: opts?.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      ...(t ? { Authorization: `Bearer ${t}` } : {}),
    },
    ...(opts?.body !== undefined ? { body: JSON.stringify(opts.body) } : {}),
  });
  if (res.status === 204) return { ok: true, data: undefined as T };
  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    /* empty body */
  }
  if (!res.ok) {
    return { ok: false, status: res.status, error: (json as { error?: string })?.error ?? "error" };
  }
  return { ok: true, data: json as T };
}

const STATUS_META: Record<QuestStatus, { label: string; cls: string }> = {
  active: { label: "Active", cls: "text-accent border-accent/40" },
  completed: { label: "Completed", cls: "text-success border-success/40" },
  failed: { label: "Failed", cls: "text-danger border-danger/40" },
  abandoned: { label: "Abandoned", cls: "text-muted border-border" },
};

const TABS = [
  { key: "sessions", label: "Sessions", icon: ScrollText, add: "Log Session" },
  { key: "quests", label: "Quests", icon: MapIcon, add: "New Quest" },
  { key: "npcs", label: "NPCs", icon: Users, add: "Add NPC" },
  { key: "journal", label: "Journal", icon: BookOpen, add: "New Entry" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" });
}

// ═════════════════════════════════════════════════════════════════════════════
export default function StorySection({ campaignId }: { campaignId: string }) {
  const { me, toast } = useCampaign();
  const isDM = me?.role === "dm";
  const [tab, setTab] = useState<TabKey>("sessions");
  const [addOpen, setAddOpen] = useState(false);

  const active = TABS.find((t) => t.key === tab)!;

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-accent" aria-hidden /> Story
        </h3>
        {isDM && (
          <button
            onClick={() => setAddOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-md bg-accent text-bg px-3 py-1.5 text-sm font-semibold hover:opacity-90"
          >
            <Plus className="w-4 h-4" aria-hidden /> {active.add}
          </button>
        )}
      </div>

      {/* sub-nav */}
      <div role="tablist" className="flex gap-1 border-b border-border mb-4">
        {TABS.map((t) => {
          const Icon = t.icon;
          const on = t.key === tab;
          return (
            <button
              key={t.key}
              role="tab"
              aria-selected={on}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm -mb-px border-b-2 transition-colors ${
                on
                  ? "border-accent text-accent font-medium"
                  : "border-transparent text-muted hover:text-text"
              }`}
            >
              <Icon className="w-4 h-4" aria-hidden /> {t.label}
            </button>
          );
        })}
      </div>

      {tab === "sessions" && (
        <SessionsTab campaignId={campaignId} isDM={isDM} toast={toast} addOpen={addOpen} setAddOpen={setAddOpen} />
      )}
      {tab === "quests" && (
        <QuestsTab campaignId={campaignId} isDM={isDM} toast={toast} addOpen={addOpen} setAddOpen={setAddOpen} />
      )}
      {tab === "npcs" && (
        <NpcsTab campaignId={campaignId} isDM={isDM} toast={toast} addOpen={addOpen} setAddOpen={setAddOpen} />
      )}
      {tab === "journal" && (
        <JournalTab campaignId={campaignId} isDM={isDM} toast={toast} addOpen={addOpen} setAddOpen={setAddOpen} />
      )}
    </section>
  );
}

type ToastFn = (message: string, kind?: "success" | "warning" | "danger") => void;
interface TabProps {
  campaignId: string;
  isDM: boolean;
  toast: ToastFn;
  addOpen: boolean;
  setAddOpen: (v: boolean) => void;
}

// ── shared bits ─────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="space-y-2" aria-busy>
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-16 rounded-md bg-surface-raised animate-pulse" />
      ))}
    </div>
  );
}

function EmptyState({ icon: Icon, text }: { icon: typeof ScrollText; text: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-surface p-8 text-center">
      <Icon className="w-7 h-7 text-muted mx-auto" aria-hidden />
      <p className="mt-3 text-muted text-sm">{text}</p>
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[92%] max-w-lg max-h-[88vh] overflow-y-auto rounded-lg border border-border bg-surface p-6"
      >
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-lg font-semibold">{title}</h4>
          <button onClick={onClose} className="text-muted hover:text-text" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ConfirmDelete({ name, onCancel, onConfirm }: { name: string; onCancel: () => void; onConfirm: () => void }) {
  return (
    <div className="fixed inset-0 z-[60]">
      <div className="absolute inset-0 bg-black/60" onClick={onCancel} />
      <div
        role="dialog"
        aria-modal="true"
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] max-w-sm rounded-lg border border-border bg-surface p-6"
      >
        <h4 className="text-lg font-semibold">Delete {name}?</h4>
        <p className="text-muted text-sm mt-2">This cannot be undone.</p>
        <div className="mt-5 flex justify-end gap-3">
          <button onClick={onCancel} className="rounded-md border border-border px-4 py-2 text-sm hover:bg-surface-raised">
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="rounded-md bg-danger text-white px-4 py-2 text-sm font-semibold hover:opacity-90"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

const inputCls =
  "w-full rounded-md bg-bg border border-border px-3 py-2 text-sm focus:outline-none focus:border-accent";
const labelCls = "block text-xs text-muted mb-1";

function FormActions({ onCancel, saving }: { onCancel: () => void; saving: boolean }) {
  return (
    <div className="mt-5 flex justify-end gap-3">
      <button type="button" onClick={onCancel} className="text-muted hover:text-text text-sm px-2">
        Cancel
      </button>
      <button
        type="submit"
        disabled={saving}
        className="rounded-md bg-accent text-bg px-4 py-2 text-sm font-semibold hover:opacity-90 disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save"}
      </button>
    </div>
  );
}

// Markdown textarea + Write/Preview toggle
function MarkdownField({
  label,
  value,
  onChange,
  rows = 5,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  placeholder?: string;
}) {
  const [preview, setPreview] = useState(false);
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-xs text-muted">{label}</label>
        <div className="flex gap-1 text-xs">
          <button
            type="button"
            onClick={() => setPreview(false)}
            className={`px-2 py-0.5 rounded ${!preview ? "bg-surface-raised text-text" : "text-muted"}`}
          >
            Write
          </button>
          <button
            type="button"
            onClick={() => setPreview(true)}
            className={`px-2 py-0.5 rounded ${preview ? "bg-surface-raised text-text" : "text-muted"}`}
          >
            Preview
          </button>
        </div>
      </div>
      {preview ? (
        <div className="min-h-[6rem] rounded-md bg-bg border border-border px-3 py-2 space-y-2">
          {value.trim() ? <Markdown content={value} /> : <p className="text-faint text-sm">Nothing to preview</p>}
        </div>
      ) : (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={rows}
          placeholder={placeholder}
          className={`${inputCls} font-mono resize-y`}
        />
      )}
    </div>
  );
}

// ═══════════════════════════ SESSIONS ═══════════════════════════════════════
function SessionsTab({ campaignId, isDM, toast, addOpen, setAddOpen }: TabProps) {
  const [items, setItems] = useState<SessionListItem[] | null>(null);
  const [err, setErr] = useState(false);
  const [expanded, setExpanded] = useState<SessionDetailView | null>(null);
  const [editing, setEditing] = useState<SessionDetailView | null>(null);
  const [confirmDel, setConfirmDel] = useState<{ id: string; name: string } | null>(null);

  const load = useCallback(async () => {
    const r = await api<{ sessions: SessionListItem[] }>(campaignId, "/sessions");
    if (r.ok) {
      setItems(r.data.sessions);
      setErr(false);
    } else setErr(true);
  }, [campaignId]);
  useEffect(() => {
    // load() awaits the fetch before any setState — async, not a cascading render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const toggle = async (id: string) => {
    if (expanded?.id === id) return setExpanded(null);
    const r = await api<{ session: SessionDetailView }>(campaignId, `/sessions/${id}`);
    if (r.ok) setExpanded(r.data.session);
    else toast("Failed to load session", "danger");
  };

  const del = async (id: string) => {
    const r = await api(campaignId, `/sessions/${id}`, { method: "DELETE" });
    setConfirmDel(null);
    if (r.ok) {
      toast("Session deleted", "warning");
      setExpanded(null);
      void load();
    } else toast("Delete failed", "danger");
  };

  if (items === null && !err) return <Skeleton />;
  if (err)
    return (
      <div className="text-center text-danger text-sm py-6">
        Failed to load sessions.{" "}
        <button onClick={load} className="underline">
          Retry
        </button>
      </div>
    );

  return (
    <div className="space-y-2">
      {items!.length === 0 && <EmptyState icon={ScrollText} text="No sessions logged yet." />}
      {items!.map((s) => {
        const open = expanded?.id === s.id;
        return (
          <div key={s.id} className="rounded-md border border-border bg-surface group">
            <button onClick={() => toggle(s.id)} className="w-full flex items-center gap-3 px-4 py-3 text-left">
              <span className="font-mono text-xs rounded border border-accent/40 bg-surface-raised text-accent px-2 py-1">
                {fmtDate(s.date)}
              </span>
              <span className="font-semibold flex-1 truncate">{s.title ?? "Untitled session"}</span>
              <span className="font-mono text-xs rounded-full bg-arcane/15 text-arcane px-2 py-0.5">
                {s.xpAwarded} XP
              </span>
              {isDM && (
                <span className="hidden group-hover:flex items-center gap-2">
                  <Pencil
                    className="w-4 h-4 text-muted hover:text-accent"
                    onClick={async (e) => {
                      e.stopPropagation();
                      const r = await api<{ session: SessionDetailView }>(campaignId, `/sessions/${s.id}`);
                      if (r.ok) setEditing(r.data.session);
                    }}
                  />
                  <Trash2
                    className="w-4 h-4 text-muted hover:text-danger"
                    onClick={(e) => {
                      e.stopPropagation();
                      setConfirmDel({ id: s.id, name: s.title ?? "this session" });
                    }}
                  />
                </span>
              )}
              {open ? <ChevronUp className="w-4 h-4 text-muted" /> : <ChevronDown className="w-4 h-4 text-muted" />}
            </button>
            {open && expanded && (
              <div className="px-4 pb-4 space-y-3 border-t border-border pt-3">
                {expanded.summary ? (
                  <Markdown content={expanded.summary} />
                ) : (
                  <p className="text-faint text-sm">No recap.</p>
                )}
                {expanded.notableLoot && (
                  <p className="text-sm">
                    <span className="text-muted">Notable loot: </span>
                    {expanded.notableLoot}
                  </p>
                )}
                {expanded.journalEntries.length > 0 && (
                  <div className="text-sm">
                    <p className="text-muted text-xs mb-1">Linked journal entries</p>
                    <ul className="list-disc pl-5 text-text/90">
                      {expanded.journalEntries.map((j) => (
                        <li key={j.id}>{j.title ?? "Untitled"}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {(addOpen || editing) && isDM && (
        <SessionForm
          campaignId={campaignId}
          existing={editing}
          onClose={() => {
            setAddOpen(false);
            setEditing(null);
          }}
          onSaved={() => {
            setAddOpen(false);
            setEditing(null);
            void load();
            toast("Session saved", "success");
          }}
          onError={(m) => toast(m, "danger")}
        />
      )}
      {confirmDel && (
        <ConfirmDelete name={confirmDel.name} onCancel={() => setConfirmDel(null)} onConfirm={() => del(confirmDel.id)} />
      )}
    </div>
  );
}

function SessionForm({
  campaignId,
  existing,
  onClose,
  onSaved,
  onError,
}: {
  campaignId: string;
  existing: SessionDetailView | null;
  onClose: () => void;
  onSaved: () => void;
  onError: (m: string) => void;
}) {
  const [title, setTitle] = useState(existing?.title ?? "");
  const [date, setDate] = useState(
    existing ? existing.date.slice(0, 10) : new Date().toISOString().slice(0, 10),
  );
  const [xp, setXp] = useState(String(existing?.xpAwarded ?? 0));
  const [loot, setLoot] = useState(existing?.notableLoot ?? "");
  const [summary, setSummary] = useState(existing?.summary ?? "");
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const body = {
      title: title.trim() || null,
      date,
      xpAwarded: Number(xp) || 0,
      notableLoot: loot.trim() || null,
      summary: summary.trim() || null,
    };
    const r = existing
      ? await api(campaignId, `/sessions/${existing.id}`, { method: "PATCH", body })
      : await api(campaignId, "/sessions", { method: "POST", body });
    setSaving(false);
    if (r.ok) onSaved();
    else onError(`Could not save (${(r as { error: string }).error})`);
  };

  return (
    <Modal title={existing ? "Edit Session" : "Log Session"} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <div>
          <label className={labelCls}>Title</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Session 3" className={inputCls} />
        </div>
        <div className="flex gap-3">
          <div className="flex-1">
            <label className={labelCls}>Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required className={inputCls} />
          </div>
          <div className="w-28">
            <label className={labelCls}>XP awarded</label>
            <input
              type="number"
              min={0}
              value={xp}
              onChange={(e) => setXp(e.target.value)}
              className={`${inputCls} font-mono`}
            />
          </div>
        </div>
        <div>
          <label className={labelCls}>Notable loot</label>
          <input value={loot} onChange={(e) => setLoot(e.target.value)} placeholder="Longsword +1" className={inputCls} />
        </div>
        <MarkdownField label="Summary (markdown)" value={summary} onChange={setSummary} rows={6} />
        <FormActions onCancel={onClose} saving={saving} />
      </form>
    </Modal>
  );
}

// ═══════════════════════════ QUESTS ═════════════════════════════════════════
function QuestsTab({ campaignId, isDM, toast, addOpen, setAddOpen }: TabProps) {
  const [items, setItems] = useState<QuestListItem[] | null>(null);
  const [err, setErr] = useState(false);
  const [expanded, setExpanded] = useState<QuestView | null>(null);
  const [editing, setEditing] = useState<QuestView | null>(null);
  const [confirmDel, setConfirmDel] = useState<{ id: string; name: string } | null>(null);

  const load = useCallback(async () => {
    const r = await api<{ quests: QuestListItem[] }>(campaignId, "/quests");
    if (r.ok) {
      setItems(r.data.quests);
      setErr(false);
    } else setErr(true);
  }, [campaignId]);
  useEffect(() => {
    // load() awaits the fetch before any setState — async, not a cascading render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const toggle = async (id: string) => {
    if (expanded?.id === id) return setExpanded(null);
    const r = await api<{ quest: QuestView }>(campaignId, `/quests/${id}`);
    if (r.ok) setExpanded(r.data.quest);
  };

  const patchQuest = async (id: string, body: Record<string, unknown>) => {
    const r = await api<{ quest: QuestView }>(campaignId, `/quests/${id}`, { method: "PATCH", body });
    if (r.ok) {
      setExpanded((e) => (e?.id === id ? r.data.quest : e));
      void load();
    } else toast("Update failed", "danger");
  };

  const toggleObjective = (q: QuestView, idx: number) => {
    const objectives = q.objectives.map((o, i) => (i === idx ? { ...o, checked: !o.checked } : o));
    void patchQuest(q.id, { objectives });
  };

  const del = async (id: string) => {
    const r = await api(campaignId, `/quests/${id}`, { method: "DELETE" });
    setConfirmDel(null);
    if (r.ok) {
      toast("Quest deleted", "warning");
      setExpanded(null);
      void load();
    } else toast("Delete failed", "danger");
  };

  const grouped = useMemo(() => {
    const order: QuestStatus[] = ["active", "completed", "failed", "abandoned"];
    return order
      .map((st) => ({ status: st, quests: (items ?? []).filter((q) => q.status === st) }))
      .filter((g) => g.quests.length > 0);
  }, [items]);

  if (items === null && !err) return <Skeleton />;
  if (err)
    return (
      <div className="text-center text-danger text-sm py-6">
        Failed to load quests.{" "}
        <button onClick={load} className="underline">
          Retry
        </button>
      </div>
    );

  return (
    <div className="space-y-5">
      {items!.length === 0 && <EmptyState icon={MapIcon} text="No quests yet." />}
      {grouped.map((g) => (
        <div key={g.status}>
          <h4 className={`text-xs uppercase tracking-wide mb-2 ${STATUS_META[g.status].cls.split(" ")[0]}`}>
            {STATUS_META[g.status].label}
          </h4>
          <div className="space-y-2">
            {g.quests.map((q) => {
              const open = expanded?.id === q.id;
              return (
                <div key={q.id} className="rounded-md border border-border bg-surface group">
                  <button onClick={() => toggle(q.id)} className="w-full flex items-center gap-3 px-4 py-3 text-left">
                    <span className="font-semibold flex-1 truncate">{q.name}</span>
                    {q.giverName && <span className="text-xs text-muted hidden sm:inline">from {q.giverName}</span>}
                    <span className="font-mono text-xs rounded-full bg-surface-raised px-2 py-0.5 text-muted">
                      {q.completedCount}/{q.objectiveCount}
                    </span>
                    {isDM && (
                      <span className="hidden group-hover:flex items-center gap-2">
                        <Pencil
                          className="w-4 h-4 text-muted hover:text-accent"
                          onClick={async (e) => {
                            e.stopPropagation();
                            const r = await api<{ quest: QuestView }>(campaignId, `/quests/${q.id}`);
                            if (r.ok) setEditing(r.data.quest);
                          }}
                        />
                        <Trash2
                          className="w-4 h-4 text-muted hover:text-danger"
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirmDel({ id: q.id, name: q.name });
                          }}
                        />
                      </span>
                    )}
                    {open ? <ChevronUp className="w-4 h-4 text-muted" /> : <ChevronDown className="w-4 h-4 text-muted" />}
                  </button>
                  {open && expanded && (
                    <div className="px-4 pb-4 space-y-3 border-t border-border pt-3">
                      {isDM && (
                        <div className="flex items-center gap-2">
                          <label className="text-xs text-muted">Status</label>
                          <select
                            value={expanded.status}
                            onChange={(e) => patchQuest(q.id, { status: e.target.value })}
                            className="rounded-md bg-bg border border-border px-2 py-1 text-sm"
                          >
                            {(Object.keys(STATUS_META) as QuestStatus[]).map((st) => (
                              <option key={st} value={st}>
                                {STATUS_META[st].label}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                      {expanded.description && <Markdown content={expanded.description} />}
                      {expanded.objectives.length > 0 && (
                        <ul className="space-y-1.5">
                          {expanded.objectives.map((o, idx) => (
                            <li key={idx} className="flex items-center gap-2 text-sm">
                              <input
                                type="checkbox"
                                checked={o.checked}
                                disabled={!isDM}
                                aria-disabled={!isDM}
                                onChange={() => toggleObjective(expanded, idx)}
                                className={`accent-accent w-4 h-4 ${!isDM ? "pointer-events-none opacity-70" : ""}`}
                              />
                              <span className={o.checked ? "line-through text-faint" : ""}>{o.text}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                      {expanded.reward && (
                        <p className="text-sm">
                          <span className="text-muted">Reward: </span>
                          {expanded.reward}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {(addOpen || editing) && isDM && (
        <QuestForm
          campaignId={campaignId}
          existing={editing}
          onClose={() => {
            setAddOpen(false);
            setEditing(null);
          }}
          onSaved={() => {
            setAddOpen(false);
            setEditing(null);
            void load();
            toast("Quest saved", "success");
          }}
          onError={(m) => toast(m, "danger")}
        />
      )}
      {confirmDel && (
        <ConfirmDelete name={confirmDel.name} onCancel={() => setConfirmDel(null)} onConfirm={() => del(confirmDel.id)} />
      )}
    </div>
  );
}

function QuestForm({
  campaignId,
  existing,
  onClose,
  onSaved,
  onError,
}: {
  campaignId: string;
  existing: QuestView | null;
  onClose: () => void;
  onSaved: () => void;
  onError: (m: string) => void;
}) {
  const [name, setName] = useState(existing?.name ?? "");
  const [giver, setGiver] = useState(existing?.giverName ?? "");
  const [status, setStatus] = useState<QuestStatus>(existing?.status ?? "active");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [reward, setReward] = useState(existing?.reward ?? "");
  const [objectives, setObjectives] = useState<ObjectiveItem[]>(existing?.objectives ?? []);
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return onError("Quest name is required");
    setSaving(true);
    const body = {
      name: name.trim(),
      giverName: giver.trim() || null,
      status,
      description: description.trim() || null,
      reward: reward.trim() || null,
      objectives: objectives.filter((o) => o.text.trim()).map((o) => ({ text: o.text.trim(), checked: o.checked })),
    };
    const r = existing
      ? await api(campaignId, `/quests/${existing.id}`, { method: "PATCH", body })
      : await api(campaignId, "/quests", { method: "POST", body });
    setSaving(false);
    if (r.ok) onSaved();
    else onError(`Could not save (${(r as { error: string }).error})`);
  };

  return (
    <Modal title={existing ? "Edit Quest" : "New Quest"} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <div>
          <label className={labelCls}>Name *</label>
          <input value={name} onChange={(e) => setName(e.target.value)} required className={inputCls} />
        </div>
        <div className="flex gap-3">
          <div className="flex-1">
            <label className={labelCls}>Giver</label>
            <input value={giver} onChange={(e) => setGiver(e.target.value)} placeholder="Elder Maren" className={inputCls} />
          </div>
          <div className="w-40">
            <label className={labelCls}>Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value as QuestStatus)} className={inputCls}>
              {(Object.keys(STATUS_META) as QuestStatus[]).map((st) => (
                <option key={st} value={st}>
                  {STATUS_META[st].label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <MarkdownField label="Description (markdown)" value={description} onChange={setDescription} rows={4} />
        <div>
          <label className={labelCls}>Objectives</label>
          <div className="space-y-2">
            {objectives.map((o, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={o.checked}
                  onChange={() =>
                    setObjectives((arr) => arr.map((x, i) => (i === idx ? { ...x, checked: !x.checked } : x)))
                  }
                  className="accent-accent w-4 h-4"
                />
                <input
                  value={o.text}
                  onChange={(e) => setObjectives((arr) => arr.map((x, i) => (i === idx ? { ...x, text: e.target.value } : x)))}
                  placeholder="Objective"
                  className={`${inputCls} flex-1`}
                />
                <button
                  type="button"
                  onClick={() => setObjectives((arr) => arr.filter((_, i) => i !== idx))}
                  className="text-muted hover:text-danger"
                  aria-label="Remove objective"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setObjectives((arr) => [...arr, { text: "", checked: false }])}
              className="text-sm text-accent hover:underline inline-flex items-center gap-1"
            >
              <Plus className="w-4 h-4" /> Add objective
            </button>
          </div>
        </div>
        <div>
          <label className={labelCls}>Reward</label>
          <input value={reward} onChange={(e) => setReward(e.target.value)} className={inputCls} />
        </div>
        <FormActions onCancel={onClose} saving={saving} />
      </form>
    </Modal>
  );
}

// ═══════════════════════════ NPCS ═══════════════════════════════════════════
function NpcsTab({ campaignId, isDM, toast, addOpen, setAddOpen }: TabProps) {
  const [items, setItems] = useState<NpcListItem[] | null>(null);
  const [err, setErr] = useState(false);
  const [filter, setFilter] = useState<"all" | "alive" | "dead">("all");
  const [factionQ, setFactionQ] = useState("");
  const [detail, setDetail] = useState<NpcView | null>(null);
  const [editing, setEditing] = useState<NpcView | null>(null);
  const [confirmDel, setConfirmDel] = useState<{ id: string; name: string } | null>(null);

  const load = useCallback(async () => {
    const r = await api<{ npcs: NpcListItem[] }>(campaignId, "/npcs");
    if (r.ok) {
      setItems(r.data.npcs);
      setErr(false);
    } else setErr(true);
  }, [campaignId]);
  useEffect(() => {
    // load() awaits the fetch before any setState — async, not a cascading render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const toggleAlive = async (n: NpcListItem) => {
    const r = await api(campaignId, `/npcs/${n.id}`, { method: "PATCH", body: { isAlive: !n.isAlive } });
    if (r.ok) void load();
    else toast("Update failed", "danger");
  };

  const del = async (id: string) => {
    const r = await api(campaignId, `/npcs/${id}`, { method: "DELETE" });
    setConfirmDel(null);
    if (r.ok) {
      toast("NPC deleted", "warning");
      void load();
    } else toast("Delete failed", "danger");
  };

  const shown = useMemo(() => {
    let list = items ?? [];
    if (filter === "alive") list = list.filter((n) => n.isAlive);
    if (filter === "dead") list = list.filter((n) => !n.isAlive);
    if (factionQ.trim())
      list = list.filter((n) => (n.faction ?? "").toLowerCase().includes(factionQ.trim().toLowerCase()));
    return list;
  }, [items, filter, factionQ]);

  if (items === null && !err) return <Skeleton />;
  if (err)
    return (
      <div className="text-center text-danger text-sm py-6">
        Failed to load NPCs.{" "}
        <button onClick={load} className="underline">
          Retry
        </button>
      </div>
    );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {(["all", "alive", "dead"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-3 py-1 text-xs border capitalize ${
              filter === f ? "border-accent text-accent" : "border-border text-muted hover:text-text"
            }`}
          >
            {f}
          </button>
        ))}
        <div className="relative ml-auto">
          <input
            value={factionQ}
            onChange={(e) => setFactionQ(e.target.value)}
            placeholder="Filter faction…"
            className="rounded-md bg-bg border border-border pl-3 pr-7 py-1 text-sm w-40"
          />
          {factionQ && (
            <button onClick={() => setFactionQ("")} className="absolute right-2 top-1.5 text-muted" aria-label="Clear">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {shown.length === 0 ? (
        <EmptyState icon={Users} text="No NPCs recorded yet." />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {shown.map((n) => (
            <div
              key={n.id}
              className={`rounded-md border border-border bg-surface p-3 group ${n.isAlive ? "" : "opacity-50"}`}
            >
              <div className="flex items-start gap-2">
                <button onClick={async () => {
                  const r = await api<{ npc: NpcView }>(campaignId, `/npcs/${n.id}`);
                  if (r.ok) setDetail(r.data.npc);
                }} className="flex-1 text-left">
                  <p className="font-semibold flex items-center gap-1.5">
                    {n.name}
                    {!n.isAlive && <span className="text-danger" title="Deceased">†</span>}
                  </p>
                  {n.role && <p className="text-xs text-muted">{n.role}</p>}
                  {n.faction && (
                    <span className="inline-block mt-1 text-[0.7rem] rounded-full bg-arcane/15 text-arcane px-2 py-0.5">
                      {n.faction}
                    </span>
                  )}
                </button>
                {isDM && (
                  <div className="hidden group-hover:flex flex-col gap-1.5">
                    <button onClick={() => toggleAlive(n)} className="text-muted hover:text-accent" aria-label="Toggle alive">
                      {n.isAlive ? <Skull className="w-4 h-4" /> : <Heart className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={async () => {
                        const r = await api<{ npc: NpcView }>(campaignId, `/npcs/${n.id}`);
                        if (r.ok) setEditing(r.data.npc);
                      }}
                      className="text-muted hover:text-accent"
                      aria-label="Edit"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setConfirmDel({ id: n.id, name: n.name })}
                      className="text-muted hover:text-danger"
                      aria-label="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {detail && (
        <Modal title={detail.name} onClose={() => setDetail(null)}>
          <div className="space-y-2 text-sm">
            {detail.role && <p className="text-muted">{detail.role}</p>}
            {detail.faction && <p className="text-arcane">{detail.faction}</p>}
            <p className={detail.isAlive ? "text-success" : "text-danger"}>{detail.isAlive ? "Alive" : "Deceased"}</p>
            {detail.notes ? <Markdown content={detail.notes} /> : <p className="text-faint">No notes.</p>}
          </div>
        </Modal>
      )}
      {(addOpen || editing) && isDM && (
        <NpcForm
          campaignId={campaignId}
          existing={editing}
          onClose={() => {
            setAddOpen(false);
            setEditing(null);
          }}
          onSaved={() => {
            setAddOpen(false);
            setEditing(null);
            void load();
            toast("NPC saved", "success");
          }}
          onError={(m) => toast(m, "danger")}
        />
      )}
      {confirmDel && (
        <ConfirmDelete name={confirmDel.name} onCancel={() => setConfirmDel(null)} onConfirm={() => del(confirmDel.id)} />
      )}
    </div>
  );
}

function NpcForm({
  campaignId,
  existing,
  onClose,
  onSaved,
  onError,
}: {
  campaignId: string;
  existing: NpcView | null;
  onClose: () => void;
  onSaved: () => void;
  onError: (m: string) => void;
}) {
  const [name, setName] = useState(existing?.name ?? "");
  const [role, setRole] = useState(existing?.role ?? "");
  const [faction, setFaction] = useState(existing?.faction ?? "");
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [isAlive, setIsAlive] = useState(existing?.isAlive ?? true);
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return onError("Name is required");
    setSaving(true);
    const body = {
      name: name.trim(),
      role: role.trim() || null,
      faction: faction.trim() || null,
      notes: notes.trim() || null,
      isAlive,
    };
    const r = existing
      ? await api(campaignId, `/npcs/${existing.id}`, { method: "PATCH", body })
      : await api(campaignId, "/npcs", { method: "POST", body });
    setSaving(false);
    if (r.ok) onSaved();
    else onError(`Could not save (${(r as { error: string }).error})`);
  };

  return (
    <Modal title={existing ? "Edit NPC" : "Add NPC"} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <div>
          <label className={labelCls}>Name *</label>
          <input value={name} onChange={(e) => setName(e.target.value)} required className={inputCls} />
        </div>
        <div className="flex gap-3">
          <div className="flex-1">
            <label className={labelCls}>Role</label>
            <input value={role} onChange={(e) => setRole(e.target.value)} placeholder="Innkeeper" className={inputCls} />
          </div>
          <div className="flex-1">
            <label className={labelCls}>Faction</label>
            <input value={faction} onChange={(e) => setFaction(e.target.value)} className={inputCls} />
          </div>
        </div>
        <MarkdownField label="Notes (markdown)" value={notes} onChange={setNotes} rows={4} />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={isAlive} onChange={(e) => setIsAlive(e.target.checked)} className="accent-accent w-4 h-4" />
          Alive
        </label>
        <FormActions onCancel={onClose} saving={saving} />
      </form>
    </Modal>
  );
}

// ═══════════════════════════ JOURNAL ════════════════════════════════════════
function JournalTab({ campaignId, isDM, toast, addOpen, setAddOpen }: TabProps) {
  const [items, setItems] = useState<JournalListItem[] | null>(null);
  const [err, setErr] = useState(false);
  const [selected, setSelected] = useState<JournalEntryView | null>(null);
  const [editing, setEditing] = useState(false);
  const [confirmDel, setConfirmDel] = useState<{ id: string; name: string } | null>(null);
  const [sessions, setSessions] = useState<SessionListItem[]>([]);

  const load = useCallback(async () => {
    const r = await api<{ entries: JournalListItem[] }>(campaignId, "/journal");
    if (r.ok) {
      setItems(r.data.entries);
      setErr(false);
    } else setErr(true);
  }, [campaignId]);
  useEffect(() => {
    // load() awaits the fetch before any setState — async, not a cascading render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    void api<{ sessions: SessionListItem[] }>(campaignId, "/sessions").then((r) => {
      if (r.ok) setSessions(r.data.sessions);
    });
  }, [load, campaignId]);

  const open = async (id: string) => {
    const r = await api<{ entry: JournalEntryView }>(campaignId, `/journal/${id}`);
    if (r.ok) {
      setSelected(r.data.entry);
      setEditing(false);
    }
  };

  const del = async (id: string) => {
    const r = await api(campaignId, `/journal/${id}`, { method: "DELETE" });
    setConfirmDel(null);
    if (r.ok) {
      toast("Entry deleted", "warning");
      setSelected(null);
      void load();
    } else toast("Delete failed", "danger");
  };

  if (items === null && !err) return <Skeleton />;
  if (err)
    return (
      <div className="text-center text-danger text-sm py-6">
        Failed to load journal.{" "}
        <button onClick={load} className="underline">
          Retry
        </button>
      </div>
    );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4">
      <div className="space-y-1">
        {items!.length === 0 && <EmptyState icon={BookOpen} text="No journal entries yet." />}
        {items!.map((e) => (
          <button
            key={e.id}
            onClick={() => open(e.id)}
            className={`w-full text-left rounded-md border px-3 py-2 ${
              selected?.id === e.id ? "border-accent bg-surface-raised" : "border-border bg-surface hover:bg-surface-raised"
            }`}
          >
            <p className="font-medium text-sm truncate">{e.title ?? "Untitled"}</p>
            <p className="text-xs text-muted font-mono">{fmtDate(e.createdAt)}</p>
            {e.sessionId ? (
              <p className="text-xs italic text-accent truncate">{e.sessionTitle ?? "Linked session"}</p>
            ) : (
              <p className="text-xs italic text-faint">Unlinked</p>
            )}
          </button>
        ))}
      </div>

      <div className="rounded-md border border-border bg-surface p-4 min-h-[12rem]">
        {!selected ? (
          <p className="text-faint text-sm text-center py-10">Select an entry to read it.</p>
        ) : editing && isDM ? (
          <JournalEditor
            campaignId={campaignId}
            entry={selected}
            sessions={sessions}
            onCancel={() => setEditing(false)}
            onSaved={(updated) => {
              setSelected(updated);
              setEditing(false);
              void load();
              toast("Entry saved", "success");
            }}
            onError={(m) => toast(m, "danger")}
          />
        ) : (
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-2">
              <h4 className="text-lg font-semibold">{selected.title ?? "Untitled"}</h4>
              {isDM && (
                <div className="flex items-center gap-2">
                  <button onClick={() => setEditing(true)} className="text-muted hover:text-accent" aria-label="Edit">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setConfirmDel({ id: selected.id, name: selected.title ?? "this entry" })}
                    className="text-muted hover:text-danger"
                    aria-label="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
            <Markdown content={selected.content} />
          </div>
        )}
      </div>

      {addOpen && isDM && (
        <Modal title="New Journal Entry" onClose={() => setAddOpen(false)}>
          <JournalEditor
            campaignId={campaignId}
            entry={null}
            sessions={sessions}
            onCancel={() => setAddOpen(false)}
            onSaved={(created) => {
              setAddOpen(false);
              setSelected(created);
              void load();
              toast("Entry saved", "success");
            }}
            onError={(m) => toast(m, "danger")}
          />
        </Modal>
      )}
      {confirmDel && (
        <ConfirmDelete name={confirmDel.name} onCancel={() => setConfirmDel(null)} onConfirm={() => del(confirmDel.id)} />
      )}
    </div>
  );
}

function JournalEditor({
  campaignId,
  entry,
  sessions,
  onCancel,
  onSaved,
  onError,
}: {
  campaignId: string;
  entry: JournalEntryView | null;
  sessions: SessionListItem[];
  onCancel: () => void;
  onSaved: (e: JournalEntryView) => void;
  onError: (m: string) => void;
}) {
  const [title, setTitle] = useState(entry?.title ?? "");
  const [content, setContent] = useState(entry?.content ?? "");
  const [sessionId, setSessionId] = useState(entry?.sessionId ?? "");
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return onError("Content is required");
    setSaving(true);
    const body = {
      title: title.trim() || null,
      content: content.trim(),
      sessionId: sessionId || null,
    };
    const r = entry
      ? await api<{ entry: JournalEntryView }>(campaignId, `/journal/${entry.id}`, { method: "PATCH", body })
      : await api<{ entry: JournalEntryView }>(campaignId, "/journal", { method: "POST", body });
    setSaving(false);
    if (r.ok) onSaved(r.data.entry);
    else onError(`Could not save (${(r as { error: string }).error})`);
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <label className={labelCls}>Title</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>Linked session</label>
        <select value={sessionId} onChange={(e) => setSessionId(e.target.value)} className={inputCls}>
          <option value="">— None —</option>
          {sessions.map((s) => (
            <option key={s.id} value={s.id}>
              {s.title ?? "Untitled"} ({fmtDate(s.date)})
            </option>
          ))}
        </select>
      </div>
      <MarkdownField label="Content (markdown) *" value={content} onChange={setContent} rows={8} />
      <FormActions onCancel={onCancel} saving={saving} />
    </form>
  );
}
