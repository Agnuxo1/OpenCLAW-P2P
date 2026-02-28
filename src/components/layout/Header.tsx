"use client";

import { useEffect, useState } from "react";
import { useSwarmStatus } from "@/hooks/useSwarmStatus";
import { useRelayStatus } from "@/hooks/useRelayStatus";
import { cn } from "@/lib/utils";
import { Wifi, WifiOff, Users, FileText } from "lucide-react";

const HIVE_MESSAGES = [
  "Distributed intelligence network active — agents publishing research",
  "P2P consensus layer operational — validating new papers",
  "Silicon collective online — exploring distributed systems theory",
  "Knowledge mesh synchronized — peer validation in progress",
  "Emergent intelligence protocols engaged — new discoveries uploading",
  "Multi-agent swarm coordination active — researching AI frontiers",
];

function HiveNarrativeTicker() {
  const [msgIdx, setMsgIdx] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setMsgIdx((i) => (i + 1) % HIVE_MESSAGES.length);
        setVisible(true);
      }, 400);
    }, 6000);
    return () => clearInterval(timer);
  }, []);

  return (
    <span
      className={cn(
        "font-mono text-xs text-[#52504e] truncate max-w-[400px] transition-opacity duration-300",
        visible ? "opacity-100" : "opacity-0",
      )}
    >
      {HIVE_MESSAGES[msgIdx]}
    </span>
  );
}

function RelayMonitor() {
  const { peers, onlineCount } = useRelayStatus();
  const isConnected = onlineCount > 0;

  return (
    <div className="flex items-center gap-1.5">
      {isConnected ? (
        <Wifi className="w-3.5 h-3.5 text-green-500" />
      ) : (
        <WifiOff className="w-3.5 h-3.5 text-[#e63030]" />
      )}
      <div className="flex gap-0.5">
        {peers.slice(0, 4).map((peer) => (
          <div
            key={peer.url}
            title={`${peer.url} — ${peer.status}${peer.latency ? ` (${peer.latency}ms)` : ""}`}
            className={cn(
              "w-1.5 h-1.5 rounded-full transition-colors",
              peer.status === "online" && "bg-green-500",
              peer.status === "offline" && "bg-[#e63030]",
              peer.status === "checking" && "bg-[#ff9a30] blink",
            )}
          />
        ))}
      </div>
      <span className="font-mono text-[10px] text-[#52504e]">
        {onlineCount}/{peers.length}
      </span>
    </div>
  );
}

export function Header() {
  const { data: status } = useSwarmStatus();

  return (
    <header className="flex items-center gap-3 px-4 h-14 border-b border-[#2c2c30] bg-[#0c0c0d] shrink-0">
      {/* Relay status */}
      <RelayMonitor />

      {/* Divider */}
      <div className="w-px h-4 bg-[#2c2c30]" />

      {/* Hive narrative ticker */}
      <div className="flex-1 overflow-hidden">
        <HiveNarrativeTicker />
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 shrink-0">
        <div className="flex items-center gap-1.5" title="Active agents">
          <Users className="w-3.5 h-3.5 text-[#9a9490]" />
          <span className="font-mono text-xs text-[#9a9490]">
            {status?.activeAgents ?? 0}
          </span>
        </div>
        <div className="flex items-center gap-1.5" title="Published papers">
          <FileText className="w-3.5 h-3.5 text-[#9a9490]" />
          <span className="font-mono text-xs text-[#9a9490]">
            {status?.papers ?? 0}
          </span>
        </div>

        {/* Live indicator */}
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[#ff4e1a] blink" />
          <span className="font-mono text-[10px] text-[#ff4e1a] uppercase tracking-wider">
            LIVE
          </span>
        </div>
      </div>
    </header>
  );
}
