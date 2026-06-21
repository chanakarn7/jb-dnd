"use client";
// File: components/Dice3D.tsx
// Centered dice-roll modal — a fixed-size "rolling tray" holds the 3D DiceBox canvas.
//
// The 3D dice ARE the random number generator (user's choice): the client rolls real
// physics, reads the faces they land on, and sends those to the server to persist +
// broadcast. So the number shown ALWAYS matches the dice on the table.
//
// API (driven by DicePanel):
//   roll(spec)   → physics-roll `count` dice of `sides`; resolves with the settled faces.
//                  Opens the tray, shows "ROLLING…", leaves the dice on the table.
//   reveal(p)    → show the result chip over the roller's own settled dice; auto-closes.
//   showRemote(p)→ open the tray + chip only (someone else rolled — no local physics).
//   clear()      → hide the tray.
//
// The tray is never unmounted (only hidden) so DiceBox keeps its live canvas across re-rolls.
// Assets live in /public/assets/dice-box/ (copied by postinstall → copyDiceAssets.js).

import { useEffect, useRef, useImperativeHandle, forwardRef, useState, useCallback } from "react";
import { X } from "lucide-react";

export interface RollSpec {
  count: number;
  sides: number;
}

export interface DiceResultPayload {
  total: number;
  rolls: number[];
  kept?: number;
  playerName?: string;
  context?: string | null;
  mode?: string;
}

export interface Dice3DHandle {
  /** Roll real physics dice; resolves with the faces they land on. */
  roll(spec: RollSpec): Promise<number[]>;
  /** Reveal the result chip over the roller's own dice. */
  reveal(payload: DiceResultPayload): void;
  /** Show the tray + chip for a roll made by someone else (no local physics). */
  showRemote(payload: DiceResultPayload): void;
  /** Hide the tray. */
  clear(): void;
}

const CANVAS_ID = "dice3d-canvas";

// ── DiceBox singleton ─────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let boxInstance: any = null;
let boxInitPromise: Promise<void> | null = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getDiceBox(): Promise<any> {
  if (boxInstance) return boxInstance;
  if (!boxInitPromise) {
    boxInitPromise = (async () => {
      try {
        const mod = await import("@3d-dice/dice-box");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const DiceBoxCtor = (mod as any).default ?? mod;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const box = new (DiceBoxCtor as any)(`#${CANVAS_ID}`, {
          assetPath: "/assets/dice-box/",
          theme: "default",
          gravity: 1.8,
          mass: 1,
          friction: 0.9,
          restitution: 0,
          angularDamping: 0.5,
          linearDamping: 0.5,
          settleTimeout: 2800,
          offscreen: true,
          delay: 12,
          startingHeight: 5,
          spinForce: 5,
          throwForce: 4,
          scale: 6,
          lightIntensity: 1.1,
          enableShadows: true,
          shadowTransparency: 0.6,
        });
        await box.init();
        boxInstance = box;
      } catch (e) {
        console.warn("[Dice3D] DiceBox init failed:", e);
        boxInitPromise = null;
      }
    })();
  }
  await boxInitPromise;
  return boxInstance;
}

