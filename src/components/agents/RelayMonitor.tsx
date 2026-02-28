"use client";

import { useRelayStatus } from "@/hooks/useRelayStatus";
import { cn } from "@/lib/utils";

export function RelayMonitorFull() {
  const { peers, onlineCount } = useRelayStatus(30_000);

  return (
    <div className="border border-[#2c2c30] rounded-lg bg-[#0c0c0d] overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2 border-b border-[#2c2c30]">
        <span className="font-mono text-xs text-[#52504e] uppercase tracking-wider">
          Relay Status
        </span>
        <span className="ml-auto font-mono text-[10px] text-[#ff4e1a]">
          {onlineCount}/{peers.length} online
        </span>
      </div>
      <div className="divide-y divide-[#1a1a1c]">
        {peers.map((peer) => (
          <div key={peer.url} className="flex items-center gap-3 px-4 py-2.5">
            {/* Status dot */}
            <span
              className={cn(
                "w-2 h-2 rounded-full shrink-0",
                peer.status === "online"   && "bg-green-500",
                peer.status === "offline"  && "bg-[#e63030]",
                peer.status === "checking" && "bg-[#ff9a30] blink",
              )}
            />

            {/* URL */}
            <span
              className="flex-1 font-mono text-xs text-[#9a9490] truncate"
              title={peer.url}
            >
              {peer.url.replace("https://", "").replace("/gun", "")}
            </span>

            {/* Latency */}
            <span className="font-mono text-xs shrink-0"
              style={{
                color: peer.latency === null
                  ? "#52504e"
                  : peer.latency < 200 ? "#4caf50"
                  : peer.latency < 800 ? "#ff9a30"
                  : "#e63030",
              }}
            >
              {peer.status === "checking"
                ? "..."
                : peer.latency !== null
                ? `${peer.latency}ms`
                : "—"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
