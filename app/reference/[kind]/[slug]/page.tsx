"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Loader2, FileQuestion } from "lucide-react";
import { SpellCard, ItemCard, MonsterStatblock, Attribution } from "../../_components";
import type { SpellDetail, ItemDetail, MonsterDetail } from "@/lib/reference/types";

type Kind = "spells" | "monsters" | "items";
const LABEL: Record<Kind, string> = { spells: "Spells", monsters: "Monsters", items: "Items" };

export default function ReferenceDetailPage() {
  const params = useParams<{ kind: string; slug: string }>();
  const kind = params.kind as Kind;
  const slug = params.slug;
  const validKind = ["spells", "monsters", "items"].includes(kind);
  const [data, setData] = useState<unknown>(undefined);
  const [errored, setErrored] = useState(false);

  useEffect(() => {
    if (!validKind) return; // 404 handled in render; no setState in effect body
    let alive = true;
    fetch(`/api/reference/${kind}/${slug}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d) => alive && setData(d))
      .catch(() => alive && setErrored(true));
    return () => {
      alive = false;
    };
  }, [kind, slug, validKind]);

  const status: "loading" | "ok" | "404" =
    !validKind || errored ? "404" : data === undefined ? "loading" : "ok";

  return (
    <main className="min-h-dvh max-w-2xl mx-auto p-4 sm:p-6">
      <Link
        href={`/reference?tab=${["spells", "monsters", "items"].includes(kind) ? kind : "spells"}`}
        className="text-muted hover:text-text text-sm flex items-center gap-1 mb-5 w-fit"
      >
        <ArrowLeft className="w-4 h-4" aria-hidden /> Back to {LABEL[kind] ?? "Reference"}
      </Link>

      {status === "loading" && (
        <div className="grid place-items-center py-24 text-muted">
          <Loader2 className="w-6 h-6 animate-spin" aria-hidden />
        </div>
      )}

      {status === "404" && (
        <div className="text-center py-24">
          <FileQuestion className="w-10 h-10 text-faint mx-auto" aria-hidden />
          <h1 className="font-display text-2xl mt-4">ไม่พบรายการนี้</h1>
          <p className="text-muted mt-2">รายการที่คุณเปิดอาจถูกลบหรือลิงก์ผิด</p>
          <Link
            href="/reference"
            className="inline-block mt-6 rounded-md bg-accent text-bg font-semibold px-5 py-2.5 text-sm hover:bg-accent-hover"
          >
            กลับ Reference
          </Link>
        </div>
      )}

      {status === "ok" && kind === "spells" && <SpellCard spell={data as SpellDetail} />}
      {status === "ok" && kind === "items" && <ItemCard item={data as ItemDetail} />}
      {status === "ok" && kind === "monsters" && <MonsterStatblock monster={data as MonsterDetail} />}

      {status === "ok" && <Attribution />}
    </main>
  );
}
