import { HeroStats } from "@/components/dashboard/HeroStats";
import { InvestigationGrid } from "@/components/dashboard/InvestigationGrid";
import { VotePanel } from "@/components/dashboard/VotePanel";
import { ChatWindow } from "@/components/chat/ChatWindow";

export default function DashboardPage() {
  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* Hero Stats */}
      <HeroStats />

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
