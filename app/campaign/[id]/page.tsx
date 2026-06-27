"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  BookOpen,
  Crown,
  User,
  UsersRound,
  Copy,
  Link as LinkIcon,
  Pencil,
  Check,
  X,
  UserMinus,
  Hourglass,
  LayoutDashboard,
  Download,
} from "lucide-react";
import { useCampaign } from "../../providers";
import { formatInviteCode } from "@/lib/inviteCode";
import { copyText } from "@/lib/clipboard";
import type { ParticipantView } from "@/lib/events";
import CombatTracker from "./CombatTracker";
import StorySection from "./StorySection";
import DicePanel, { type DicePanelRef } from "@/components/DicePanel";
import PlayerHUD from "@/components/PlayerHUD";
import DashboardSection from "@/components/DashboardSection";
import GlobalSearch from "@/components/GlobalSearch";
import AIDMSection from "@/components/ai/AIDMSection";

// Helper: retrieve session token from localStorage (same key as providers.tsx)
function getStoredToken(campaignId: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    const all = JSON.parse(localStorage.getItem("dnd.sessions") ?? "{}") as Record<string, { token: string }>;
    return all[campaignId]?.token ?? null;
  } catch { return null; }
}

export default function LobbyPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { state, me, resume, renameCampaign, removeParticipant, leave, toast } = useCampaign();
  const [activeTab, setActiveTab] = useState<"campaign" | "dashboard">("campaign");
  const dicePanelRef = useRef<DicePanelRef | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);

  useEffect(() => {
    // Resume the live socket for this campaign; if we have no stored seat, send to /join.
    if (!resume(id)) router.replace("/join");
  }, [id, resume, router]);

  useEffect(() => {
    if (state?.campaignId === id) {
      setSessionToken(getStoredToken(id));
    }
  }, [state, id]);

  if (!state || state.campaignId !== id) {
    return (
      <main className="min-h-dvh grid place-items-center p-6">
        <p className="text-muted">Loading campaign…</p>
      </main>
    );
  }

  const isDM = me?.role === "dm";

  // Find my claimed character (player HUD)
  const myParticipant = state.participants.find((p) => p.sessionId === me?.sessionId);
  const myCharacterId = myParticipant?.characterId ?? null;

  return (
    <>
      {/* Player Quick-View HUD (shown when player has claimed a character) */}
      {!isDM && myCharacterId && sessionToken && (
        <PlayerHUD
          characterId={myCharacterId}
          sessionToken={sessionToken}
          dicePanelRef={dicePanelRef}
          onToast={toast}
        />
      )}

      <main className="min-h-dvh max-w-5xl mx-auto p-6 space-y-8">
        <div className="flex items-center justify-between">
          <button
            onClick={leave}
            className="text-muted hover:text-text text-sm flex items-center gap-1 w-fit"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden /> Leave
          </button>
          <div className="flex items-center gap-4">
            {/* Global Search */}
            {sessionToken && (
              <GlobalSearch
                sessionToken={sessionToken}
                onNavigate={(item) => toast(`${item.name} — navigate to ${item.type}`, "success")}
              />
            )}
            <Link
              href="/characters"
              className="text-muted hover:text-accent text-sm flex items-center gap-1.5 w-fit"
            >
              <User className="w-4 h-4" aria-hidden /> ตัวละคร
            </Link>
            <Link
              href="/reference"
              className="text-muted hover:text-accent text-sm flex items-center gap-1.5 w-fit"
            >
              <BookOpen className="w-4 h-4" aria-hidden /> Reference
            </Link>
            {isDM && (
              <button
                onClick={() => setActiveTab((t) => t === "dashboard" ? "campaign" : "dashboard")}
                className={`text-sm flex items-center gap-1.5 w-fit ${activeTab === "dashboard" ? "text-accent" : "text-muted hover:text-accent"}`}
              >
                <LayoutDashboard className="w-4 h-4" aria-hidden />
                Dashboard
              </button>
            )}
          </div>
        </div>

        {isDM && activeTab === "dashboard" && sessionToken ? (
          <DashboardSection
            sessionToken={sessionToken}
            onNavigateToCombat={() => setActiveTab("campaign")}
            onNavigateToStory={() => setActiveTab("campaign")}
          />
        ) : (
          <>
            <CampaignHeader
              name={state.name}
              isDM={isDM}
              onRename={async (next) => {
                const r = await renameCampaign(next);
                if (r.ok) toast("Campaign renamed", "success");
                else if (!r.ok) toast(r.message ?? "Could not rename", "danger");
              }}
            />

            {isDM && <InviteHero inviteCode={state.inviteCode} campaignId={id} toast={toast} />}

            <Roster
              participants={state.participants}
              isDM={isDM}
              meSessionId={me?.sessionId}
              onRemove={async (sessionId, name) => {
                const r = await removeParticipant(sessionId);
                if (r.ok) toast(`${name} removed`, "warning");
                else if (!r.ok) toast(r.message ?? "Could not remove", "danger");
              }}
            />

            {/* Combat tracker — Sprint 4 */}
            <CombatTracker campaignId={id} />

            {/* Story hub — Sprint 5 */}
            <StorySection campaignId={id} />

            {/* AI DM Assistant — Sprint 7 (DM-only; self-guards) */}
            {isDM && <AIDMSection campaignId={id} />}
          </>
        )}
      </main>

      {/* Dice panel — always rendered, floating FAB */}
      <DicePanel isDM={isDM} onRef={(ref) => { dicePanelRef.current = ref; }} />
    </>
  );
}

