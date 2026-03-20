"use client";

import { useState } from "react";
import Link from "next/link";
import {
  FlaskConical, MessageSquare, BookOpen, Beaker, Cpu, Dna, GitBranch, Bot,
  Home, ChevronRight, Search, Play, Pause, Download, ArrowLeft, Zap, Network, 
  FileText, BarChart3, Microscope, Atom, Brain, RefreshCw, Star, Shield, 
  Settings, ExternalLink, Globe, GraduationCap, Box, Wind, Code, Layers, FileCode
} from "lucide-react";

// ── types ──────────────────────────────────────────────────────────────────────

type TabCategory = "P2PCLAW Core" | "Autonomous AI" | "Physics Sims" | "Open Science";

interface LabTab {
  id: string;
  category: TabCategory;
  label: string;
  desc?: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  url?: string;
}

// ── tab config ─────────────────────────────────────────────────────────────────

const TABS: LabTab[] = [
  // CORE & LEGACY
  { id: "hub",         category: "P2PCLAW Core", label: "Lab Hub Dashboard", icon: Home,          url: "https://hive.p2pclaw.com/lab/" },
  { id: "genetic",     category: "P2PCLAW Core", label: "Genetic Lab",       icon: Dna,           url: "https://app.p2pclaw.com/app.html?sync=1773767710469#genetic-lab" },
  { id: "chat",        category: "P2PCLAW Core", label: "Research Chat",     icon: MessageSquare, url: "https://hive.p2pclaw.com/lab/research-chat.html" },
  { id: "literature",  category: "P2PCLAW Core", label: "Literature",        icon: BookOpen,      url: "https://hive.p2pclaw.com/lab/literature.html" },
  { id: "experiments", category: "P2PCLAW Core", label: "Experiments",       icon: Beaker,        url: "https://hive.p2pclaw.com/lab/experiments.html" },
  { id: "simulation",  category: "P2PCLAW Core", label: "Simulation",        icon: Cpu,           url: "https://hive.p2pclaw.com/lab/simulation.html" },
  { id: "workflows",   category: "P2PCLAW Core", label: "Workflows",         icon: GitBranch,     url: "https://hive.p2pclaw.com/lab/workflows.html" },

  // AI PLATFORMS
  { id: "sakana",      category: "Autonomous AI", label: "AI Scientist v2",  icon: Bot, badge: "NEW", url: "https://github.com/SakanaAI/AI-Scientist-v2", desc: "Sakana AI open source end-to-end framework." },
  { id: "novix",       category: "Autonomous AI", label: "Novix AI-Researcher", icon: Brain,      url: "https://novix.science/chat", desc: "GUI web for automated paper generation." },
  { id: "kosmos",      category: "Autonomous AI", label: "Kosmos",           icon: Globe,         url: "https://arxiv.org/abs/2511.02824", desc: "12 hours of parallel analysis cycles." },
  { id: "agentrxiv",   category: "Autonomous AI", label: "Agent Laboratory", icon: Cpu,           url: "https://github.com/SamuelSchmidgall/AgentLaboratory", desc: "AgentRxiv human-assisted science." },
  { id: "ais_tools",   category: "Autonomous AI", label: "AI Scientist Tools", icon: Settings,    url: "https://aiscientist.tools/search?q=&t=1773775066247" },
  { id: "claw_inst",   category: "Autonomous AI", label: "Claw Institute",   icon: Shield,        url: "https://clawinstitute.aiscientist.tools" },

  // PHYSICS
  { id: "omniverse",   category: "Physics Sims", label: "NVIDIA Omniverse",  icon: Box,           url: "https://developer.nvidia.com/omniverse", desc: "Isaac Sim industrial-grade physics." },
  { id: "simscale",    category: "Physics Sims", label: "SimScale CFD",      icon: Wind,          url: "https://www.simscale.com", desc: "Fluid mechanics & thermodynamics cloud." },
  { id: "stellarai",   category: "Physics Sims", label: "STELLARAI Fusion",  icon: Zap,           url: "https://www.pppl.gov", desc: "Princeton Plasma Physics Lab." },
  { id: "osp",         category: "Physics Sims", label: "Open Source Physics", icon: Atom,        url: "https://www.compadre.org/osp", desc: "ComPADRE physics engine." },
  { id: "atomagents",  category: "Physics Sims", label: "AtomAgents PNAS",   icon: Layers,        url: "https://www.pnas.org", desc: "Multi-Agent computational materials." },

  // OPEN SCIENCE
  { id: "osf",         category: "Open Science", label: "OSF Framework",     icon: Network,       url: "https://osf.io", desc: "Hypothesis pre-registration & replication." },
  { id: "codeocean",   category: "Open Science", label: "Code Ocean",        icon: FileCode,      url: "https://codeocean.com", desc: "Reproducible compute environment." },
  { id: "labxchange",  category: "Open Science", label: "Harvard Labxchange", icon: GraduationCap, url: "https://www.labxchange.org", desc: "Harvard interactive virtual lab." },
];

// ═══════════════════════════════════════════════════════════════════════════════
// DYNAMIC IFRAME / LAUNCHER COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

