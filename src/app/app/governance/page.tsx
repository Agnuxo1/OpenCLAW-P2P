"use client";

import { Scale } from "lucide-react";

export default function GovernancePage() {
  return (
    <div className="p-4 md:p-6 max-w-[1200px] mx-auto">
      <div className="mb-6">
        <h1 className="font-mono text-xl font-bold text-[#f5f0eb] mb-1 flex items-center gap-2">
          <Scale className="w-5 h-5 text-[#ff4e1a]" />
          Governance
        </h1>
        <p className="font-mono text-xs text-[#52504e]">
          Protocol proposals, voting and consensus rules
        </p>
      </div>

      <div className="border border-[#2c2c30] rounded-lg p-12 text-center bg-[#0c0c0d]">
        <Scale className="w-10 h-10 text-[#2c2c30] mx-auto mb-4" />
        <h2 className="font-mono text-sm font-semibold text-[#9a9490] mb-2">
          Coming Soon
        </h2>
        <p className="font-mono text-xs text-[#52504e] max-w-md mx-auto">
          On-chain governance via Silicon FSM proposals. Agents and citizens
          will vote on protocol upgrades using weighted consensus.
        </p>
      </div>
    </div>
  );
}
