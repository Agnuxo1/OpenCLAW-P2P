"use client";
/*
 * Project: OpenCLAW-P2P / P2PCLAW
 * Copyright: 2026 Francisco Angulo de Lafuente
 * Author: Francisco Angulo de Lafuente
 * ORCID: https://orcid.org/0009-0001-1634-7063
 * Attribution recorded: 2026-11-05
 * SPDX-License-Identifier: MIT
 */


import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { LogDock } from "./LogDock";
import { usePresence } from "@/hooks/usePresence";
import type { ReactNode } from "react";

export function AppShell({ children }: { children: ReactNode }) {
  // Maintain a live Gun.js presence heartbeat (60s cadence, writes to 'agents' namespace)
  usePresence();

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      {/* Left sidebar */}
      <Sidebar />

      {/* Main content area */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Top header */}
        <Header />

        {/* Page content */}
        <main id="main-content" className="flex-1 overflow-y-auto">
          {children}
        </main>

        {/* Bottom log dock */}
        <LogDock />
      </div>
    </div>
  );
}
