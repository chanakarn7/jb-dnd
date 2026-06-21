"use client";
// File: components/DicePanel.tsx
// Floating FAB (bottom-right gold circle) + slide-out 320px history panel.
// 3D roll: doRoll() opens the tray (Dice3D.start) + emits; on the authoritative dice:result
// socket event, Dice3D.play() drops dice FORCED to the server's exact faces and reveals the
// chip once they settle. The displayed number always matches the dice that came to rest.

import { useEffect, useRef, useState, useCallback, lazy, Suspense } from "react";
import { X, Dice6 } from "lucide-react";
import { useCampaign } from "@/app/providers";
import type { DiceRollView } from "@/lib/player-ui/types";
import type { Dice3DHandle } from "./Dice3D";

const Dice3D = lazy(() => import("./Dice3D"));

const DIE_TYPES = ["d4", "d6", "d8", "d10", "d12", "d20", "d100"] as const;
const MODE_OPTIONS = [
  { value: "normal", label: "Normal" },
  { value: "advantage", label: "Adv" },
  { value: "disadvantage", label: "Disadv" },
] as const;

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  return `${Math.floor(s / 3600)}h`;
}

const STANDARD_SIDES = [4, 6, 8, 10, 12, 20, 100];

/** Decide what physical dice to roll for a formula+mode, or null if the 3D dice can't
 *  represent it (non-standard sides) — caller then falls back to a server-side roll. */
function rollSpec(formula: string, mode: string): { count: number; sides: number } | null {
  if (mode === "advantage" || mode === "disadvantage") return { count: 2, sides: 20 };
  const m = /^(\d+)?[dD](\d+)/.exec(formula.trim());
  if (!m) return null;
  const count = m[1] ? parseInt(m[1], 10) : 1;
  const sides = parseInt(m[2], 10);
  if (!STANDARD_SIDES.includes(sides) || count < 1 || count > 50) return null;
  return { count, sides };
}

/** Build the chip payload from an authoritative server roll. */
function toChipPayload(roll: { result: number; rolls: number[]; keptRoll?: number | null; mode: string; playerName?: string; context?: string | null }) {
  return {
    total: roll.result,
    rolls: roll.rolls,
    kept: roll.keptRoll ?? undefined,
    playerName: roll.playerName,
    context: roll.context,
    mode: roll.mode,
  };
}

interface Props {
  isDM: boolean;
  onRef?: (ref: DicePanelRef) => void;
}

export interface DicePanelRef {
  quickRoll: (formula: string, context: string) => void;
}

