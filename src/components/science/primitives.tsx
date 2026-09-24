"use client";

import type { ComponentType, ReactNode } from "react";
import { CircleDashed } from "lucide-react";
import { cn } from "@/lib/utils";

type IconType = ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" | "false" }>;

/** Rounded, hairline-bordered surface used by every science panel. */
export function ScienceCard({
  title,
  description,
  icon: Icon,
  action,
  children,
  className,
  headingLevel = 3,
  id,
}: {
  title: string;
  description?: ReactNode;
  icon?: IconType;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  headingLevel?: 2 | 3;
  id?: string;
}) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  const headingId = id ? `${id}-title` : undefined;
  return (
    <section
      aria-labelledby={headingId}
      className={cn("rounded-2xl border border-border bg-card text-card-foreground p-6 md:p-8", className)}
    >
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="min-w-0">
          <Heading id={headingId} className="flex items-center gap-2 text-lg font-semibold tracking-tight text-foreground">
            {Icon && <Icon className="size-5 text-muted-foreground shrink-0" aria-hidden="true" />}
            {title}
          </Heading>
          {description && <p className="mt-1 text-sm text-muted-foreground leading-relaxed">{description}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      {children}
    </section>
  );
}

/** Calm empty state: the data simply is not published for this item yet. */
export function NotAvailable({
  children = "Not available for this paper yet.",
  className,
}: {
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div
      role="status"
      className={cn(
        "flex items-center gap-3 rounded-xl border border-dashed border-border bg-muted/40 px-4 py-5 text-sm text-muted-foreground",
        className,
      )}
    >
      <CircleDashed className="size-4 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </div>
  );
}

/** A large number with a label. Renders an em dash (never a fake zero) for null. */
export function Stat({
  label,
  value,
  hint,
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-2xl border border-border bg-card p-5", className)}>
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="mt-1 text-3xl font-semibold tracking-tight tabular-nums text-foreground">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground leading-relaxed">{hint}</div>}
    </div>
  );
}

export function Pill({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: "neutral" | "primary" | "strong" | "muted" | "destructive" | "dashed";
  className?: string;
}) {
  const tones: Record<string, string> = {
    neutral: "border-border bg-muted text-foreground",
    primary: "border-primary/30 bg-primary/10 text-primary",
    strong: "border-foreground/30 bg-background text-foreground font-semibold",
    muted: "border-border bg-transparent text-muted-foreground",
    destructive: "border-destructive/40 bg-destructive/10 text-destructive font-semibold",
    dashed: "border-dashed border-border bg-transparent text-muted-foreground",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function fmt(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return value.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function fmtInt(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return Math.round(value).toLocaleString();
}

export function fmtPct(ratio: number | null | undefined, digits = 0): string {
  if (ratio === null || ratio === undefined || !Number.isFinite(ratio)) return "—";
  return `${(ratio * 100).toFixed(digits)}%`;
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const t = Date.parse(iso);
  return Number.isFinite(t) ? new Date(t).toLocaleString() : iso;
}

/** Human label for snake_case identifiers coming from the API. */
export function humanize(key: string): string {
  const s = key.replace(/[_:-]+/g, " ").trim();
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : key;
}
