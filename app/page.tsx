import Link from "next/link";
import { Crown, Users, Upload } from "lucide-react";

export default function Home() {
  return (
    <main className="min-h-dvh grid place-items-center p-6">
      <div className="w-full max-w-2xl text-center space-y-8">
        <div className="space-y-2">
          <h1 className="font-display text-4xl sm:text-5xl tracking-wide text-text">
            D&amp;D Campaign Manager
          </h1>
          <p className="text-muted">Run your table, live — on this Wi-Fi, no account needed.</p>
        </div>
        <div className="grid sm:grid-cols-2 gap-4 text-left">
          <Link
            href="/create"
            className="rounded-md border-2 border-accent bg-surface p-6 hover:bg-surface-raised transition"
          >
            <Crown className="w-7 h-7 text-accent" aria-hidden />
            <span className="block mt-3 text-lg font-semibold">Create Campaign</span>
            <span className="text-muted text-sm">I&apos;m the Dungeon Master</span>
          </Link>
          <Link
            href="/join"
            className="rounded-md border border-border bg-surface p-6 hover:bg-surface-raised transition"
          >
            <Users className="w-7 h-7 text-arcane" aria-hidden />
            <span className="block mt-3 text-lg font-semibold">Join Campaign</span>
            <span className="text-muted text-sm">I&apos;m a Player</span>
          </Link>
        </div>
        <div>
          <Link
            href="/import"
            className="inline-flex items-center gap-2 text-sm text-faint hover:text-muted transition border border-border rounded-md px-4 py-2 hover:bg-surface"
          >
            <Upload className="w-4 h-4" aria-hidden />
            Restore from backup
          </Link>
        </div>
        <p className="text-faint text-xs">Sprint 0 · Foundation</p>
      </div>
    </main>
  );
}
