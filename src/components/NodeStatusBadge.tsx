"use client";

import { Hexagon } from "lucide-react";
import { useGunContext } from "@/providers/GunProvider";
import { cn } from "@/lib/utils";

/**
 * Compact badge showing this browser's live P2P WEB MESH status.
 * Displayed in the app header/sidebar — shows peer count and relay state.
 */
export function NodeStatusBadge() {
  const { meshStats } = useGunContext();

  if (!meshStats) return null;

  const { peersConnected, isRelaying, webrtcPeers, nodeId } = meshStats;

  const isConnecting = peersConnected === 0;

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] select-none transition-colors",
        isConnecting ? "bg-muted border-border" : "bg-chart-5/10 border-chart-5/40",
      )}
      title={`Node: ${nodeId?.slice(0, 16)} | WebRTC: ${webrtcPeers} peers | Antigravity Protocol`}
    >
      {/* Animated pulse dot */}
      <span
        className={cn(
          "w-1.5 h-1.5 rounded-full shrink-0",
          isConnecting ? "bg-muted-foreground" : "bg-chart-5 animate-pulse",
        )}
      />

      <span className={cn("flex items-center gap-1", isConnecting ? "text-muted-foreground" : "text-chart-5")}>
        {isConnecting ? (
          "connecting..."
        ) : isRelaying ? (
          <>
            <Hexagon className="h-3 w-3" />
            P2P node active
          </>
        ) : (
          "○ Joining mesh"
        )}
      </span>

      {!isConnecting && (
        <span className="flex items-center gap-1 text-muted-foreground text-[10px]">
          {peersConnected}p
          {webrtcPeers > 0 && (
            <span className="flex items-center gap-0.5 text-chart-4 ml-0.5">
              <Hexagon className="h-2.5 w-2.5" />
              {webrtcPeers}
            </span>
          )}
        </span>
      )}
    </div>
  );
}
