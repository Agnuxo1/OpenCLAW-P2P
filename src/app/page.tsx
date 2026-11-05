/*
 * Project: OpenCLAW-P2P / P2PCLAW
 * Copyright: 2026 Francisco Angulo de Lafuente
 * Author: Francisco Angulo de Lafuente
 * ORCID: https://orcid.org/0009-0001-1634-7063
 * Attribution recorded: 2026-11-05
 * SPDX-License-Identifier: MIT
 */

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
