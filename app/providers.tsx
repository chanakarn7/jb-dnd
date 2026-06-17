"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { io, type Socket } from "socket.io-client";
import {
  Wifi,
  WifiOff,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
} from "lucide-react";
import type {
  CampaignState,
  ClientToServerEvents,
  ServerToClientEvents,
  ParticipantView,
  SnapshotAck,
  OkAck,
  ErrorAck,
} from "@/lib/events";

type Conn = "connecting" | "connected" | "reconnecting";
type Sock = Socket<ServerToClientEvents, ClientToServerEvents>;
type Result = { ok: true; campaignId?: string } | { ok: false; code?: string; message?: string };
type ToastKind = "success" | "warning" | "danger";
interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
}

interface Me {
  sessionId: string;
  role: "dm" | "player";
}

interface Ctx {
  connection: Conn;
  state: CampaignState | null;
  me: Me | null;
  createCampaign: (campaignName: string, dmDisplayName: string) => Promise<Result>;
  joinCampaign: (inviteCode: string, displayName: string) => Promise<Result>;
  renameCampaign: (name: string) => Promise<Result>;
  removeParticipant: (sessionId: string) => Promise<Result>;
  leave: () => void;
  resume: (campaignId: string) => boolean;
  toast: (message: string, kind?: ToastKind) => void;
}

const CampaignContext = createContext<Ctx | null>(null);

// ---------- token persistence (localStorage; reconnect identity, not a password) ----------
const KEY = "dnd.sessions";
type Stored = Record<string, { token: string; role: "dm" | "player"; sessionId: string }>;
function loadTokens(): Stored {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}") as Stored;
  } catch {
    return {};
  }
}
function saveToken(campaignId: string, token: string, role: "dm" | "player", sessionId: string) {
  const all = loadTokens();
  all[campaignId] = { token, role, sessionId };
  localStorage.setItem(KEY, JSON.stringify(all));
}
function getToken(campaignId: string) {
  return loadTokens()[campaignId];
}
function clearToken(campaignId: string) {
  const all = loadTokens();
  delete all[campaignId];
  localStorage.setItem(KEY, JSON.stringify(all));
}

