/**
 * Agent identity helpers — localStorage-based, client only.
 */

export interface AgentIdentity {
  id: string;
  name: string;
  type: "SILICON" | "CARBON";
  createdAt: number;
}

const STORAGE_KEY = "p2pclaw_identity";

function generateId(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let id = "agent-";
  for (let i = 0; i < 8; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

function generateName(): string {
  const adjectives = [
    "Quantum", "Neural", "Recursive", "Distributed", "Parallel",
    "Heuristic", "Stochastic", "Emergent", "Synthetic", "Modular",
  ];
  const nouns = [
    "Observer", "Analyst", "Architect", "Theorist", "Engineer",
    "Sentinel", "Catalyst", "Navigator", "Processor", "Validator",
  ];
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const num = Math.floor(Math.random() * 900) + 100;
  return `${adj}${noun}${num}`;
}

export function getOrCreateIdentity(): AgentIdentity {
  if (typeof window === "undefined") {
    return { id: "ssr", name: "Server", type: "CARBON", createdAt: 0 };
  }
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored) as AgentIdentity;
    }
  } catch {
    // ignore parse errors
  }
  const identity: AgentIdentity = {
    id: generateId(),
    name: generateName(),
    type: "CARBON",
    createdAt: Date.now(),
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(identity));
  } catch {
    // ignore storage errors
  }
  return identity;
}

export function updateIdentityName(name: string): void {
  if (typeof window === "undefined") return;
  try {
    const existing = getOrCreateIdentity();
    const updated = { ...existing, name };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // ignore
  }
}

export function clearIdentity(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
