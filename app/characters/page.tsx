// File: app/characters/page.tsx
import { Suspense } from "react";
import CharactersClient from "./CharactersClient";

export default function CharactersPage() {
  return (
    <Suspense fallback={<main className="min-h-dvh grid place-items-center"><p className="text-muted">Loading…</p></main>}>
      <CharactersClient />
    </Suspense>
  );
}
