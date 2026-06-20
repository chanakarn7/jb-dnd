"use client";
// File: app/campaign/[id]/Markdown.tsx
// Minimal, SAFE markdown renderer for Story content (Sprint 5).
// Produces React elements only — NEVER dangerouslySetInnerHTML, so any raw HTML
// in user content (e.g. an XSS <script> payload) is rendered as inert text
// (PRD edge 5.10). Supports: # / ## / ### headings, - bullet lists, **bold**,
// *italic*, `code`, blank-line paragraphs. Unknown syntax falls through as text.

import { Fragment, type ReactNode } from "react";

// Inline: split a line into bold / italic / code / plain spans.
function renderInline(text: string, keyBase: string): ReactNode[] {
  const tokens: ReactNode[] = [];
  // Order matters: bold (**) before italic (*).
  const regex = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) tokens.push(text.slice(last, m.index));
    const tok = m[0];
    const key = `${keyBase}-${i++}`;
    if (tok.startsWith("**")) {
      tokens.push(
        <strong key={key} className="font-semibold text-text">
          {tok.slice(2, -2)}
        </strong>,
      );
    } else if (tok.startsWith("`")) {
      tokens.push(
        <code key={key} className="rounded bg-surface-raised px-1 py-0.5 text-[0.85em] font-mono">
          {tok.slice(1, -1)}
        </code>,
      );
    } else {
      tokens.push(
        <em key={key} className="italic">
          {tok.slice(1, -1)}
        </em>,
      );
    }
    last = m.index + tok.length;
  }
  if (last < text.length) tokens.push(text.slice(last));
  return tokens;
}

export default function Markdown({ content }: { content: string }) {
  const lines = (content ?? "").replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let listItems: string[] = [];
  let para: string[] = [];
  let key = 0;

  const flushPara = () => {
    if (para.length) {
      const text = para.join(" ");
      blocks.push(
        <p key={`p-${key++}`} className="text-sm text-text/90 leading-relaxed">
          {renderInline(text, `p-${key}`)}
        </p>,
      );
      para = [];
    }
  };
  const flushList = () => {
    if (listItems.length) {
      blocks.push(
        <ul key={`ul-${key++}`} className="list-disc pl-5 space-y-1 text-sm text-text/90">
          {listItems.map((li, idx) => (
            <li key={idx}>{renderInline(li, `li-${key}-${idx}`)}</li>
          ))}
        </ul>,
      );
      listItems = [];
    }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (line.trim() === "") {
      flushPara();
      flushList();
      continue;
    }
    const h = /^(#{1,3})\s+(.*)$/.exec(line);
    if (h) {
      flushPara();
      flushList();
      const level = h[1].length;
      const txt = h[2];
      const cls =
        level === 1
          ? "text-lg font-semibold text-text font-[Cinzel] mt-2"
          : level === 2
            ? "text-base font-semibold text-accent mt-2"
            : "text-sm font-semibold text-text/90 mt-1";
      blocks.push(
        <p key={`h-${key++}`} className={cls}>
          {renderInline(txt, `h-${key}`)}
        </p>,
      );
      continue;
    }
    const bullet = /^[-*]\s+(.*)$/.exec(line);
    if (bullet) {
      flushPara();
      listItems.push(bullet[1]);
      continue;
    }
    para.push(line.trim());
  }
  flushPara();
  flushList();

  return <Fragment>{blocks}</Fragment>;
}