export default function DicePanel({ isDM, onRef }: Props) {
  const { getSocket, toast, me } = useCampaign();
  const [open, setOpen] = useState(false);
  const [formula, setFormula] = useState("");
  const [context, setContext] = useState("");
  const [mode, setMode] = useState<"normal" | "advantage" | "disadvantage">("normal");
  const [isPrivate, setIsPrivate] = useState(false);
  const [feed, setFeed] = useState<DiceRollView[]>([]);
  const [rolling, setRolling] = useState(false);
  const feedRef = useRef<DiceRollView[]>([]);
  const dice3dRef = useRef<Dice3DHandle | null>(null);

  const addToFeed = useCallback((roll: DiceRollView) => {
    feedRef.current = [roll, ...feedRef.current].slice(0, 20);
    setFeed([...feedRef.current]);
  }, []);

  // ── Roll: physics dice ARE the RNG. Roll locally, send the faces to the server. ──
  const performRoll = useCallback(async (f: string, ctx: string | null) => {
    const socket = getSocket();
    if (!socket) return;
    const trimmed = f.trim();
    if (!trimmed) return;
    const event = isPrivate ? "dice:rollPrivate" : "dice:roll";
    const spec = rollSpec(trimmed, mode);

    if (spec && dice3dRef.current) {
      // Roll the 3D dice; the faces they land on are the result we send to the server.
      const faces = await dice3dRef.current.roll(spec);
      if (faces.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (socket as any).emit(event, { formula: trimmed, context: ctx, mode, clientRolls: faces });
        return;
      }
      // No WebGL / empty faces → fall through to a server-side roll.
      dice3dRef.current.clear();
    }
    // Fallback (non-standard dice or no 3D): let the server roll, show chip only.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (socket as any).emit(event, { formula: trimmed, context: ctx, mode });
  }, [getSocket, isPrivate, mode]);

  const doRoll = useCallback((f: string) => {
    if (rolling) return;
    setRolling(true);
    void performRoll(f, context.trim() || null).finally(() => {
      setTimeout(() => setRolling(false), 300);
    });
  }, [rolling, performRoll, context]);

  const handleRoll = () => doRoll(formula);

  // ── quickRoll (from PlayerHUD ability chips / initiative) ────────────────
  const quickRoll = useCallback((f: string, ctx: string) => {
    setFormula(f);
    setContext(ctx);
    void performRoll(f, ctx);
  }, [performRoll]);

  useEffect(() => {
    if (onRef) onRef({ quickRoll });
  }, [onRef, quickRoll]);

  // ── Socket listeners ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!me) return;
    const socket = getSocket();
    if (!socket) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (socket as any).emit("dice:feed");

    const onFeedResult = (payload: { rolls: DiceRollView[] }) => {
      feedRef.current = payload.rolls;
      setFeed([...feedRef.current]);
    };

    const onResult = (payload: { roll: DiceRollView }) => {
      addToFeed(payload.roll);
      const chip = toChipPayload(payload.roll);
      if (payload.roll.playerSessionId === me.sessionId) {
        // Our own roll — the physics dice are already on the table; reveal the chip over them.
        dice3dRef.current?.reveal(chip);
      } else {
        // Someone else rolled — open the tray with just the chip (no local physics).
        dice3dRef.current?.showRemote(chip);
      }
    };

    const onPrivateResult = (payload: { roll: Omit<DiceRollView, "id" | "createdAt"> }) => {
      // DM-only private roll — our own dice are on the table; reveal labelled 🔒
      dice3dRef.current?.reveal(
        toChipPayload({
          ...payload.roll,
          playerName: "DM",
          context: payload.roll.context ? `🔒 ${payload.roll.context}` : "🔒 Private",
        }),
      );
    };

    const onError = (payload: { error: string }) => {
      // Server rejected the roll — close the tray and surface the reason.
      dice3dRef.current?.clear();
      toast(`Dice: ${payload.error}`, "danger");
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const s = socket as any;
    s.on("dice:feedResult", onFeedResult);
    s.on("dice:result", onResult);
    s.on("dice:privateResult", onPrivateResult);
    s.on("dice:error", onError);

    return () => {
      s.off("dice:feedResult", onFeedResult);
      s.off("dice:result", onResult);
      s.off("dice:privateResult", onPrivateResult);
      s.off("dice:error", onError);
    };
  }, [me, getSocket, addToFeed, toast]);

  return (
    <>
      {/* 3D roll modal — fullscreen canvas, hidden until roll fires */}
      <Suspense fallback={null}>
        <Dice3D ref={dice3dRef} />
      </Suspense>

      {/* Floating FAB */}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Open dice panel"
        className={`fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all ${
          rolling
            ? "bg-accent-hover scale-110 animate-pulse"
            : "bg-accent hover:bg-accent-hover hover:scale-105"
        } text-bg`}
      >
        <Dice6 className="w-7 h-7" />
      </button>

      {/* Backdrop */}
      {open && (
        <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden />
      )}

      {/* Slide-out history panel */}
      <div
        role="dialog"
        aria-label="Dice Roller"
        className={`fixed top-0 right-0 z-50 h-full w-80 bg-surface border-l border-border flex flex-col shadow-2xl transition-transform duration-200 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <span className="font-display text-sm font-semibold text-text">Dice Roller</span>
          <button onClick={() => setOpen(false)} aria-label="Close" className="text-muted hover:text-text">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Controls */}
        <div className="p-4 space-y-3 border-b border-border">

          {/* Die quick-buttons */}
          <div className="grid grid-cols-4 gap-1.5">
            {DIE_TYPES.map((d) => (
              <button
                key={d}
                onClick={() => { setFormula(d); doRoll(d); }}
                className="rounded border border-border bg-surface-raised text-accent text-xs font-mono py-1.5 hover:border-accent hover:scale-105 active:scale-95 transition-all"
              >
                {d}
              </button>
            ))}
          </div>

          {/* Custom formula */}
          <div className="flex gap-2">
            <input
              type="text"
              value={formula}
              onChange={(e) => setFormula(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleRoll()}
              placeholder="2d6+3"
              maxLength={100}
              className="flex-1 rounded-md border border-border bg-bg px-3 py-1.5 text-sm font-mono focus:border-accent focus:outline-none"
              aria-label="Dice formula"
            />
            <button
              onClick={handleRoll}
              disabled={rolling}
              className="rounded-md bg-accent text-bg px-3 py-1.5 text-sm font-semibold hover:bg-accent-hover disabled:opacity-50 transition-colors"
            >
              {rolling ? "…" : "Roll"}
            </button>
          </div>

          {/* Context label */}
          <input
            type="text"
            value={context}
            onChange={(e) => setContext(e.target.value)}
            placeholder="Attack, Skill, Save…"
            maxLength={80}
            className="w-full rounded-md border border-border bg-bg px-3 py-1.5 text-sm focus:border-accent focus:outline-none"
            aria-label="Context label"
          />

          {/* Mode pills */}
          <div className="flex gap-1">
            {MODE_OPTIONS.map((m) => (
              <button
                key={m.value}
                onClick={() => setMode(m.value)}
                className={`flex-1 rounded text-xs py-1 border transition-colors ${
                  mode === m.value
                    ? "bg-accent text-bg border-accent font-semibold"
                    : "border-border text-muted hover:text-text"
                }`}
                aria-pressed={mode === m.value}
              >
                {m.label}
              </button>
            ))}
          </div>

          {/* Private toggle — DM only */}
          {isDM && (
            <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isPrivate}
                onChange={(e) => setIsPrivate(e.target.checked)}
                className="accent-accent w-4 h-4"
              />
              <span className="text-muted">Private (DM only)</span>
            </label>
          )}
        </div>

        {/* Roll feed */}
        <div className="flex-1 overflow-y-auto p-4">
          <p className="text-[10px] text-faint font-display uppercase tracking-wider mb-2">Recent Rolls</p>
          {feed.length === 0 && (
            <p className="text-xs text-faint text-center py-6">No rolls yet.</p>
          )}
          <div className="space-y-0">
            {feed.map((roll, idx) => (
              <FeedRow key={roll.id ?? idx} roll={roll} />
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

function FeedRow({ roll }: { roll: DiceRollView }) {
  const isDMRoll = roll.playerName.toLowerCase().includes("dm");
  return (
    <div className="flex items-start gap-2 text-xs py-1.5 border-b border-border/30 last:border-0">
      <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${isDMRoll ? "bg-arcane/20 text-arcane" : "bg-surface-raised text-muted"}`}>
        {roll.playerName}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-1.5">
          <span className="font-mono text-accent font-bold text-sm">{roll.result}</span>
          <span className="text-faint font-mono">{roll.formula}</span>
          {roll.context && <span className="text-muted truncate">{roll.context}</span>}
        </div>
        {(roll.mode === "advantage" || roll.mode === "disadvantage") && roll.keptRoll != null && (
          <div className="font-mono text-faint text-[10px]">
            kept: <span className="text-accent">{roll.keptRoll}</span>
            {roll.rolls.length === 2 && (
              <> · dropped: <span className="line-through">{roll.rolls.find((r) => r !== roll.keptRoll) ?? ""}</span></>
            )}
          </div>
        )}
      </div>
      {roll.createdAt && (
        <span className="shrink-0 text-faint">{timeAgo(roll.createdAt)}</span>
      )}
    </div>
  );
}

export { };