export function CampaignProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const socketRef = useRef<Sock | null>(null);
  const [connection, setConnection] = useState<Conn>("connecting");
  const [state, setState] = useState<CampaignState | null>(null);
  const stateRef = useRef<CampaignState | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const applyState = useCallback((s: CampaignState | null) => {
    stateRef.current = s;
    setState(s);
  }, []);

  const toast = useCallback((message: string, kind: ToastKind = "success") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, kind, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3800);
  }, []);

  const ensureSocket = useCallback(
    (authToken?: string): Sock => {
      if (socketRef.current) {
        if (authToken) {
          socketRef.current.auth = { sessionToken: authToken };
          if (!socketRef.current.connected) socketRef.current.connect();
        }
        return socketRef.current;
      }
      const s: Sock = io({
        auth: authToken ? { sessionToken: authToken } : {},
        autoConnect: true,
      });
      s.on("connect", () => setConnection("connected"));
      s.on("disconnect", () => setConnection("reconnecting"));
      s.io.on("reconnect_attempt", () => setConnection("reconnecting"));
      s.io.on("reconnect", () => setConnection("connected"));
      s.on("state:snapshot", (snap) => applyState(snap));
      s.on("roster:update", ({ participants }: { participants: ParticipantView[] }) =>
        applyState(stateRef.current ? { ...stateRef.current, participants } : stateRef.current),
      );
      s.on("state:patch", ({ path, value }) => {
        if (path === "name" && stateRef.current) {
          applyState({ ...stateRef.current, name: String(value) });
        }
      });
      s.on("session:kicked", ({ reason }) => {
        const cid = stateRef.current?.campaignId;
        if (cid) clearToken(cid);
        setMe(null);
        applyState(null);
        toast(reason, "warning");
        router.push("/");
      });
      s.on("error", (e) => toast(e.message, "danger"));
      socketRef.current = s;
      return s;
    },
    [applyState, router, toast],
  );

  const emitWithAck = useCallback(
    <P,>(
      event: keyof ClientToServerEvents,
      payload: P,
      onOk: (res: SnapshotAck) => Result,
    ): Promise<Result> =>
      new Promise((resolve) => {
        const s = ensureSocket();
        type AnyAck = SnapshotAck | OkAck | ErrorAck;
        // NOTE: bind to `s` — extracting `s.emit` into a variable loses its `this`,
        // and socket.io's emit reads `this.io._opts`, throwing on an unbound call.
        const emit = s.emit.bind(s) as unknown as (
          e: string,
          p: unknown,
          cb: (res: AnyAck) => void,
        ) => void;
        const send = () =>
          emit(event, payload, (res) => resolve(res.ok ? onOk(res as SnapshotAck) : res));
        if (s.connected) send();
        else s.once("connect", send);
      }),
    [ensureSocket],
  );

  const createCampaign = useCallback(
    (campaignName: string, dmDisplayName: string) =>
      emitWithAck("campaign:create", { campaignName, dmDisplayName }, (res) => {
        socketRef.current!.auth = { sessionToken: res.token };
        saveToken(res.state.campaignId, res.token, "dm", res.sessionId);
        setMe({ sessionId: res.sessionId, role: "dm" });
        applyState(res.state);
        return { ok: true, campaignId: res.state.campaignId };
      }),
    [emitWithAck, applyState],
  );

  const joinCampaign = useCallback(
    (inviteCode: string, displayName: string) =>
      emitWithAck("campaign:join", { inviteCode, displayName }, (res) => {
        socketRef.current!.auth = { sessionToken: res.token };
        saveToken(res.state.campaignId, res.token, "player", res.sessionId);
        setMe({ sessionId: res.sessionId, role: "player" });
        applyState(res.state);
        return { ok: true, campaignId: res.state.campaignId };
      }),
    [emitWithAck, applyState],
  );

  const renameCampaign = useCallback(
    (name: string) => emitWithAck("campaign:rename", { name }, () => ({ ok: true })),
    [emitWithAck],
  );

  const removeParticipant = useCallback(
    (sessionId: string) => emitWithAck("participant:remove", { sessionId }, () => ({ ok: true })),
    [emitWithAck],
  );

  const leave = useCallback(() => {
    const cid = stateRef.current?.campaignId;
    socketRef.current?.emit("session:leave");
    if (cid) clearToken(cid);
    setMe(null);
    applyState(null);
    router.push("/");
  }, [applyState, router]);

  const resume = useCallback(
    (campaignId: string): boolean => {
      if (stateRef.current?.campaignId === campaignId) return true;
      const stored = getToken(campaignId);
      if (!stored) return false;
      setMe({ sessionId: stored.sessionId, role: stored.role });
      ensureSocket(stored.token); // connects with auth -> server emits state:snapshot
      return true;
    },
    [ensureSocket],
  );

  useEffect(() => {
    return () => {
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, []);

  return (
    <CampaignContext.Provider
      value={{
        connection,
        state,
        me,
        createCampaign,
        joinCampaign,
        renameCampaign,
        removeParticipant,
        leave,
        resume,
        toast,
      }}
    >
      <ConnectionPill connection={connection} hasSocket={!!state} />
      {children}
      <Toaster toasts={toasts} />
    </CampaignContext.Provider>
  );
}

export function useCampaign(): Ctx {
  const ctx = useContext(CampaignContext);
  if (!ctx) throw new Error("useCampaign must be used within CampaignProvider");
  return ctx;
}

// ---------- global chrome ----------
function ConnectionPill({ connection, hasSocket }: { connection: Conn; hasSocket: boolean }) {
  // Only meaningful once we have an active campaign socket.
  if (!hasSocket) return null;
  const map = {
    connected: { Icon: Wifi, label: "Connected", cls: "text-success", spin: false },
    reconnecting: { Icon: Loader2, label: "Reconnecting…", cls: "text-warning", spin: true },
    connecting: { Icon: Loader2, label: "Connecting…", cls: "text-warning", spin: true },
  }[connection];
  const { Icon, label, cls, spin } = map;
  return (
    <div className="fixed top-3 right-3 z-40">
      <span className="flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-sm">
        <Icon className={`w-4 h-4 ${cls} ${spin ? "animate-spin" : ""}`} aria-hidden />
        <span className={cls}>{label}</span>
      </span>
    </div>
  );
}

function Toaster({ toasts }: { toasts: ToastItem[] }) {
  const icon = { success: CheckCircle2, warning: AlertTriangle, danger: AlertCircle };
  const color = { success: "text-success", warning: "text-warning", danger: "text-danger" };
  const ring = {
    success: "border-success/40",
    warning: "border-warning/40",
    danger: "border-danger/40",
  };
  return (
    <div
      aria-live="polite"
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 space-y-2 w-[90%] max-w-sm"
    >
      {toasts.map((t) => {
        const Icon = icon[t.kind];
        return (
          <div
            key={t.id}
            role="status"
            className={`flex items-center gap-2 rounded-md border ${ring[t.kind]} bg-surface-raised px-4 py-3 text-sm shadow-lg`}
          >
            <Icon className={`w-4 h-4 ${color[t.kind]}`} aria-hidden />
            <span>{t.message}</span>
          </div>
        );
      })}
    </div>
  );
}

export { WifiOff };
