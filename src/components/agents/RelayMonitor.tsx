"use client";

import { useRelayStatus } from "@/hooks/useRelayStatus";
import { cn } from "@/lib/utils";

export function RelayMonitorFull() {
  const { peers, onlineCount } = useRelayStatus(30_000);

  return (
    <div className="border border-border rounded-2xl bg-card overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border">
        <span className="text-xs font-medium text-muted-foreground">
          Relay Status
        </span>
        <span className="ml-auto font-mono text-[10px] text-primary">
          {onlineCount}/{peers.length} online
        </span>
      </div>
      <div className="divide-y divide-border">
        {peers.map((peer) => (
          <div key={peer.url} className="flex items-center gap-3 px-4 py-2.5">
            {/* Status dot */}
            <span
              className={cn(
                "w-2 h-2 rounded-full shrink-0",
                peer.status === "online"   && "bg-green-500",
                peer.status === "offline"  && "bg-destructive",
                peer.status === "checking" && "bg-chart-2 blink",
              )}
            />

            {/* URL */}
            <span
              className="flex-1 font-mono text-xs text-muted-foreground truncate"
              title={peer.url}
            >
              {peer.url.replace("https://", "").replace("/gun", "")}
            </span>

            {/* Latency */}
            <span
              className={cn(
                "font-mono text-xs shrink-0",
                peer.latency === null
                  ? "text-muted-foreground"
                  : peer.latency < 200 ? "text-green-500"
                  : peer.latency < 800 ? "text-chart-2"
                  : "text-destructive",
              )}
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
