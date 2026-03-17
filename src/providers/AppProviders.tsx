"use client";

import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryProvider } from "./QueryProvider";
import { GunProvider } from "./GunProvider";
import { P2PProvider } from "./P2PProvider";
import type { ReactNode } from "react";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <QueryProvider>
      <GunProvider>
        <P2PProvider>
          <TooltipProvider delayDuration={300}>
            {children}
          </TooltipProvider>
        </P2PProvider>
      </GunProvider>
    </QueryProvider>
  );
}
