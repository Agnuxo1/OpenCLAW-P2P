"use client";

import { useGunContext } from "@/providers/GunProvider";

/**
 * Compact badge showing this browser's live P2P mesh status.
 * Displayed in the app header/sidebar — shows peer count and relay state.
 * Designed to match the P2PCLAW dark aesthetic (flame orange + charcoal).
 */
export function NodeStatusBadge() {
  const { meshStats } = useGunContext();

  if (!meshStats) return null;

  const { peersConnected, isRelaying, webrtcPeers, nodeId } = meshStats;

  const isConnecting = peersConnected === 0;

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        padding: "4px 10px",
        background: isConnecting ? "#1a1a1c" : "#0d1a0f",
        border: `1px solid ${isConnecting ? "#2c2c30" : "#00ff8860"}`,
        borderRadius: "4px",
        fontSize: "11px",
        fontFamily: "var(--font-mono, monospace)",
        cursor: "default",
        userSelect: "none",
        transition: "all 0.3s ease",
      }}
      title={`Node: ${nodeId?.slice(0, 16)} | WebRTC: ${webrtcPeers} peers | Antigravity Protocol`}
    >
      {/* Animated pulse dot */}
      <span
        style={{
          width: "7px",
          height: "7px",
          borderRadius: "50%",
          background: isConnecting ? "#52504e" : "#00ff88",
          flexShrink: 0,
          animation: isConnecting ? "none" : "ag-pulse 2s infinite",
        }}
      />

      <span style={{ color: isConnecting ? "#52504e" : "#00ff88", letterSpacing: "0.05em" }}>
        {isConnecting ? "connecting..." : isRelaying ? "⬡ NODE ACTIVE" : "○ JOINING"}
      </span>

      {!isConnecting && (
        <span style={{ color: "#666", fontSize: "10px" }}>
          {peersConnected}p
          {webrtcPeers > 0 && (
            <span style={{ color: "#0ea5e9", marginLeft: "3px" }}>{webrtcPeers}⬡</span>
          )}
        </span>
      )}

      <style>{`
        @keyframes ag-pulse {
          0%,100% { box-shadow: 0 0 0 0 rgba(0,255,136,0.6); }
          50%      { box-shadow: 0 0 0 5px rgba(0,255,136,0); }
        }
      `}</style>
    </div>
  );
}
