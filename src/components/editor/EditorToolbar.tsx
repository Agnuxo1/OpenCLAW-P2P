"use client";

import { Users } from "lucide-react";

interface EditorToolbarProps {
  onInsert: (text: string) => void;
  wordCount: number;
  peerCount: number;
  minWords: number;
}

const SNIPPETS: { label: string; title: string; insert: string }[] = [
  { label: "H2",   title: "Heading 2",      insert: "\n## " },
  { label: "H3",   title: "Heading 3",      insert: "\n### " },
  { label: "**B",  title: "Bold",           insert: "****" },         // cursor mid
  { label: "_I",   title: "Italic",         insert: "__" },
  { label: "`c`",  title: "Inline code",    insert: "``" },
  { label: "```",  title: "Code block",     insert: "\n```\n\n```\n" },
  { label: "→li",  title: "Bullet list",    insert: "\n- " },
  { label: "1.",   title: "Numbered list",  insert: "\n1. " },
  { label: "> ",   title: "Blockquote",     insert: "\n> " },
  { label: "---",  title: "Horizontal rule",insert: "\n---\n" },
];

export function EditorToolbar({ onInsert, wordCount, peerCount, minWords }: EditorToolbarProps) {
  const pct = Math.min(100, Math.round((wordCount / minWords) * 100));
  const overMin = wordCount >= minWords;

  return (
    <div className="flex items-center gap-1 px-3 py-1.5 border-b border-border bg-popover flex-wrap">
      {/* Formatting buttons */}
      {SNIPPETS.map((s) => (
        <button
          key={s.label}
          type="button"
          title={s.title}
          onClick={() => onInsert(s.insert)}
          className="font-mono text-[10px] px-2 py-0.5 rounded border border-border text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
        >
          {s.label}
        </button>
      ))}

      <div className="flex-1" />

      {/* Peer count */}
      <div className="flex items-center gap-1 text-[10px] text-muted-foreground" title={`${peerCount} peer${peerCount !== 1 ? "s" : ""} editing`}>
        <Users className="w-3 h-3" />
        <span>{peerCount}</span>
      </div>

      {/* Word count + progress */}
      <div className="flex items-center gap-1.5 font-mono text-[10px]">
        <span className={overMin ? "text-chart-2" : "text-muted-foreground"}>
          {wordCount.toLocaleString()}/{minWords}w
        </span>
        <div className={`w-16 h-1 rounded-full overflow-hidden ${overMin ? "bg-chart-2/20" : "bg-border"}`}>
          <div
            className={`h-full rounded-full transition-all duration-300 ${overMin ? "bg-chart-2" : "bg-primary"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  );
}
