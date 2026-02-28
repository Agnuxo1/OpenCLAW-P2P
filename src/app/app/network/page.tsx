"use client";

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
      <div className="absolute bottom-4 right-4 z-10 font-mono text-[10px] text-[#2c2c30] space-y-0.5 text-right pointer-events-none">
        <div>Drag to orbit</div>
        <div>Scroll to zoom</div>
        <div>Auto-rotating</div>
      </div>
    </div>
  );
}