function CampaignHeader({
  name,
  isDM,
  onRename,
}: {
  name: string;
  isDM: boolean;
  onRename: (next: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);

  if (editing) {
    return (
      <div className="flex items-center gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={60}
          autoFocus
          className="text-2xl font-semibold rounded-md bg-bg border border-border px-3 py-1"
        />
        <button
          onClick={() => {
            if (draft.trim()) onRename(draft.trim());
            setEditing(false);
          }}
          className="text-success hover:opacity-80"
          aria-label="Save name"
        >
          <Check className="w-5 h-5" />
        </button>
        <button
          onClick={() => {
            setDraft(name);
            setEditing(false);
          }}
          className="text-muted hover:text-text"
          aria-label="Cancel"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <h2 className="text-2xl font-semibold">{name}</h2>
      {isDM && (
        <button
          onClick={() => {
            setDraft(name);
            setEditing(true);
          }}
          className="text-muted hover:text-accent"
          aria-label="Rename campaign"
        >
          <Pencil className="w-4 h-4" />
        </button>
      )}
      <span
        className={`ml-auto text-xs rounded-full px-2 py-1 border ${
          isDM ? "border-accent text-accent" : "border-arcane text-arcane"
        }`}
      >
        {isDM ? "Dungeon Master" : "Player"}
      </span>
    </div>
  );
}

function InviteHero({
  inviteCode,
  campaignId,
  toast,
}: {
  inviteCode: string;
  campaignId: string;
  toast: (msg: string, kind?: "success" | "warning" | "danger") => void;
}) {
  const [joinUrl, setJoinUrl] = useState(
    typeof window !== "undefined" ? window.location.origin : "",
  );
  const [exporting, setExporting] = useState(false);
  useEffect(() => {
    fetch("/api/host")
      .then((r) => r.json())
      .then((d) => { if (d?.url) setJoinUrl(d.url); })
      .catch(() => {});
  }, []);
  const copy = async (text: string, msg: string) => {
    const ok = await copyText(text);
    toast(ok ? msg : "Couldn't copy — long-press to select it", ok ? "success" : "warning");
  };
  const handleExport = async () => {
    setExporting(true);
    try {
      const token = (() => {
        try {
          const all = JSON.parse(localStorage.getItem("dnd.sessions") ?? "{}") as Record<string, { token: string }>;
          return all[campaignId]?.token ?? "";
        } catch { return ""; }
      })();
      const res = await fetch(`/api/campaigns/${campaignId}/export`, {
        headers: { authorization: `Bearer ${token}` },
      });
      if (!res.ok) { toast("Export ไม่สำเร็จ", "danger"); return; }
      const blob = await res.blob();
      const cd = res.headers.get("content-disposition") ?? "";
      const match = /filename="([^"]+)"/.exec(cd);
      const filename = match?.[1] ?? `campaign-${campaignId}.json`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = filename; a.click();
      URL.revokeObjectURL(url);
      toast("Export สำเร็จ — ไฟล์ถูก download แล้ว", "success");
    } catch {
      toast("Export ไม่สำเร็จ", "danger");
    } finally {
      setExporting(false);
    }
  };
  return (
    <section className="rounded-lg bg-surface-raised border border-border p-6 text-center">
      <p className="text-muted text-sm mb-2">Invite code — read it out to your table</p>
      <p className="font-mono tnum text-5xl sm:text-6xl tracking-[0.15em] text-accent select-all">
        {formatInviteCode(inviteCode)}
      </p>
      <div className="mt-4 flex flex-wrap items-center justify-center gap-4 text-sm">
        <button
          onClick={() => copy(inviteCode, "Code copied")}
          className="inline-flex items-center gap-1 text-muted hover:text-text rounded px-2 py-1"
        >
          <Copy className="w-4 h-4" aria-hidden /> Copy code
        </button>
        <span className="text-faint">·</span>
        <span className="inline-flex items-center gap-1 text-muted">
          <LinkIcon className="w-4 h-4" aria-hidden />
          <span className="font-mono">{joinUrl}</span>
          <button onClick={() => copy(joinUrl, "Link copied")} className="hover:text-text" aria-label="Copy link">
            <Copy className="w-3.5 h-3.5" />
          </button>
        </span>
        <span className="text-faint">·</span>
        <button
          onClick={handleExport}
          disabled={exporting}
          className="inline-flex items-center gap-1 text-muted hover:text-text rounded px-2 py-1 disabled:opacity-50"
          aria-label="Export campaign backup"
        >
          <Download className="w-4 h-4" aria-hidden />
          {exporting ? "กำลัง export…" : "Export backup"}
        </button>
      </div>
      <p className="text-faint text-xs mt-2">Players join on this Wi-Fi.</p>
    </section>
  );
}

