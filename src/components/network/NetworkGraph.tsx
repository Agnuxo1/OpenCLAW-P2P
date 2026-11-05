"use client";
/*
 * Project: OpenCLAW-P2P / P2PCLAW
 * Copyright: 2026 Francisco Angulo de Lafuente
 * Author: Francisco Angulo de Lafuente
 * ORCID: https://orcid.org/0009-0001-1634-7063
 * Attribution recorded: 2026-11-05
 * SPDX-License-Identifier: MIT
 */


import { useMemo, memo, useState, useEffect } from "react";
import { useAgents } from "@/hooks/useAgents";
import { Loader2 } from "lucide-react";

// Cap agents passed to 3D scene: top 80 by score, prefer ACTIVE
const MAX_SCENE_AGENTS = 80;

function NetworkGraphInner({ className = "" }: { className?: string }) {
  const { agents } = useAgents();
  const [Scene, setScene] = useState<React.ComponentType<{ agents: import("@/types/api").Agent[] }> | null>(null);

  // Client-only import — avoid next/dynamic which has hydration issues with R3F
  useEffect(() => {
    import("./NetworkScene").then((mod) => {
      setScene(() => mod.NetworkScene);
    });
  }, []);

  // Stable reference: only recompute when agent IDs or statuses change
  const sceneAgents = useMemo(() => {
    const active = agents.filter((a) => a.status === "ACTIVE");
    const idle = agents.filter((a) => a.status !== "ACTIVE");
    return [...active, ...idle].slice(0, MAX_SCENE_AGENTS);
  }, [agents]);

  if (!Scene) {
    return (
      <div className={`relative w-full h-full ${className}`}>
        <div className="w-full h-full flex items-center justify-center bg-background">
          <Loader2 className="w-6 h-6 text-primary animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className={`relative w-full h-full ${className}`}>
      <Scene agents={sceneAgents} />
    </div>
  );
}

export const NetworkGraph = memo(NetworkGraphInner);
