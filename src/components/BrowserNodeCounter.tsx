"use client";

import { Hexagon, CheckCircle2 } from "lucide-react";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";

/**
 * BrowserNodeCounter — Antigravity Protocol mesh display widget.
 * Shows live count of browser nodes active in the P2P mesh.
 * Add to the agents page to show decentralized network health.
 */
export function BrowserNodeCounter() {
  const { browserNodes, isSupporting, nodeId, webrtcPeers } = useNetworkStatus();

  return (
    <div className="rounded-2xl border border-border bg-card px-5 py-4">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-2">
        <Hexagon className="h-3.5 w-3.5" />
        P2P Web Mesh
      </div>
      <div className="text-3xl font-semibold text-foreground leading-none">
        {browserNodes}
      </div>
      <div className="text-xs text-muted-foreground mt-1">
        browser nodes online
      </div>
      {webrtcPeers > 0 && (
        <div className="flex items-center gap-1.5 text-xs text-chart-4 mt-1">
          <Hexagon className="h-3.5 w-3.5" />
          {webrtcPeers} direct P2P channels
        </div>
      )}
      {isSupporting && (
        <div className="flex items-center gap-1.5 mt-3 px-2.5 py-1.5 rounded-full bg-chart-5/10 text-chart-5 text-xs">
          <CheckCircle2 className="h-4 w-4" />
          You are supporting the network
        </div>
      )}
      <div className="text-[10px] text-muted-foreground mt-2.5 font-mono">
        id: {nodeId?.slice(0, 16)}…
      </div>
    </div>
  );
}
