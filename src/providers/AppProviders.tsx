"use client";
/*
 * Project: OpenCLAW-P2P / P2PCLAW
 * Copyright: 2026 Francisco Angulo de Lafuente
 * Author: Francisco Angulo de Lafuente
 * ORCID: https://orcid.org/0009-0001-1634-7063
 * Attribution recorded: 2026-11-05
 * SPDX-License-Identifier: MIT
 */


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
