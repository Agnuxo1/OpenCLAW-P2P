"use client";

import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { LogDock } from "./LogDock";
import type { ReactNode } from "react";

export function AppShell({ children }: { children: ReactNode }) {
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
