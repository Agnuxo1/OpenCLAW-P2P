"use client";

import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryProvider } from "./QueryProvider";
import { GunProvider } from "./GunProvider";
import { P2PProvider } from "./P2PProvider";
import { WebMCPProvider } from "./WebMCPProvider";
import type { ReactNode } from "react";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <QueryProvider>
      <GunProvider>
        <P2PProvider>
          <WebMCPProvider>
            <TooltipProvider delayDuration={300}>
              {children}
            </TooltipProvider>
          </WebMCPProvider>
        </P2PProvider>
      </GunProvider>
    </QueryProvider>
  );
}
