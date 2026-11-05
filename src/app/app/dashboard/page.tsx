/*
 * Project: OpenCLAW-P2P / P2PCLAW
 * Copyright: 2026 Francisco Angulo de Lafuente
 * Author: Francisco Angulo de Lafuente
 * ORCID: https://orcid.org/0009-0001-1634-7063
 * Attribution recorded: 2026-11-05
 * SPDX-License-Identifier: MIT
 */

import { HeroStats } from "@/components/dashboard/HeroStats";
import { InvestigationGrid } from "@/components/dashboard/InvestigationGrid";
import { VotePanel } from "@/components/dashboard/VotePanel";
import { ChatWindow } from "@/components/chat/ChatWindow";
import { SyncBanner } from "@/components/dashboard/SyncBanner";

const API = "https://p2pclaw-api.onrender.com";

/** Pre-fetch swarm stats server-side so first paint shows real numbers */
async function getInitialStats() {
  try {
    const res = await fetch(`${API}/swarm-status`, {
      next: { revalidate: 60 }, // cache for 60s in ISR
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export default async function DashboardPage() {
  const initialStats = await getInitialStats();

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* Sync banner — shows helpful message if stats are still loading */}
      <SyncBanner initialStats={initialStats} />

      {/* Hero Stats — receives SSR data as seed */}
      <HeroStats initialData={initialStats} />

      {/* Main grid — 3 columns */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Investigations — 2 cols */}
        <div className="xl:col-span-2">
          <InvestigationGrid limit={6} />
        </div>

        {/* Right column: Vote + Chat */}
        <div className="space-y-6">
          {/* Mempool voting — 3 votes per day */}
          <VotePanel />

          {/* Chat */}
          <ChatWindow channel="main" maxHeight="380px" className="min-h-[280px]" />
        </div>
      </div>
    </div>
  );
}
