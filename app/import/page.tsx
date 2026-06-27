"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Upload, FileJson, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { formatInviteCode } from "@/lib/inviteCode";
import type { ImportResult } from "@/lib/export/types";

type State =
  | { phase: "idle" }
  | { phase: "ready"; filename: string; data: unknown }
  | { phase: "loading" }
  | { phase: "done"; result: ImportResult; campaignName: string }
  | { phase: "error"; message: string };

function saveToken(campaignId: string, token: string, sessionId: string) {
  if (typeof window === "undefined") return;
  try {
    const all = JSON.parse(localStorage.getItem("dnd.sessions") ?? "{}") as Record<string, unknown>;
    all[campaignId] = { token, role: "dm", sessionId };
    localStorage.setItem("dnd.sessions", JSON.stringify(all));
  } catch { /* ignore */ }
}

export default function ImportPage() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<State>({ phase: "idle" });

  function handleFile(file: File | undefined) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        setState({ phase: "ready", filename: file.name, data });
      } catch {
        setState({ phase: "error", message: "อ่านไฟล์ไม่ได้ — ต้องเป็น JSON เท่านั้น" });
      }
    };
    reader.readAsText(file);
  }

  async function onImport() {
    if (state.phase !== "ready") return;
    const raw = state.data as Record<string, unknown>;
    const campaignName = (raw["campaign"] as Record<string, unknown>)?.["name"] as string ?? "Campaign";
    setState({ phase: "loading" });
    try {
      const res = await fetch("/api/campaigns/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ data: state.data }),
      });
      const json = await res.json() as { error?: string; message?: string } & Partial<ImportResult>;
      if (!res.ok) {
        setState({ phase: "error", message: json.message ?? json.error ?? "นำเข้าไม่สำเร็จ" });
        return;
      }
      const result = json as ImportResult;
      saveToken(result.campaignId, result.dmToken, result.dmSessionId);
      setState({ phase: "done", result, campaignName });
    } catch {
      setState({ phase: "error", message: "เกิดข้อผิดพลาด — ลองใหม่อีกครั้ง" });
    }
  }

  return (
    <main className="min-h-dvh grid place-items-center p-6">
      <div className="w-full max-w-md space-y-6">
        <Link href="/" className="text-muted hover:text-text text-sm flex items-center gap-1 w-fit">
          <ArrowLeft className="w-4 h-4" aria-hidden /> กลับ
        </Link>

        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Upload className="w-5 h-5 text-accent" aria-hidden />
            Import Campaign
          </h1>
          <p className="text-muted text-sm mt-1">นำเข้าไฟล์ backup JSON เพื่อสร้างแคมเปญใหม่จากข้อมูลที่บันทึกไว้</p>
        </div>

        {state.phase !== "done" && (
          <div className="rounded-lg border border-border bg-surface p-6 space-y-5">
            {/* Drop zone */}
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="w-full border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-accent/60 hover:bg-surface-raised transition cursor-pointer"
              aria-label="เลือกไฟล์ JSON"
            >
              <FileJson className="w-10 h-10 mx-auto text-faint mb-3" aria-hidden />
              {state.phase === "idle" && (
                <>
                  <p className="text-sm font-medium">คลิกเพื่อเลือกไฟล์</p>
                  <p className="text-xs text-faint mt-1">campaign-*.json</p>
                </>
              )}
              {state.phase === "ready" && (
                <>
                  <p className="text-sm font-medium text-accent">{state.filename}</p>
                  <p className="text-xs text-muted mt-1">คลิกเพื่อเลือกไฟล์อื่น</p>
                </>
              )}
              {state.phase === "error" && (
                <>
                  <p className="text-sm font-medium text-danger">{state.message}</p>
                  <p className="text-xs text-muted mt-1">คลิกเพื่อลองไฟล์อื่น</p>
                </>
              )}
            </button>
            <input
              ref={inputRef}
              type="file"
              accept=".json,application/json"
              className="sr-only"
              onChange={(e) => handleFile(e.target.files?.[0])}
            />

            {state.phase === "ready" && (
              <div className="rounded-md bg-surface-raised border border-border px-4 py-3 text-sm">
                <span className="text-muted">แคมเปญ: </span>
                <span className="font-medium">
                  {(state.data as Record<string, Record<string,string>>)?.campaign?.name ?? "—"}
                </span>
              </div>
            )}

            <button
              type="button"
              onClick={onImport}
              disabled={state.phase !== "ready"}
              className="w-full bg-accent text-bg font-semibold py-2.5 rounded-md hover:bg-accent-hover transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {state.phase === "loading" && <Loader2 className="w-4 h-4 animate-spin" aria-hidden />}
              {state.phase === "loading" ? "กำลังนำเข้า…" : "Import Campaign"}
            </button>
          </div>
        )}

        {state.phase === "done" && (
          <div className="rounded-lg border border-success/40 bg-surface p-6 space-y-5">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-6 h-6 text-success flex-shrink-0" aria-hidden />
              <div>
                <p className="font-semibold">นำเข้าสำเร็จ!</p>
                <p className="text-muted text-sm">{state.campaignName}</p>
              </div>
            </div>

            <div className="rounded-md bg-surface-raised border border-border px-4 py-3 space-y-1">
              <p className="text-xs text-faint uppercase tracking-wider">Invite Code ใหม่</p>
              <p className="font-mono text-2xl tracking-widest text-accent font-semibold">
                {formatInviteCode(state.result.inviteCode)}
              </p>
              <p className="text-xs text-muted">แชร์ code นี้ให้ผู้เล่น เพื่อ join แคมเปญที่ restore แล้ว</p>
            </div>

            <div className="rounded-md border border-warning/30 bg-warning/5 px-4 py-3 text-sm text-warning">
              ⚠️ ผู้เล่นต้อง join ใหม่ด้วย invite code นี้ — session token เดิมใช้ไม่ได้กับแคมเปญที่สร้างใหม่
            </div>

            <button
              type="button"
              onClick={() => router.push(`/campaign/${state.phase === "done" ? state.result.campaignId : ""}`)}
              className="w-full bg-accent text-bg font-semibold py-2.5 rounded-md hover:bg-accent-hover transition"
            >
              เข้า Campaign →
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
