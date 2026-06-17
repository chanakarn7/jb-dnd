"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Users, Loader2, AlertCircle, AlertTriangle } from "lucide-react";
import { useCampaign } from "../providers";
import { formatInviteCode } from "@/lib/inviteCode";

export default function JoinPage() {
  const router = useRouter();
  const { joinCampaign } = useCampaign();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [codeErr, setCodeErr] = useState<string | null>(null);
  const [nameErr, setNameErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setCodeErr(null);
    setNameErr(null);
    if (!code.trim()) return setCodeErr("Enter an invite code.");
    if (!name.trim()) return setNameErr("Enter a display name.");

    setBusy(true);
    const res = await joinCampaign(code.trim(), name.trim());
    if (res.ok && res.campaignId) {
      router.push(`/campaign/${res.campaignId}`);
      return;
    }
    setBusy(false);
    if (!res.ok) {
      if (res.code === "DUPLICATE_NAME") setNameErr(res.message ?? "That name's taken.");
      else setCodeErr(res.message ?? "No campaign found for that code.");
    }
  }

  return (
    <main className="min-h-dvh grid place-items-center p-6">
      <div className="w-full max-w-md">
        <Link href="/" className="text-muted hover:text-text text-sm mb-4 flex items-center gap-1 w-fit">
          <ArrowLeft className="w-4 h-4" aria-hidden /> Back
        </Link>
        <form onSubmit={onSubmit} className="rounded-lg border border-border bg-surface p-6 space-y-5">
          <h2 className="text-2xl font-semibold flex items-center gap-2">
            <Users className="w-5 h-5 text-arcane" aria-hidden /> Join Campaign
          </h2>

          <div>
            <label htmlFor="j-code" className="block text-sm font-medium mb-1">
              Invite code <span className="text-danger">*</span>
            </label>
            <input
              id="j-code"
              value={code}
              onChange={(e) => setCode(formatInviteCode(e.target.value))}
              placeholder="K7Q-M2P"
              autoCapitalize="characters"
              aria-describedby="j-code-err"
              className="w-full font-mono text-xl tnum tracking-[0.2em] uppercase rounded-md bg-bg border border-border px-4 py-3"
              autoFocus
            />
            {codeErr && (
              <p id="j-code-err" className="mt-1 text-sm text-danger flex items-center gap-1" role="alert">
                <AlertCircle className="w-3.5 h-3.5" aria-hidden /> {codeErr}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="j-name" className="block text-sm font-medium mb-1">
              Display name <span className="text-danger">*</span>
            </label>
            <input
              id="j-name"
              maxLength={24}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Thorin"
              aria-describedby="j-name-err"
              className="w-full rounded-md bg-bg border border-border px-4 py-3 text-base"
            />
            {nameErr && (
              <p id="j-name-err" className="mt-1 text-sm text-warning flex items-center gap-1" role="alert">
                <AlertTriangle className="w-3.5 h-3.5" aria-hidden /> {nameErr}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-md bg-accent text-bg font-semibold py-3 hover:bg-accent-hover transition flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {busy && <Loader2 className="w-4 h-4 animate-spin" aria-hidden />}
            {busy ? "Joining…" : "Join Table"}
          </button>
        </form>
      </div>
    </main>
  );
}
