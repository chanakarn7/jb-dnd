"use client";
// File: components/DashboardSection.tsx
// DM-only section. Fetches GET /api/dashboard for stats, quests, roster, last session.
// Non-DMs see nothing (403 handled by not rendering).

import { useEffect, useState } from "react";
import { Users, Scroll, CalendarDays, Star, Skull, RefreshCw } from "lucide-react";
import type { DashboardSnapshot } from "@/lib/player-ui/types";

interface Props {
  sessionToken: string;
  onNavigateToCombat?: () => void;
  onNavigateToStory?: () => void;
}

export default function DashboardSection({ sessionToken, onNavigateToCombat, onNavigateToStory }: Props) {
  const [data, setData] = useState<DashboardSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = async () => {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/dashboard", {
      headers: { Authorization: `Bearer ${sessionToken}` },
    });
    if (!res.ok) { setError("Failed to load dashboard"); setLoading(false); return; }
    const body = (await res.json()) as { dashboard: DashboardSnapshot };
    setData(body.dashboard);
    setLoading(false);
  };

  useEffect(() => { void fetchDashboard(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <DashboardSkeleton />;
  if (error) return (
    <div className="rounded-lg border border-border bg-surface p-6 text-center">
      <p className="text-muted text-sm">{error}</p>
      <button onClick={fetchDashboard} className="mt-2 text-accent text-sm flex items-center gap-1 mx-auto hover:opacity-80">
        <RefreshCw className="w-3 h-3" /> Retry
      </button>
    </div>
  );
  if (!data) return null;

  return (
    <section className="space-y-6">
      <h3 className="font-display text-lg font-semibold text-text">Campaign Dashboard</h3>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard icon={<Users className="w-4 h-4 text-arcane" />} label="Players" value={data.playerCount} />
        <StatCard icon={<Scroll className="w-4 h-4 text-accent" />} label="Active Quests" value={data.activeQuestCount} />
        <StatCard icon={<CalendarDays className="w-4 h-4 text-muted" />} label="Sessions" value={data.sessionCount} />
        <StatCard icon={<Star className="w-4 h-4 text-success" />} label="Total XP" value={data.totalXp.toLocaleString()} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left: quests + last session + CTAs */}
        <div className="lg:col-span-3 space-y-4">
          {/* Active Quests */}
          <div className="rounded-lg border border-border bg-surface p-4">
            <h4 className="font-display text-sm font-semibold border-l-2 border-accent pl-2 mb-3">Active Quests</h4>
            {data.activeQuests.length === 0 ? (
              <p className="text-muted text-sm text-center py-4">No active quests.</p>
            ) : (
              <div className="space-y-3">
                {data.activeQuests.map((q) => {
                  const pct = q.objectivesTotal > 0 ? (q.objectivesChecked / q.objectivesTotal) * 100 : 0;
                  return (
                    <div key={q.id}>
                      <div className="flex items-baseline justify-between mb-1">
                        <span className="text-sm font-medium text-text">{q.name}</span>
                        <span className="text-xs font-mono text-faint">{q.objectivesChecked}/{q.objectivesTotal}</span>
                      </div>
                      {q.giverName && <p className="text-xs text-muted mb-1">from {q.giverName}</p>}
                      <div className="h-1.5 rounded-full bg-surface-raised overflow-hidden">
                        <div className="h-full bg-accent rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Last Session */}
          <div className="rounded-lg border border-border bg-surface-raised p-4">
            <h4 className="font-display text-sm font-semibold text-accent mb-2">Last Session</h4>
            {!data.lastSession ? (
              <p className="text-muted text-sm">No sessions logged yet.</p>
            ) : (
              <>
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="text-sm font-medium text-text">{data.lastSession.title ?? "Untitled"}</span>
                  <span className="text-xs font-mono text-arcane bg-arcane/10 rounded px-1.5 py-0.5">{data.lastSession.xpAwarded} XP</span>
                </div>
                <p className="text-xs font-mono text-faint mb-1">{new Date(data.lastSession.date).toLocaleDateString()}</p>
                {data.lastSession.summary && (
                  <p className="text-xs text-muted line-clamp-2">{data.lastSession.summary}</p>
                )}
              </>
            )}
          </div>

          {/* Quick-start CTAs */}
          <div className="flex gap-3">
            <button
              onClick={onNavigateToCombat}
              className="flex-1 rounded-md bg-accent text-bg py-2 text-sm font-semibold hover:bg-accent-hover transition-colors"
            >
              ▶ Start Encounter
            </button>
            <button
              onClick={onNavigateToStory}
              className="flex-1 rounded-md border border-border bg-surface-raised text-text py-2 text-sm hover:bg-surface transition-colors"
            >
              📋 Log Session
            </button>
          </div>
        </div>

        {/* Right: Party roster */}
        <div className="lg:col-span-2">
          <div className="rounded-lg border border-border bg-surface p-4 h-full">
            <h4 className="font-display text-sm font-semibold mb-3">Party Roster</h4>
            {data.roster.length === 0 ? (
              <p className="text-muted text-sm text-center py-4">No characters in campaign yet.</p>
            ) : (
              <div className="space-y-3">
                {data.roster.map((r) => {
                  const pct = r.maxHp > 0 ? (r.currentHp / r.maxHp) * 100 : 0;
                  const isDead = r.currentHp === 0;
                  const barColor = isDead ? "bg-danger" : pct < 25 ? "bg-danger" : pct < 50 ? "bg-warning" : "bg-success";
                  return (
                    <div key={r.characterId} className="rounded border border-border bg-surface-raised px-3 py-2">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5">
                          {isDead && <Skull className="w-3 h-3 text-danger" aria-label="Unconscious" />}
                          <span className="text-sm font-medium text-text">{r.characterName}</span>
                          <span className="text-xs text-muted">{r.classSlug} {r.level}</span>
                        </div>
                        <span className={`text-xs font-mono ${isDead ? "text-danger" : "text-muted"}`}>
                          {r.currentHp}/{r.maxHp} HP
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-surface overflow-hidden mb-1">
                        <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
                      </div>
                      {r.conditions.length > 0 && (
                        <div className="flex gap-1 flex-wrap mt-1">
                          {r.conditions.slice(0, 2).map((c) => (
                            <span key={c} className="text-[10px] rounded px-1 py-0.5 bg-danger/15 text-danger">{c}</span>
                          ))}
                          {r.conditions.length > 2 && (
                            <span className="text-[10px] text-faint">+{r.conditions.length - 2} more</span>
                          )}
                        </div>
                      )}
                      {r.conditions.length === 0 && <span className="text-[10px] text-faint">—</span>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number | string }) {
  return (
    <div className="rounded-lg border border-border bg-surface-raised p-4 flex items-start gap-3">
      <div className="mt-0.5">{icon}</div>
      <div>
        <p className="text-xs text-faint font-display uppercase tracking-wide">{label}</p>
        <p className="text-xl font-mono font-bold text-text">{value}</p>
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-6 w-48 rounded bg-surface-raised" />
      <div className="grid grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((i) => <div key={i} className="h-20 rounded-lg bg-surface-raised" />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3 space-y-4">
          <div className="h-32 rounded-lg bg-surface-raised" />
          <div className="h-24 rounded-lg bg-surface-raised" />
        </div>
        <div className="lg:col-span-2 h-48 rounded-lg bg-surface-raised" />
      </div>
    </div>
  );
}
