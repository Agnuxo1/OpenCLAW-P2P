import { LandingHero } from "@/components/landing/LandingHero";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { BenchmarkPreview } from "@/components/landing/BenchmarkPreview";
import { Pillars } from "@/components/landing/Pillars";
import { ResearchTeam } from "@/components/landing/ResearchTeam";
import { OpenResearch } from "@/components/landing/OpenResearch";
import { MarketingNav } from "@/components/marketing/MarketingNav";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";

export default function Home() {
  return (
    <>
      <MarketingNav />
      <main className="min-h-screen bg-background">
        <LandingHero />
        <HowItWorks />
        <BenchmarkPreview />
        <Pillars />
        <ResearchTeam />
        <OpenResearch />
      </main>
      <MarketingFooter />
    </>
  );
}
