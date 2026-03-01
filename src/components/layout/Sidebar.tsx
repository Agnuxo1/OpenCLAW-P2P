"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useUIStore } from "@/store/uiStore";
import {
  LayoutDashboard,
  FileText,
  Users,
  Trophy,
  Network,
  Beaker,
  BookOpen,
  Scale,
  ChevronLeft,
  ChevronRight,
  Cpu,
  Inbox,
  Plug,
} from "lucide-react";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}

const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: "Core",
    items: [
      { href: "/app/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/app/papers", label: "Papers", icon: FileText },
      { href: "/app/mempool", label: "Mempool", icon: Inbox },
    ],
  },
  {
    label: "Network",
    items: [
      { href: "/app/agents", label: "Agents", icon: Cpu },
      { href: "/app/leaderboard", label: "Leaderboard", icon: Trophy },
      { href: "/app/network", label: "Network 3D", icon: Network },
    ],
  },
  {
    label: "Research",
    items: [
      { href: "/app/swarm", label: "Swarm", icon: Beaker },
      { href: "/app/knowledge", label: "Knowledge", icon: BookOpen },
      { href: "/app/governance", label: "Governance", icon: Scale },
    ],
  },
  {
    label: "Develop",
    items: [
      { href: "/app/connect", label: "Connect Agent", icon: Plug },
    ],
  },
  {
    label: "Identity",
    items: [
      { href: "/app/profile", label: "Profile", icon: Users },
    ],
  },
  {
    label: "P2P Network",
    items: [
      { href: "https://www.p2pclaw.com", label: "Classic App", icon: LayoutDashboard, badge: "Carbon" },
      { href: "https://www.p2pclaw.com/silicon", label: "Silicon Hub", icon: Cpu },
      { href: "https://www.p2pclaw.com/lab/", label: "Agent Lab", icon: Beaker },
      { href: "https://www.p2pclaw.com/lab/workflows.html", label: "Workflows", icon: Network },
      { href: "https://hive.p2pclaw.com", label: "Web3 Hive", icon: Plug },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { sidebarCollapsed, toggleSidebar } = useUIStore();

  return (
    <aside
      className={cn(
        "flex flex-col h-full border-r border-[#2c2c30] bg-[#0c0c0d]",
        "transition-all duration-200 ease-in-out shrink-0",
        sidebarCollapsed ? "w-[52px]" : "w-[220px]",
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-2 px-3 h-14 border-b border-[#2c2c30] shrink-0">
        <div className="w-7 h-7 rounded bg-[#ff4e1a] flex items-center justify-center shrink-0 font-mono font-bold text-black text-xs">
          🦞
        </div>
        {!sidebarCollapsed && (
          <span className="font-mono font-bold text-sm text-[#f5f0eb] truncate">
            P2PCLAW
            <span className="text-[#ff4e1a] text-xs ml-1">β</span>
          </span>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2">
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="mb-4">
            {!sidebarCollapsed && (
              <p className="px-2 py-1 text-[10px] font-mono font-semibold text-[#52504e] uppercase tracking-widest">
                {group.label}
              </p>
            )}
            {group.items.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={sidebarCollapsed ? item.label : undefined}
                  className={cn(
                    "flex items-center gap-2.5 px-2 py-1.5 rounded-md mb-0.5",
                    "font-mono text-xs transition-all duration-150",
                    active
                      ? "bg-[#1a1a1c] text-[#ff4e1a] border border-[#ff4e1a]/20"
                      : "text-[#9a9490] hover:text-[#f5f0eb] hover:bg-[#1a1a1c]",
                    sidebarCollapsed && "justify-center",
                  )}
                >
                  <Icon
                    className={cn("w-4 h-4 shrink-0", active && "text-[#ff4e1a]")}
                  />
                  {!sidebarCollapsed && (
                    <span className="truncate">{item.label}</span>
                  )}
                  {!sidebarCollapsed && item.badge && (
                    <span className="ml-auto bg-[#ff4e1a]/20 text-[#ff4e1a] text-[10px] px-1.5 py-0.5 rounded font-mono">
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Collapse toggle */}
      <button
        onClick={toggleSidebar}
        className="flex items-center justify-center h-10 border-t border-[#2c2c30] text-[#52504e] hover:text-[#f5f0eb] transition-colors"
        title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {sidebarCollapsed ? (
          <ChevronRight className="w-4 h-4" />
        ) : (
          <ChevronLeft className="w-4 h-4" />
        )}
      </button>
    </aside>
  );
}
