"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Crown, Loader2 } from "lucide-react";
import { useCampaign } from "../providers";

export default function CreatePage() {
  const router = useRouter();
  const { createCampaign } = useCampaign();
  const [name, setName] = useState("");
  const [dm, setDm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim() || !dm.trim()) {
      setError("Both fields are required.");
      return;
    }
    setBusy(true);
    const res = await createCampaign(name.trim(), dm.trim());
    if (res.ok && res.campaignId) {
      router.push(`/campaign/${res.campaignId}`);
    } else {
      setBusy(false);
      setError(res.ok ? "Something went wrong." : res.message ?? "Could not create the campaign.");
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
            <Crown className="w-5 h-5 text-accent" aria-hidden /> Create Campaign
          </h2>

          <div>
            <label htmlFor="c-name" className="block text-sm font-medium mb-1">
              Campaign name <span className="text-danger">*</span>
            </label>
            <input
              id="c-name"
              maxLength={60}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-md bg-bg border border-border px-4 py-3 text-base"
              autoFocus
            />
          </div>

          <div>
            <label htmlFor="c-dm" className="block text-sm font-medium mb-1">
              Your DM name <span className="text-danger">*</span>
            </label>
            <input
              id="c-dm"
              maxLength={24}
              value={dm}
              onChange={(e) => setDm(e.target.value)}
              className="w-full rounded-md bg-bg border border-border px-4 py-3 text-base"
            />
          </div>

          {error && (
            <p className="text-sm text-danger" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-md bg-accent text-bg font-semibold py-3 hover:bg-accent-hover transition flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {busy && <Loader2 className="w-4 h-4 animate-spin" aria-hidden />}
            {busy ? "Creating…" : "Create & Get Invite Code"}
          </button>
        </form>
      </div>
    </main>
  );
}
