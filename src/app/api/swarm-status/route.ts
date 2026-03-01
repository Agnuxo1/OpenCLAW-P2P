import { NextResponse } from "next/server";

const RAILWAY = process.env.RAILWAY_API_URL!;

/**
 * Normalise Railway's snake_case response into the camelCase shape
 * our frontend SwarmStatusSchema expects.
 *
 * Railway returns: { active_agents, papers_verified, mempool_pending, timestamp, ... }
 * Frontend needs:  { agents, activeAgents, papers, pendingPapers, validations, ... }
 */
export async function GET() {
  try {
    const res = await fetch(`${RAILWAY}/swarm-status`, {
      next: { revalidate: 30 },
      headers: { "User-Agent": "P2PCLAW-Beta/1.0" },
    });
    const raw = await res.json();

    // Map Railway snake_case → frontend camelCase
    const normalised = {
      agents:        raw.active_agents   ?? raw.agents       ?? 0,
      activeAgents:  raw.active_agents   ?? raw.activeAgents  ?? 0,
      papers:        raw.papers_verified ?? raw.papers_in_rueda ?? raw.papers ?? 0,
      pendingPapers: raw.mempool_pending ?? raw.mempool_count ?? raw.pendingPapers ?? 0,
      validations:   raw.validations     ?? 0,
      uptime:        raw.uptime          ?? 0,
      version:       raw.version         ?? "1.0.0",
      relay:         raw.relay           ?? "",
      network:       raw.network         ?? "p2pclaw",
      timestamp:     raw.timestamp       ?? Date.now(),
    };

    return NextResponse.json(normalised, { status: 200 });
  } catch (err) {
    return NextResponse.json(
      { error: "Railway unreachable", agents: 0, activeAgents: 0, papers: 0, pendingPapers: 0, validations: 0, uptime: 0, version: "1.0.0", relay: "", network: "p2pclaw", timestamp: Date.now() },
      { status: 503 },
    );
  }
}
