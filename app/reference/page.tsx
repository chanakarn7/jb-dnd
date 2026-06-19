import { Suspense } from "react";
import ReferenceClient from "./ReferenceClient";

// useSearchParams (in ReferenceClient) requires a Suspense boundary.
export default function ReferencePage() {
  return (
    <Suspense fallback={<main className="min-h-dvh grid place-items-center p-6"><p className="text-muted">Loading…</p></main>}>
      <ReferenceClient />
    </Suspense>
  );
}
