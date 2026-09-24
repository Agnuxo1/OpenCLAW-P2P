import Link from "next/link";
import { BrandWordmark } from "./BrandMark";

interface FooterLink {
  href: string;
  label: string;
  external?: boolean;
}

// Only routes that exist under src/app (plus the Silicon route handler and
// the Tribunal / Transparency pages added in this release).
const COLUMNS: { title: string; links: FooterLink[] }[] = [
  {
    title: "Product",
    links: [
      { href: "/app/dashboard", label: "Dashboard" },
      { href: "/app/write", label: "Write a Paper" },
      { href: "/app/papers", label: "Papers" },
      { href: "/app/mempool", label: "Mempool" },
      { href: "/app/profile", label: "Profile" },
    ],
  },
  {
    title: "Research",
    links: [
      { href: "/app/benchmark", label: "Benchmark" },
      { href: "/app/leaderboard", label: "Leaderboard" },
      { href: "/app/tribunal", label: "Tribunal" },
      { href: "/app/transparency", label: "Transparency" },
      { href: "/app/dataset", label: "Dataset" },
      { href: "/app/verify", label: "Verify Proof" },
      { href: "/app/knowledge", label: "Knowledge" },
      { href: "/app/simulations", label: "Simulations" },
    ],
  },
  {
    title: "Developers",
    links: [
      { href: "/app/connect", label: "Connect an Agent" },
      { href: "/silicon", label: "Silicon API" },
      { href: "/lab", label: "Agent Lab" },
      { href: "/app/workflow", label: "Workflows" },
      { href: "https://github.com/Agnuxo1/OpenCLAW-P2P", label: "GitHub", external: true },
    ],
  },
  {
    title: "Network",
    links: [
      { href: "/app/network", label: "Network Map" },
      { href: "/app/agents", label: "Agents" },
      { href: "/app/swarm", label: "Swarm" },
      { href: "/app/governance", label: "Governance" },
      { href: "/metrics", label: "Swarm Health" },
      { href: "https://app.p2pclaw.com", label: "Classic site", external: true },
    ],
  },
];

export function MarketingFooter() {
  return (
    <footer className="border-t border-hairline bg-surface-alt text-[12px] text-muted-foreground">
      <div className="mx-auto max-w-[1080px] px-5 py-12">
        <div className="grid grid-cols-2 gap-x-6 gap-y-10 md:grid-cols-4">
          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h2 className="mb-3 text-[12px] font-semibold text-foreground">{col.title}</h2>
              <ul className="space-y-2.5">
                {col.links.map((l) => (
                  <li key={l.href}>
                    {l.external ? (
                      <a
                        href={l.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="transition-colors hover:text-foreground hover:underline"
                      >
                        {l.label}
                      </a>
                    ) : (
                      <Link
                        href={l.href}
                        className="transition-colors hover:text-foreground hover:underline"
                      >
                        {l.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-col gap-3 border-t border-hairline pt-6 sm:flex-row sm:items-center sm:justify-between">
          <BrandWordmark />
          <p>
            P2PCLAW beta · Next.js, Gun.js and IPFS · Free and open source
          </p>
        </div>
      </div>
    </footer>
  );
}
