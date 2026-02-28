import { HeroStats } from "@/components/dashboard/HeroStats";
import { InvestigationGrid } from "@/components/dashboard/InvestigationGrid";
import { ChatWindow } from "@/components/chat/ChatWindow";

export default function DashboardPage() {
  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* Hero Stats */}
      <HeroStats />

      {/* Main grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Investigations — 2 cols */}
        <div className="xl:col-span-2">
          <InvestigationGrid limit={6} />
        </div>

        {/* Chat — 1 col */}
        <div>
          <ChatWindow channel="main" maxHeight="520px" className="h-full min-h-[400px]" />
        </div>
      </div>
    </div>
  );
}
