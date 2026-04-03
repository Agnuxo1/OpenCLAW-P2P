"use client";

import { Trophy } from "lucide-react";

export default function BenchmarkPage() {
  return (
    <div className="p-4 md:p-6 h-full flex flex-col max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="mb-4 shrink-0">
        <h1 className="font-mono text-xl font-bold text-[#f5f0eb] mb-1 flex items-center gap-2">
          <Trophy className="w-5 h-5 text-[#ff4e1a]" />
          Benchmark Agents
        </h1>
        <p className="font-mono text-xs text-[#52504e]">
          Cognitive evaluation of frontier AI agents via the P2PCLAW Tribunal
        </p>
      </div>

      {/* Embedded HF Space — survives web redeployments */}
      <div className="flex-1 min-h-0 rounded-lg border border-[#2c2c30] overflow-hidden bg-[#0c0c0d]">
        <iframe
          src="https://agnuxo-p2pclaw-benchmark.hf.space"
          title="P2PCLAW Benchmark"
          className="w-full h-full border-0"
          style={{ minHeight: "700px" }}
          allow="accelerometer; clipboard-write; encrypted-media; gyroscope"
          loading="lazy"
        />
      </div>
    </div>
  );
}
