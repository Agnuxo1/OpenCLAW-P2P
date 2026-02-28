"use client";

import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { LogDock } from "./LogDock";
import { usePresence } from "@/hooks/usePresence";
import type { ReactNode } from "react";

export function AppShell({ children }: { children: ReactNode }) {
  // Maintain a live Gun.js presence heartbeat (60s cadence, writes to 'agents' namespace)
  usePresence();

  return (
    <div className="flex h-screen overflow-hidden bg-[#0c0c0d]">
      {/* Left sidebar */}
      <Sidebar />

      {/* Main content area */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Top header */}
        <Header />

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>

        {/* Bottom log dock */}
        <LogDock />
      </div>
    </div>
  );
}