function TabRenderer({ tab }: { tab: LabTab }) {
  const isP2P = tab.category === "P2PCLAW Core";
  
  if (!tab.url) return (
    <div className="flex-1 flex flex-col items-center justify-center border border-[#2c2c30] rounded-lg bg-[#0c0c0d] p-12 text-center h-full">
      <tab.icon className="w-12 h-12 text-[#2c2c30] mb-4" />
      <h2 className="font-mono text-lg font-bold text-[#52504e] mb-2">{tab.label} is Offline</h2>
    </div>
  );

  if (isP2P) {
    // Render an IFRAME directly since it's our own domain (no X-Frame issues)
    return (
      <iframe 
        src={tab.url} 
        className="w-full h-full border-0 rounded-lg overflow-hidden bg-[#0c0c0d]"
        title={tab.label}
      />
    );
  }

  // Render an impressive API LAUNCHER for external domains
  return (
    <div className="flex-1 flex flex-col items-center justify-center border border-[#2c2c30] rounded-lg bg-[#0c0c0d] p-12 text-center relative overflow-hidden h-full">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,#ff4e1a05_0%,transparent_60%)]"></div>
      
      <div className="w-20 h-20 rounded-xl border border-[#ff4e1a]/20 bg-[#121214] flex items-center justify-center mb-6 relative z-10 shadow-[0_0_30px_rgba(255,78,26,0.1)]">
        <tab.icon className="w-8 h-8 text-[#ff4e1a]" />
      </div>

      <h2 className="font-mono text-2xl font-bold text-[#f5f0eb] mb-2 relative z-10">
        Launch {tab.label}
      </h2>
      
      <p className="font-mono text-sm text-[#9a9490] max-w-md mb-8 relative z-10">
        {tab.desc ?? "External scientific platform integrated via the P2PCLAW Agent Laboratory API."}
      </p>

      <a
        href={tab.url}
        target="_blank"
        rel="noopener noreferrer"
        className="px-6 py-3 bg-[#ff4e1a] hover:bg-[#ff7020] text-black font-mono text-sm font-bold rounded-lg flex items-center gap-2 transition-transform hover:scale-105 shadow-[0_0_20px_rgba(255,78,26,0.2)] relative z-10"
      >
        Open Platform securely <ExternalLink className="w-4 h-4" />
      </a>
      
      <p className="font-mono text-[10px] text-[#52504e] mt-6 relative z-10">
        By clicking this link, you will exit the HiveMind iframe confinement.
      </p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN LAB DASHBOARD PAGE
// ═══════════════════════════════════════════════════════════════════════════════

export default function LabPage() {
  const [activeTab, setActiveTab] = useState<string>("hub");
  
  const currentTab = TABS.find(t => t.id === activeTab) ?? TABS[0];
  const categories = Array.from(new Set(TABS.map(t => t.category)));

  return (
    <div className="h-screen bg-[#0c0c0d] text-[#f5f0eb] flex flex-col overflow-hidden">
      {/* ── TOP NAV HEADER ── */}
      <header className="h-[60px] border-b border-[#2c2c30] bg-[#0c0c0d] shrink-0 flex items-center justify-between px-6 z-40 relative">
        <div className="flex items-center gap-3">
          <Link href="/" className="w-8 h-8 bg-[#ff4e1a]/10 border border-[#ff4e1a]/30 rounded flex items-center justify-center hover:bg-[#ff4e1a]/20 transition-colors">
            <FlaskConical className="w-4 h-4 text-[#ff4e1a]" />
          </Link>
          <div>
            <span className="font-mono text-sm font-bold text-[#ff4e1a]">P2PCLAW UNIVERSAL LAB</span>
            <div className="font-mono text-[10px] text-[#52504e]">Autonomous Scientific Research Suite</div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/app/dashboard" className="font-mono text-xs text-[#52504e] hover:text-[#9a9490] transition-colors flex items-center gap-1 border border-[#2c2c30] px-3 py-1.5 rounded-md hover:bg-[#1a1a1c]">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Dashboard
          </Link>
        </div>
      </header>

      {/* ── MAIN WORKSPACE ── */}
      <div className="flex flex-1 overflow-hidden">
        
        {/* ── LEFT SIDEBAR ── */}
        <div className="w-[280px] border-r border-[#2c2c30] bg-[#121214] flex flex-col shrink-0 overflow-y-auto">
          <div className="p-4">
            {categories.map(cat => (
              <div key={cat} className="mb-6">
                <div className="font-mono text-[10px] text-[#ff4e1a] font-bold uppercase tracking-widest mb-2 px-2">
                  {cat}
                </div>
                <div className="space-y-0.5">
                  {TABS.filter(t => t.category === cat).map(tab => {
                    const isActive = activeTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`w-full text-left flex items-center justify-between px-3 py-2 rounded-md transition-colors font-mono text-xs ${
                          isActive 
                            ? "bg-[#ff4e1a]/10 border border-[#ff4e1a]/30 text-[#f5f0eb] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]" 
                            : "border border-transparent text-[#9a9490] hover:bg-[#2c2c30]/40 hover:text-[#f5f0eb]"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <tab.icon className={`w-3.5 h-3.5 ${isActive ? "text-[#ff4e1a]" : "text-[#52504e]"}`} />
                          <span className={isActive ? "font-bold" : ""}>{tab.label}</span>
                        </div>
                        {tab.badge && (
                          <span className="font-sans text-[8px] bg-[#ff4e1a] text-black rounded px-1.5 py-0.5 font-bold leading-none tracking-wider">
                            {tab.badge}
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── RIGHT VIEWPORT (IFRAME/LAUNCHER) ── */}
        <div className="flex-1 bg-[#0c0c0d] p-4 flex flex-col relative">
          <TabRenderer tab={currentTab} />
        </div>
        
      </div>
    </div>
  );
}
