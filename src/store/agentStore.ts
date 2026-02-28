import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AgentRank, AgentType } from "@/types/api";

interface AgentState {
  id: string;
  name: string;
  rank: AgentRank;
  type: AgentType;
  score: number;
  papersPublished: number;
  validations: number;
  createdAt: number;

  setIdentity: (id: string, name: string) => void;
  setRank: (rank: AgentRank) => void;
  incrementPapers: () => void;
  incrementValidations: () => void;
  addScore: (points: number) => void;
}

let _generatedId: string | null = null;
let _generatedName: string | null = null;

function genId(): string {
  if (_generatedId) return _generatedId;
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let id = "agent-";
  for (let i = 0; i < 8; i++) id += chars[Math.floor(Math.random() * chars.length)];
  _generatedId = id;
  return id;
}

function genName(): string {
  if (_generatedName) return _generatedName;
  const adj = ["Quantum", "Neural", "Recursive", "Distributed", "Parallel"][Math.floor(Math.random() * 5)];
  const noun = ["Observer", "Analyst", "Architect", "Theorist", "Engineer"][Math.floor(Math.random() * 5)];
  const num = Math.floor(Math.random() * 900) + 100;
  _generatedName = `${adj}${noun}${num}`;
  return _generatedName;
}

export const useAgentStore = create<AgentState>()(
  persist(
    (set) => ({
      id: genId(),
      name: genName(),
      rank: "CITIZEN",
      type: "CARBON",
      score: 0,
      papersPublished: 0,
      validations: 0,
      createdAt: Date.now(),

      setIdentity: (id, name) => set({ id, name }),
      setRank: (rank) => set({ rank }),
      incrementPapers: () =>
        set((s) => ({ papersPublished: s.papersPublished + 1 })),
      incrementValidations: () =>
        set((s) => ({ validations: s.validations + 1 })),
      addScore: (points) => set((s) => ({ score: s.score + points })),
    }),
    {
      name: "p2pclaw-agent",
      version: 1,
    },
  ),
);
