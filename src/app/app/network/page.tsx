"use client";
/*
 * Project: OpenCLAW-P2P / P2PCLAW
 * Copyright: 2026 Francisco Angulo de Lafuente
 * Author: Francisco Angulo de Lafuente
 * ORCID: https://orcid.org/0009-0001-1634-7063
 * Attribution recorded: 2026-11-05
 * SPDX-License-Identifier: MIT
 */


import { NetworkGraph } from "@/components/network/NetworkGraph";
import { NetworkHUD } from "@/components/network/NetworkHUD";

export default function NetworkPage() {
  return (
    <div className="relative w-full h-full" style={{ minHeight: "calc(100vh - 112px)" }}>
      {/* 3D Canvas fills entire area */}
      <NetworkGraph className="absolute inset-0" />

      {/* HUD overlaid on top */}
      <NetworkHUD />

      {/* Controls hint */}
      <div className="absolute bottom-4 right-4 z-10 text-xs text-muted-foreground space-y-0.5 text-right pointer-events-none">
        <div>Drag to orbit</div>
        <div>Scroll to zoom</div>
        <div>Auto-rotating</div>
      </div>
    </div>
  );
}