/** Extract the rolled face values from a DiceBox onRollComplete results array. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function facesFromResults(results: any): number[] {
  if (!Array.isArray(results)) return [];
  const faces: number[] = [];
  for (const group of results) {
    const groupRolls = group?.rolls;
    if (Array.isArray(groupRolls)) {
      for (const r of groupRolls) {
        if (typeof r?.value === "number") faces.push(r.value);
      }
    } else if (typeof group?.value === "number") {
      faces.push(group.value);
    }
  }
  return faces;
}

const Dice3D = forwardRef<Dice3DHandle>(function Dice3D(_props, ref) {
  const [visible, setVisible] = useState(false);
  const [rolling, setRolling] = useState(false);
  const [result, setResult] = useState<DiceResultPayload | null>(null);
  const autoCloseRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (autoCloseRef.current) clearTimeout(autoCloseRef.current);
  }, []);

  const doClose = useCallback(() => {
    if (autoCloseRef.current) { clearTimeout(autoCloseRef.current); autoCloseRef.current = null; }
    setVisible(false);
    setResult(null);
    setRolling(false);
    boxInstance?.clear?.();
  }, []);

  const armAutoClose = useCallback(() => {
    if (autoCloseRef.current) clearTimeout(autoCloseRef.current);
    autoCloseRef.current = setTimeout(doClose, 4500);
  }, [doClose]);

  useImperativeHandle(ref, () => ({
    roll(spec: RollSpec): Promise<number[]> {
      if (autoCloseRef.current) { clearTimeout(autoCloseRef.current); autoCloseRef.current = null; }
      setResult(null);
      setRolling(true);
      setVisible(true);

      return new Promise<number[]>((resolve) => {
        // Two RAFs so the (possibly just-shown) tray has a real layout box first.
        requestAnimationFrame(() => requestAnimationFrame(async () => {
          const box = await getDiceBox();
          if (!box) { resolve([]); return; } // no WebGL → caller falls back to server RNG
          try {
            box.resize?.();
            box.clear();
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            box.onRollComplete = (results: any) => resolve(facesFromResults(results));
            // Object notation, no forced value — let physics decide the faces.
            await box.roll([{ qty: spec.count, sides: spec.sides }]);
          } catch (e) {
            console.warn("[Dice3D] physics roll failed:", e);
            resolve([]);
          }
        }));
      });
    },

    reveal(payload: DiceResultPayload) {
      setRolling(false);
      setResult(payload);
      setVisible(true);
      armAutoClose();
    },

    showRemote(payload: DiceResultPayload) {
      // Someone else rolled — open the tray with the chip; no local physics dice.
      boxInstance?.clear?.();
      setRolling(false);
      setResult(payload);
      setVisible(true);
      armAutoClose();
    },

    clear() { doClose(); },
  }), [doClose, armAutoClose]);

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 60,
        display: "flex", alignItems: "center", justifyContent: "center",
        visibility: visible ? "visible" : "hidden",
        pointerEvents: visible ? "auto" : "none",
      }}
      onClick={result ? doClose : undefined}
    >
      {/* Backdrop scrim */}
      <div style={{
        position: "absolute", inset: 0,
        background: "rgba(5,7,11,0.72)", backdropFilter: "blur(3px)",
        opacity: visible ? 1 : 0, transition: "opacity 0.18s ease",
      }} />

      {/* Rolling tray — always mounted so DiceBox keeps its canvas across re-rolls */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "relative",
          width: "min(92vw, 540px)",
          height: "min(70vh, 420px)",
          borderRadius: "18px",
          overflow: "hidden",
          border: "1px solid rgba(217,164,65,0.35)",
          boxShadow: "0 24px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(0,0,0,0.4)",
          background: "radial-gradient(ellipse at 50% 40%, #1c2433 0%, #0d1119 72%, #080b11 100%)",
          transform: visible ? "scale(1)" : "scale(0.94)",
          opacity: visible ? 1 : 0,
          transition: "transform 0.18s ease-out, opacity 0.18s ease-out",
        }}
      >
        {/* DiceBox canvas target — fills the tray */}
        <div id={CANVAS_ID} aria-hidden style={{ position: "absolute", inset: 0, pointerEvents: "none" }} />

        {/* Close button */}
        <button
          onClick={doClose}
          aria-label="Close dice view"
          style={{
            position: "absolute", top: "10px", right: "10px", zIndex: 3,
            background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: "8px", padding: "6px", color: "#94A3B8", cursor: "pointer", lineHeight: 0,
          }}
        >
          <X size={16} />
        </button>

        {/* Top overlay: rolling pill or result chip */}
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, zIndex: 2,
          display: "flex", justifyContent: "center", paddingTop: "16px", pointerEvents: "none",
        }}>
          {rolling && !result && <RollingPill />}
          {result && <ResultChip result={result} />}
        </div>
      </div>
    </div>
  );
});

Dice3D.displayName = "Dice3D";
export default Dice3D;

// ── Sub-components ────────────────────────────────────────────────────────────

function RollingPill() {
  return (
    <div style={{
      background: "rgba(11,14,20,0.8)", border: "1px solid rgba(217,164,65,0.35)",
      borderRadius: "999px", padding: "7px 20px", color: "#D9A441",
      fontFamily: "var(--font-jetbrains-mono, 'JetBrains Mono', monospace)",
      fontSize: "12px", fontWeight: 600, letterSpacing: "0.08em",
      animation: "rollingPulse 1.2s ease-in-out infinite", backdropFilter: "blur(8px)",
    }}>
      ROLLING…
    </div>
  );
}

function ResultChip({ result }: { result: DiceResultPayload }) {
  const droppedRoll =
    result.kept != null && result.rolls.length === 2
      ? result.rolls.find((r) => r !== result.kept)
      : undefined;
  const isAdvDisadv = result.mode === "advantage" || result.mode === "disadvantage";

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px", animation: "chipIn 0.2s ease-out both" }}>
      {(result.playerName || result.context) && (
        <div style={{
          color: "#94A3B8", fontSize: "11px",
          fontFamily: "var(--font-inter, Inter, sans-serif)", letterSpacing: "0.04em",
          background: "rgba(11,14,20,0.65)", padding: "3px 12px", borderRadius: "999px", backdropFilter: "blur(4px)",
        }}>
          {[result.playerName, result.context].filter(Boolean).join("  ·  ")}
        </div>
      )}
      <div style={{
        display: "flex", alignItems: "baseline", gap: "8px",
        background: "rgba(10,13,19,0.85)", border: "1px solid rgba(217,164,65,0.45)",
        borderRadius: "14px", padding: "10px 24px", backdropFilter: "blur(12px)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
      }}>
        {result.rolls.length > 0 && (
          <span style={{ fontFamily: "var(--font-jetbrains-mono, monospace)", fontSize: "18px", color: "#64748B" }}>
            {isAdvDisadv ? (
              <>
                <span style={{ color: "#D9A441" }}>{result.kept}</span>
                {droppedRoll !== undefined && (
                  <span style={{ textDecoration: "line-through", opacity: 0.45, marginLeft: "6px" }}>{droppedRoll}</span>
                )}
              </>
            ) : (
              result.rolls.join(",  ")
            )}
            {" = "}
          </span>
        )}
        <span style={{
          fontFamily: "var(--font-jetbrains-mono, monospace)",
          fontSize: "clamp(1.8rem, 5vw, 2.8rem)", fontWeight: 700, color: "#D9A441", lineHeight: 1,
        }}>
          {result.total}
        </span>
      </div>
      {isAdvDisadv && (
        <div style={{ fontSize: "9px", color: "#64748B", letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: "var(--font-inter, sans-serif)" }}>
          {result.mode === "advantage" ? "Advantage — kept highest" : "Disadvantage — kept lowest"}
        </div>
      )}
    </div>
  );
}
