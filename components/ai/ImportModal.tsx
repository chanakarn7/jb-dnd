"use client";
// File: components/ai/ImportModal.tsx
// Paste-from-Claude/ChatGPT modal — pick entity type, paste text, save as a draft.
// role="dialog" + Esc dismiss + scrim (a11y per UXUI_DESIGN §6). Offline-only path.

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { IMPORT_MAX } from "@/lib/ai/rules";
import { ENTITY_TYPES, type AIDraftEntityType } from "@/lib/ai/types";

const ENTITY_LABELS: Record<AIDraftEntityType, string> = {
  npc: "NPC",
  loot: "Loot",
  quest: "Quest",
  session_recap: "Recap",
};

export default function ImportModal({
  busy,
  onClose,
  onSubmit,
}: {
  busy: boolean;
  onClose: () => void;
  onSubmit: (entityType: AIDraftEntityType, content: string) => void;
}) {
  const [entityType, setEntityType] = useState<AIDraftEntityType>("npc");
  const [content, setContent] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const tooLong = content.length > IMPORT_MAX;
  const canSubmit = content.trim().length > 0 && !tooLong && !busy;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Import from Claude or ChatGPT"
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[92%] max-w-lg rounded-lg border border-border bg-surface p-6"
      >
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-lg font-semibold">Import from Claude / ChatGPT</h4>
          <button onClick={onClose} className="text-muted hover:text-text" aria-label="Dismiss">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Entity type tabs */}
        <div className="flex gap-2 mb-3 overflow-x-auto">
          {ENTITY_TYPES.map((t) => (
            <button
              key={t}
              onClick={() => setEntityType(t)}
              className={`rounded-md px-3 py-1.5 text-sm border whitespace-nowrap ${
                entityType === t
                  ? "border-accent text-accent"
                  : "border-border text-muted hover:text-text"
              }`}
            >
              {ENTITY_LABELS[t]}
            </button>
          ))}
        </div>

        <label className="block text-sm text-muted mb-1">Paste the AI response below:</label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={10}
          autoFocus
          className="w-full rounded-md bg-bg border border-border px-3 py-2 text-sm font-mono"
          aria-label="Pasted content"
        />
        <div className={`text-right text-xs mt-1 tnum ${tooLong ? "text-danger" : "text-faint"}`}>
          {content.length.toLocaleString()} / {IMPORT_MAX.toLocaleString()} chars
        </div>

        <div className="mt-4 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="rounded-md border border-border px-4 py-2 text-sm hover:bg-surface-raised"
          >
            Cancel
          </button>
          <button
            onClick={() => onSubmit(entityType, content)}
            disabled={!canSubmit}
            className="rounded-md bg-accent text-bg px-4 py-2 text-sm font-semibold hover:opacity-90 disabled:opacity-40"
          >
            Parse &amp; Save Draft
          </button>
        </div>
      </div>
    </div>
  );
}
