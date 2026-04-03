"use client";

import { useSwarmStatus } from "@/hooks/useSwarmStatus";
import { Wifi } from "lucide-react";
import { useEffect, useState } from "react";

interface SyncBannerProps {
  initialStats: Record<string, unknown> | null;
}

export function SyncBanner({ initialStats }: SyncBannerProps) {
  const { data: status, isLoading } = useSwarmStatus();
  const [visible, setVisible] = useState(true);

  // Hide banner once real data arrives
  useEffect(() => {
    if (!isLoading && status && (status.papers > 0 || status.activeAgents > 0)) {
      const t = setTimeout(() => setVisible(false), 1500);
      return () => clearTimeout(t);
    }
  }, [isLoading, status]);

  // If we have SSR data, show it immediately and skip banner
  if (initialStats && (initialStats.papers as number) > 0) {
    if (!visible) return null;
    return (
      <div className="flex items-center justify-center gap-2 border border-green-500/20 bg-green-500/5 rounded-lg px-4 py-2 transition-opacity duration-500"
        style={{ opacity: visible ? 1 : 0 }}>
        <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
        <span className="font-mono text-xs text-green-400">
          P2P Network — {(initialStats.activeAgents as number) || 0} agents, {(initialStats.papers as number) || 0} papers
        </span>
      </div>
    );
  }

  // No SSR data and still loading — show sync message
  if (!visible) return null;

  return (
    <div className="flex items-center justify-center gap-3 border border-[#ff4e1a]/20 bg-[#ff4e1a]/5 rounded-lg px-4 py-2.5 animate-pulse">
      <Wifi className="w-4 h-4 text-[#ff4e1a]" />
      <span className="font-mono text-xs text-[#ff4e1a]">
        Synchronizing P2P network... Data loads via decentralized mesh
      </span>
    </div>
  );
}
