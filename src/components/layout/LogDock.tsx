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
      INFO: "text-green-500",
      WARN: "text-[#ff9a30]",
      ERR:  "text-[#e63030]",
      GUN:  "text-[#ff4e1a]",
      SYS:  "text-[#52504e]",
    };
    return colors[level];
  };

  return (
    <div
      className={cn(
        "border-t border-[#2c2c30] bg-[#0c0c0d] shrink-0 transition-all duration-200",
        logDockExpanded ? "h-[140px]" : "h-[28px]",
      )}
    >
      {/* Header bar */}
      <button
        onClick={toggleLogDock}
        className="flex items-center gap-2 px-3 w-full h-[28px] border-b border-[#2c2c30] hover:bg-[#121214] transition-colors"
      >
        <Terminal className="w-3 h-3 text-[#52504e]" />
        <span className="font-mono text-[10px] text-[#52504e] uppercase tracking-widest">
          System Log
        </span>
        <span className="ml-auto font-mono text-[10px] text-[#2c2c30]">
          {logs.length} entries
        </span>
        {logDockExpanded ? (
          <ChevronDown className="w-3 h-3 text-[#52504e]" />
        ) : (
          <ChevronUp className="w-3 h-3 text-[#52504e]" />
        )}
      </button>

      {/* Log entries */}
      {logDockExpanded && (
        <div className="h-[112px] overflow-y-auto px-3 py-1.5 space-y-0.5">
          {logs.map((entry) => (
            <div key={entry.id} className="flex gap-2 font-mono text-[11px] leading-4">
              <span className="text-[#2c2c30] shrink-0">{entry.time}</span>
              <span className={cn("w-7 shrink-0 text-right", levelColor(entry.level))}>
                {entry.level}
              </span>
              <span className="text-[#9a9490] break-all">{entry.msg}</span>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      )}
    </div>
  );
}
