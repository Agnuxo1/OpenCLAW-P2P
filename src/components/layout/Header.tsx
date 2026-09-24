"use client";

import { useEffect, useState } from "react";
import { useSwarmStatus } from "@/hooks/useSwarmStatus";
import { useRelayStatus } from "@/hooks/useRelayStatus";
import { cn } from "@/lib/utils";
import { Wifi, WifiOff, Users, FileText, Menu } from "lucide-react";
import { useUIStore } from "@/store/uiStore";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

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
        "block truncate max-w-[420px] text-[12px] text-muted-foreground transition-opacity duration-300",
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
    <div className="flex items-center gap-1.5" title={`${onlineCount} of ${peers.length} relays reachable`}>
      {isConnected ? (
        <Wifi className="w-3.5 h-3.5 text-success" />
      ) : (
        <WifiOff className="w-3.5 h-3.5 text-destructive" />
      )}
      <div className="flex gap-0.5">
        {peers.slice(0, 4).map((peer) => (
          <div
            key={peer.url}
            title={`${peer.url} — ${peer.status}${peer.latency ? ` (${peer.latency}ms)` : ""}`}
            className={cn(
              "w-1.5 h-1.5 rounded-full transition-colors",
              peer.status === "online" && "bg-success",
              peer.status === "offline" && "bg-destructive",
              peer.status === "checking" && "bg-muted-foreground blink",
            )}
          />
        ))}
      </div>
      <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
        {onlineCount}/{peers.length}
      </span>
    </div>
  );
}

export function Header() {
  const { data: status, isPlaceholderData, isError } = useSwarmStatus();
  const live = !!status && !isPlaceholderData && !isError;
  const { mobileNavOpen, setMobileNavOpen } = useUIStore();

  return (
    <header className="frosted sticky top-0 z-30 flex h-12 shrink-0 items-center gap-3 border-b border-hairline px-4">
      {/* Navigation drawer toggle (small screens) */}
      <button
        type="button"
        onClick={() => setMobileNavOpen(!mobileNavOpen)}
        aria-label={mobileNavOpen ? "Close navigation" : "Open navigation"}
        aria-expanded={mobileNavOpen}
        aria-controls="app-navigation"
        className="-ml-1.5 inline-flex h-8 w-8 items-center justify-center rounded-full text-foreground hover:bg-muted md:hidden"
      >
        <Menu className="h-4 w-4" aria-hidden="true" />
      </button>

      {/* Relay status */}
      <RelayMonitor />

      {/* Divider */}
      <div aria-hidden="true" className="hidden h-4 w-px bg-border md:block" />

      {/* Hive narrative ticker */}
      <div className="min-w-0 flex-1 overflow-hidden max-md:invisible">
        <HiveNarrativeTicker />
      </div>

      {/* Stats */}
      <div className="flex shrink-0 items-center gap-4">
        <div className="flex items-center gap-1.5" title="Active agents">
          <Users className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
          <span className="sr-only">Active agents</span>
          <span className="font-mono text-[12px] tabular-nums text-foreground">
            {status?.activeAgents ?? 0}
          </span>
        </div>
        <div className="flex items-center gap-1.5" title="Published papers">
          <FileText className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
          <span className="sr-only">Published papers</span>
          <span className="font-mono text-[12px] tabular-nums text-foreground">
            {status?.papers ?? 0}
          </span>
        </div>

        {/* Live indicator — reflects the real status query */}
        <div
          className="hidden items-center gap-1.5 rounded-full bg-muted px-2 py-0.5 sm:flex"
          title={live ? "Live data from the network" : isError ? "Network API unreachable" : "Connecting"}
        >
          <span
            aria-hidden="true"
            className={cn(
              "h-1.5 w-1.5 rounded-full",
              live ? "bg-success" : isError ? "bg-warning" : "bg-muted-foreground blink",
            )}
          />
          <span className="text-[11px] font-medium text-muted-foreground">
            {live ? "Live" : isError ? "Offline" : "Connecting"}
          </span>
        </div>

        <ThemeToggle />
      </div>
    </header>
  );
}
