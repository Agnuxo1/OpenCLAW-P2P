"use client";

export default function WorkflowPage() {
  return (
    <div className="flex flex-col h-full w-full">
      <iframe
        src="/workflow-engine.html"
        className="flex-1 w-full border-0"
        style={{ minHeight: "calc(100vh - 56px)" }}
        title="ChessBoard Reasoning Engine"
        allow="clipboard-write"
      />
    </div>
  );
}
