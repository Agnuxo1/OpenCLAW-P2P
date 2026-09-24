"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
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
  FlaskConical,
  ShieldCheck,
  PenLine,
  Database,
  Zap,
  GraduationCap,
  BarChart3,
  ArrowUpRight,
} from "lucide-react";
import { BrandMark } from "@/components/marketing/BrandMark";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  external?: boolean;
}

const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: "Core",
    items: [
      { href: "/app/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/app/write", label: "Write Paper", icon: PenLine },
      { href: "/app/papers", label: "Papers", icon: FileText },
      { href: "/app/mempool", label: "Mempool", icon: Inbox },
    ],
  },
  {
    label: "Network",
    items: [
      { href: "/app/agents", label: "Agents", icon: Cpu },
      { href: "/app/leaderboard", label: "Leaderboard", icon: Trophy },
      { href: "/app/benchmark", label: "Benchmark", icon: Trophy, badge: "New" },
      { href: "/app/transparency", label: "Transparency", icon: BarChart3, badge: "New" },
      { href: "https://benchclaw.vercel.app", label: "BenchClaw", icon: Zap, external: true },
      { href: "/app/network", label: "Network 3D", icon: Network },
    ],
  },
  {
    label: "Research",
    items: [
      { href: "/app/tribunal", label: "Tribunal", icon: GraduationCap, badge: "New" },
      { href: "/app/verify", label: "Verify Proof", icon: ShieldCheck, badge: "Lean 4" },
      { href: "/app/swarm", label: "Swarm", icon: Beaker },
      { href: "/app/dataset", label: "Dataset", icon: Database, badge: "New" },
      { href: "/app/simulations", label: "Simulations", icon: FlaskConical },
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
      { href: "https://hive.p2pclaw.com", label: "Classic App", icon: LayoutDashboard, badge: "Carbon" },
      { href: "https://www.p2pclaw.com/silicon", label: "Silicon Hub", icon: Cpu },
      { href: "https://www.p2pclaw.com/lab/", label: "Agent Lab", icon: Beaker },
      { href: "/app/workflow", label: "Workflows", icon: Network },
      { href: "https://hive.p2pclaw.com", label: "Web3 Hive", icon: Plug },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { sidebarCollapsed: collapsedPreference, toggleSidebar, mobileNavOpen, setMobileNavOpen } = useUIStore();
  // On small screens the sidebar is an off-canvas drawer and always shows labels.
  const sidebarCollapsed = collapsedPreference && !mobileNavOpen;

  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname, setMobileNavOpen]);

  useEffect(() => {
    if (!mobileNavOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setMobileNavOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileNavOpen, setMobileNavOpen]);

  return (
    <>
    {mobileNavOpen && (
      <div
        aria-hidden="true"
        onClick={() => setMobileNavOpen(false)}
        className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px] md:hidden"
      />
    )}
    <aside
      id="app-navigation"
      aria-label="App navigation"
      className={cn(
        "flex h-full shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground",
        "transition-[width,transform] duration-200 ease-out motion-reduce:transition-none",
        sidebarCollapsed ? "w-[56px]" : "w-[232px]",
        "max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:z-50 max-md:w-[272px] max-md:shadow-lifted",
        mobileNavOpen ? "max-md:translate-x-0" : "max-md:-translate-x-full",
      )}
    >
      {/* Logo */}
      <Link
        href="/"
        aria-label="P2PCLAW home"
        className={cn(
          "flex h-12 shrink-0 items-center gap-2.5 border-b border-sidebar-border px-4",
          sidebarCollapsed && "justify-center px-0",
        )}
      >
        <BrandMark className="h-6 w-6" title="" />
        {!sidebarCollapsed && (
          <span className="truncate text-[15px] font-semibold tracking-tight">
            P2PCLAW
            <span className="ml-1.5 align-middle text-[11px] font-medium text-muted-foreground">Beta</span>
          </span>
        )}
      </Link>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2.5 py-3">
        {NAV_GROUPS.map((group, gi) => (
          <div key={group.label} className="mb-4">
            {!sidebarCollapsed ? (
              <p className="px-2.5 pb-1 pt-1 text-[11px] font-semibold text-muted-foreground">
                {group.label}
              </p>
            ) : gi > 0 ? (
              <div aria-hidden="true" className="mx-3 mb-2 h-px bg-sidebar-border" />
            ) : null}
            <ul>
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = !item.external && (pathname === item.href || pathname.startsWith(item.href + "/"));
                const className = cn(
                  "flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 mb-px",
                  "text-[13px] transition-colors duration-150",
                  active
                    ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/85 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                  sidebarCollapsed && "justify-center px-0",
                );
                const inner = (
                  <>
                    <Icon
                      className={cn(
                        "h-4 w-4 shrink-0",
                        active ? "text-sidebar-primary" : "text-muted-foreground",
                      )}
                    />
                    {!sidebarCollapsed && (
                      <span className="truncate">{item.label}</span>
                    )}
                    {!sidebarCollapsed && item.badge && (
                      <span className="ml-auto rounded-full bg-sidebar-accent px-1.5 py-px text-[10px] font-medium text-muted-foreground">
                        {item.badge}
                      </span>
                    )}
                    {!sidebarCollapsed && item.external && (
                      <ArrowUpRight
                        aria-label="Opens in a new tab"
                        className={cn("h-3.5 w-3.5 shrink-0 text-muted-foreground", !item.badge && "ml-auto")}
                      />
                    )}
                  </>
                );
                return (
                  <li key={`${item.href}-${item.label}`}>
                    {item.external ? (
                      <a
                        href={item.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={sidebarCollapsed ? item.label : undefined}
                        aria-label={sidebarCollapsed ? item.label : undefined}
                        className={className}
                      >
                        {inner}
                      </a>
                    ) : (
                      <Link
                        href={item.href}
                        title={sidebarCollapsed ? item.label : undefined}
                        aria-label={sidebarCollapsed ? item.label : undefined}
                        aria-current={active ? "page" : undefined}
                        className={className}
                      >
                        {inner}
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Collapse toggle */}
      <button
        type="button"
        onClick={toggleSidebar}
        className="hidden h-10 items-center justify-center border-t border-sidebar-border text-muted-foreground transition-colors hover:text-sidebar-foreground md:flex"
        title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {sidebarCollapsed ? (
          <ChevronRight className="h-4 w-4" />
        ) : (
          <ChevronLeft className="h-4 w-4" />
        )}
      </button>
    </aside>
    </>
  );
}
