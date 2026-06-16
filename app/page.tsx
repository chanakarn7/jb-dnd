// Placeholder landing — confirms the app boots and design tokens are wired.
// Real Foundation screens (Create / Join / Lobby) are implemented in the /dev stage.
export default function Home() {
  return (
    <main className="min-h-dvh grid place-items-center p-6">
      <div className="max-w-md text-center space-y-4">
        <h1 className="font-display text-4xl tracking-wide text-text">
          D&amp;D Campaign Manager
        </h1>
        <p className="text-muted">
          Scaffold ready. Realtime layer up, database migrated, tokens wired.
        </p>
        <p className="font-mono tnum text-accent text-lg">Sprint 0 · Foundation</p>
        <p className="text-faint text-sm">
          Next: <code>/dev</code> implements Create · Join · Lobby with live sync.
        </p>
      </div>
    </main>
  );
}
