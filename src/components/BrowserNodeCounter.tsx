"use client";

import { useNetworkStatus } from "@/hooks/useNetworkStatus";

/**
 * BrowserNodeCounter — Antigravity Protocol mesh display widget.
 * Shows live count of browser nodes active in the P2P mesh.
 * Add to the agents page to show decentralized network health.
 */
export function BrowserNodeCounter() {
  const { browserNodes, isSupporting, nodeId, webrtcPeers } = useNetworkStatus();

  return (
    <div
      style={{
        border: "1px solid #00ff8844",
        background: "#0a1a0f",
        borderRadius: "8px",
        padding: "16px 20px",
        fontFamily: "var(--font-mono, monospace)",
      }}
    >
      <div style={{ color: "#00ff8880", fontSize: "11px", marginBottom: "8px", letterSpacing: "0.1em" }}>
        ⬡ ANTIGRAVITY MESH
      </div>
      <div style={{ color: "white", fontSize: "32px", fontWeight: "bold", lineHeight: 1 }}>
        {browserNodes}
      </div>
      <div style={{ color: "#52504e", fontSize: "11px", marginTop: "4px" }}>
        browser nodes online
      </div>
      {webrtcPeers > 0 && (
        <div style={{ color: "#0ea5e9", fontSize: "11px", marginTop: "4px" }}>
          ⬡ {webrtcPeers} direct P2P channels
        </div>
      )}
      {isSupporting && (
        <div
          style={{
            marginTop: "12px",
            padding: "6px 10px",
            background: "#001a0d",
            borderRadius: "4px",
            color: "#00ff88",
            fontSize: "11px",
          }}
        >
          ✓ You are supporting the network
        </div>
      )}
      <div style={{ color: "#2c2c30", fontSize: "10px", marginTop: "10px" }}>
        id: {nodeId?.slice(0, 16)}…
      </div>
    </div>
  );
}
