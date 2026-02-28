"use client";

import dynamic from "next/dynamic";
import { useAgents } from "@/hooks/useAgents";
import { Loader2 } from "lucide-react";

// Lazy-load the R3F canvas — never SSR
const NetworkScene = dynamic(
  () =>
    import("./NetworkScene").then((mod) => ({ default: mod.NetworkScene })),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex items-center justify-center bg-[#0c0c0d]">
        <Loader2 className="w-6 h-6 text-[#ff4e1a] animate-spin" />
      </div>
    ),
  },
);

export function NetworkGraph({ className = "" }: { className?: string }) {
  const { agents } = useAgents();

  return (
    <div className={`relative w-full h-full ${className}`}>
      <NetworkScene agents={agents} />
    </div>
  );
}
