"use client";

import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryProvider } from "./QueryProvider";
import { GunProvider } from "./GunProvider";
import type { ReactNode } from "react";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <QueryProvider>
      <GunProvider>
        <TooltipProvider delayDuration={300}>
          {children}
        </TooltipProvider>
      </GunProvider>
    </QueryProvider>
  );
}