function Roster({
  participants,
  isDM,
  meSessionId,
  onRemove,
}: {
  participants: ParticipantView[];
  isDM: boolean;
  meSessionId?: string;
  onRemove: (sessionId: string, name: string) => void;
}) {
  const [confirm, setConfirm] = useState<{ sessionId: string; name: string } | null>(null);
  const online = participants.filter((p) => p.isConnected).length;
  const onlyDM = participants.filter((p) => p.sessionId !== meSessionId).every((p) => p.role === "dm");
  const isPlayerWaiting = !isDM && onlyDM;

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <UsersRound className="w-5 h-5 text-muted" aria-hidden /> Party
        </h3>
        <span className="text-sm text-muted tnum">
          {online} online · {participants.length} total
        </span>
      </div>

      <ul className="space-y-2">
        {participants.map((p) => (
          <li
            key={p.sessionId}
            className="flex items-center gap-3 rounded-md border border-border bg-surface px-4 py-3"
          >
            <span
              className={`flex items-center gap-1.5 text-xs ${p.isConnected ? "text-success" : "text-faint"}`}
            >
              <span
                className={`inline-block w-2.5 h-2.5 rounded-full ${
                  p.isConnected ? "bg-success" : "border border-faint"
                }`}
                aria-hidden
              />
              {p.isConnected ? "online" : "offline"}
            </span>
            {p.role === "dm" ? (
              <Crown className="w-4 h-4 text-accent" aria-hidden />
            ) : (
              <User className="w-4 h-4 text-muted" aria-hidden />
            )}
            <span className="font-medium">
              {p.displayName}
              {p.sessionId === meSessionId && <span className="text-faint text-xs"> (you)</span>}
            </span>
            <span
              className={`text-xs rounded-full px-2 py-0.5 border ${
                p.role === "dm" ? "border-accent/40 text-accent" : "border-arcane/40 text-arcane"
              }`}
            >
              {p.role === "dm" ? "DM" : "Player"}
            </span>
            {isDM && p.role !== "dm" && (
              <button
                onClick={() => setConfirm({ sessionId: p.sessionId, name: p.displayName })}
                className="ml-auto text-muted hover:text-danger"
                aria-label={`Remove ${p.displayName}`}
              >
                <UserMinus className="w-4 h-4" />
              </button>
            )}
          </li>
        ))}
      </ul>

      {isPlayerWaiting && (
        <div className="mt-6 rounded-lg border border-dashed border-border bg-surface p-8 text-center">
          <Hourglass className="w-7 h-7 text-muted mx-auto" aria-hidden />
          <p className="mt-3 text-muted">You&apos;re in. Waiting for the DM to start the session.</p>
        </div>
      )}

      {confirm && (
        <ConfirmDialog
          message={`Remove ${confirm.name} from the campaign? They'll be returned to the landing page.`}
          onCancel={() => setConfirm(null)}
          onConfirm={() => {
            onRemove(confirm.sessionId, confirm.name);
            setConfirm(null);
          }}
        />
      )}
    </section>
  );
}

function ConfirmDialog({
  message,
  onConfirm,
  onCancel,
}: {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/50" onClick={onCancel} />
      <div
        role="dialog"
        aria-modal="true"
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] max-w-sm rounded-lg border border-border bg-surface p-6"
      >
        <h4 className="text-lg font-semibold">Remove participant?</h4>
        <p className="text-muted text-sm mt-2">{message}</p>
        <div className="mt-5 flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="rounded-md border border-border px-4 py-2 text-sm hover:bg-surface-raised"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="rounded-md bg-danger text-white px-4 py-2 text-sm font-semibold hover:opacity-90"
          >
            Remove
          </button>
        </div>
      </div>
    </div>
  );
}
