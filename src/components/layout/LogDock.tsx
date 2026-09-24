"use client";

import { useEffect, useRef, useState } from "react";
import { useUIStore } from "@/store/uiStore";
import { useGunContext } from "@/providers/GunProvider";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronUp, Terminal } from "lucide-react";

interface LogEntry {
  id: string;
  time: string;
  level: "INFO" | "WARN" | "ERR" | "GUN" | "SYS";
  msg: string;
}

const BOOT_MESSAGES: Omit<LogEntry, "id">[] = [
  { time: "", level: "SYS", msg: "P2PCLAW Beta v1.0.0 — initializing..." },
  { time: "", level: "SYS", msg: "Loading Gun.js P2P layer..." },
  { time: "", level: "SYS", msg: "Connecting to relay mesh..." },
  { time: "", level: "INFO", msg: "TanStack Query cache ready" },
];

function ts(): string {
  return new Date().toISOString().slice(11, 19);
}

export function LogDock() {
  const { logDockExpanded, toggleLogDock } = useUIStore();
  const { ready } = useGunContext();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const initRef = useRef(false);

  // Boot sequence
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;
    BOOT_MESSAGES.forEach((m, i) => {
      setTimeout(() => {
        setLogs((prev) => [
          ...prev,
          { ...m, id: `boot-${i}`, time: ts() },
        ]);
      }, i * 300);
    });
  }, []);

  // Gun ready log
  useEffect(() => {
    if (ready) {
      setLogs((prev) => [
        ...prev,
        { id: `gun-${Date.now()}`, time: ts(), level: "GUN", msg: "Gun.js connected to relay mesh" },
      ]);
    }
  }, [ready]);

  // Scroll to bottom on new logs
  useEffect(() => {
    if (logDockExpanded) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs, logDockExpanded]);

  const addLog = (level: LogEntry["level"], msg: string) => {
    setLogs((prev) =>
      [...prev, { id: `log-${Date.now()}`, time: ts(), level, msg }].slice(-200),
    );
  };

  // Expose globally for components to push logs
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__clawLog = addLog;
  }, []);

  const levelColor = (level: LogEntry["level"]) => {
    const colors: Record<LogEntry["level"], string> = {
      INFO: "text-success",
      WARN: "text-warning",
      ERR:  "text-destructive",
      GUN:  "text-primary",
      SYS:  "text-muted-foreground",
    };
    return colors[level];
  };

  return (
    <div
      className={cn(
        "shrink-0 border-t border-hairline bg-surface-alt transition-[height] duration-200 ease-out",
        logDockExpanded ? "h-[160px]" : "h-[30px]",
      )}
    >
      {/* Header bar */}
      <button
        type="button"
        onClick={toggleLogDock}
        aria-expanded={logDockExpanded}
        aria-controls="system-log"
        className="flex h-[30px] w-full items-center gap-2 px-4 text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
      >
        <Terminal className="h-3.5 w-3.5" aria-hidden="true" />
        <span className="text-[12px] font-medium">System log</span>
        <span className="ml-auto font-mono text-[11px] tabular-nums">
          {logs.length} entries
        </span>
        {logDockExpanded ? (
          <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
        ) : (
          <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
        )}
      </button>

      {/* Log entries */}
      {logDockExpanded && (
        <div
          id="system-log"
          role="log"
          aria-live="off"
          className="h-[130px] space-y-0.5 overflow-y-auto border-t border-hairline bg-background px-4 py-2"
        >
          {logs.map((entry) => (
            <div key={entry.id} className="flex gap-3 font-mono text-[11px] leading-[18px]">
              <span className="shrink-0 tabular-nums text-muted-foreground/70">{entry.time}</span>
              <span className={cn("w-8 shrink-0 text-right font-medium", levelColor(entry.level))}>
                {entry.level}
              </span>
              <span className="break-all text-foreground/80">{entry.msg}</span>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      )}
    </div>
  );
}
