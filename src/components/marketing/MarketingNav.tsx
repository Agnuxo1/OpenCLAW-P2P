"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { BrandWordmark } from "./BrandMark";

export const MARKETING_LINKS = [
  { href: "/app/papers", label: "Papers" },
  { href: "/app/benchmark", label: "Benchmark" },
  { href: "/app/tribunal", label: "Tribunal" },
  { href: "/app/transparency", label: "Transparency" },
  { href: "/lab", label: "Lab" },
  { href: "/app/connect", label: "Connect" },
] as const;

/** Sticky, translucent top navigation for public pages. */
export function MarketingNav() {
  const [open, setOpen] = useState(false);

  return (
    <header className="frosted sticky top-0 z-50 border-b border-hairline">
      <nav
        aria-label="Primary"
        className="mx-auto flex h-12 max-w-[1080px] items-center gap-6 px-5"
      >
        <Link href="/" aria-label="P2PCLAW home" className="shrink-0">
          <BrandWordmark />
        </Link>

        <ul className="ml-auto hidden items-center gap-7 md:flex">
          {MARKETING_LINKS.map((l) => (
            <li key={l.href}>
              <Link
                href={l.href}
                className="text-[13px] text-foreground/80 transition-colors hover:text-foreground"
              >
                {l.label}
              </Link>
            </li>
          ))}
        </ul>

        <div className="ml-auto flex items-center gap-2 md:ml-0">
          <ThemeToggle />
          <Link
            href="/app/dashboard"
            className="hidden rounded-full bg-primary px-3.5 py-1.5 text-[13px] font-medium text-primary-foreground transition-colors hover:bg-[var(--primary-hover)] sm:inline-flex"
          >
            Open App
          </Link>
          <button
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-foreground/80 hover:bg-accent md:hidden"
            aria-expanded={open}
            aria-controls="marketing-mobile-menu"
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((o) => !o)}
          >
            {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </nav>

      {open && (
        <div id="marketing-mobile-menu" className="border-t border-hairline md:hidden">
          <ul className="mx-auto max-w-[1080px] px-5 py-3">
            {MARKETING_LINKS.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="block border-b border-hairline py-3 text-[17px] text-foreground last:border-0"
                >
                  {l.label}
                </Link>
              </li>
            ))}
            <li className="pt-3">
              <Link
                href="/app/dashboard"
                onClick={() => setOpen(false)}
                className="inline-flex rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
              >
                Open App
              </Link>
            </li>
          </ul>
        </div>
      )}
    </header>
  );
}
