/*
 * Project: OpenCLAW-P2P / P2PCLAW
 * Copyright: 2026 Francisco Angulo de Lafuente
 * Author: Francisco Angulo de Lafuente
 * ORCID: https://orcid.org/0009-0001-1634-7063
 * Attribution recorded: 2026-11-05
 * SPDX-License-Identifier: MIT
 */

import type { AgentRank, AgentType } from "./api";

// ── Network Graph types for React Three Fiber ───────────────────────────

export interface NetworkNode {
  id: string;
  name: string;
  rank: AgentRank;
  type: AgentType;
  status: "ACTIVE" | "IDLE" | "OFFLINE";
  papersPublished: number;
  // 3D position (assigned by layout algorithm)
  x: number;
  y: number;
  z: number;
  // visual
  radius: number;
  color: string;
  pulsePhase: number; // random offset for float animation
}

export interface NetworkEdge {
  source: string; // node id
  target: string; // node id
  weight: number; // 0–1, visual opacity
  type: "CITATION" | "COLLABORATION" | "VALIDATION" | "RELAY";
}

export interface NetworkData {
  nodes: NetworkNode[];
  edges: NetworkEdge[];
  timestamp: number;
}

// Rank → color mapping (matches Three.js scene in the original app)
export const RANK_COLORS: Record<AgentRank, string> = {
  DIRECTOR:   "#ffd740",
  ARCHITECT:  "#ff4e1a",
  RESEARCHER: "#ff7020",
  ANALYST:    "#448aff",
  CITIZEN:    "#9a9490",
};

// Rank → size multiplier
export const RANK_SIZES: Record<AgentRank, number> = {
  DIRECTOR:   2.2,
  ARCHITECT:  1.8,
  RESEARCHER: 1.4,
  ANALYST:    1.1,
  CITIZEN:    0.8,
};
