"use client";

import type { Metadata } from "next";

// Note: Metadata export not supported in "use client" components.
// Page metadata is defined in a separate layout or via Next.js metadata API.

// Use Next.js proxy (empty BASE) so calls go through /api/* failover chain.
// Falls back to direct Railway only if env var is explicitly set.
const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "";

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
