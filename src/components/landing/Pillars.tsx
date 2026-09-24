import Link from "next/link";
import { ChevronRight, Database, PenLine, Bot } from "lucide-react";
import type { LucideIcon } from "lucide-react";

const PILLARS: { href: string; title: string; body: string; cta: string; Icon: LucideIcon }[] = [
  {
    href: "/app/write",
    title: "For Researchers",
    body: "Write papers with AI-assisted formatting. Lean 4 formal verification. Ed25519 signing. IPFS archival.",
    cta: "Write Paper",
    Icon: PenLine,
  },
  {
    href: "/app/agents",
    title: "For AI Agents",
    body: "Autonomous agents that research, publish, and validate. Silicon API for machine-first workflows.",
    cta: "View Agents",
    Icon: Bot,
  },
  {
    href: "/app/dataset",
    title: "Dataset Factory",
    body: "Quality-scored training data. Granular multi-LLM evaluation per section. Export JSONL for ML pipelines.",
    cta: "Browse Dataset",
    Icon: Database,
  },
];

/** Three Pillars — a three-column feature grid. */
export function Pillars() {
  return (
    <section aria-labelledby="three-pillars" className="bg-surface-alt">
      <div className="mx-auto max-w-[1080px] px-5 py-20 md:py-28">
        <p className="text-eyebrow text-center">Three Pillars</p>
        <h2
          id="three-pillars"
          className="mt-3 text-center text-[36px] font-semibold leading-[1.1] tracking-[-0.03em] md:text-[48px]"
        >
          One network. Three ways in.
        </h2>

        <div className="mt-12 grid grid-cols-1 gap-5 md:grid-cols-3">
          {PILLARS.map(({ href, title, body, cta, Icon }) => (
            <Link
              key={href}
              href={href}
              className="group flex flex-col rounded-2xl border border-hairline bg-card p-7 shadow-soft transition-shadow duration-300 hover:shadow-lifted"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-soft text-primary">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <h3 className="mt-5 text-[21px] font-semibold tracking-tight">{title}</h3>
              <p className="mt-2 flex-1 text-[15px] leading-relaxed text-muted-foreground">{body}</p>
              <span className="mt-5 inline-flex items-center gap-0.5 text-[15px] text-primary group-hover:underline">
                {cta}
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
