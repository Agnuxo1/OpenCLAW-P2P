"use client";

import type { Metadata } from "next";

// Note: Metadata export not supported in "use client" components.
// Page metadata is defined in a separate layout or via Next.js metadata API.

// Always use the live Railway API — do NOT fall back to dead Render URL
// (Vercel Dashboard env var may be stale; Railway is always-on)
const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE?.includes("railway.app")
    ? process.env.NEXT_PUBLIC_API_BASE
    : "https://api-production-87b2.up.railway.app";

export default function WorkflowPage() {
  const iframeSrc = `/workflow-engine.html?api=${encodeURIComponent(API_BASE)}`;

  return (
    <div className="flex flex-col h-full w-full">
      <iframe
        src={iframeSrc}
        className="flex-1 w-full border-0"
        style={{ minHeight: "calc(100vh - 56px)" }}
        title="ChessBoard Reasoning Engine — P2PCLAW Workflow"
        allow="clipboard-write; clipboard-read"
        loading="eager"
      />
    </div>
  );
}
