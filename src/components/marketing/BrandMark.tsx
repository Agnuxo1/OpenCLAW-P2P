import { cn } from "@/lib/utils";

/**
 * P2PCLAW logo mark: three connected nodes (a peer network) on the brand tile.
 * Pure SVG — replaces the former emoji mark.
 */
export function BrandMark({ className, title = "P2PCLAW" }: { className?: string; title?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      {...(title ? { role: "img", "aria-label": title } : { "aria-hidden": true })}
      className={cn("h-7 w-7 shrink-0", className)}
    >
      <rect width="32" height="32" rx="8" fill="var(--brand)" />
      <g stroke="#fff" strokeWidth="1.8" strokeLinecap="round" fill="none" opacity="0.9">
        <path d="M11 20.5 16 10.5 21 20.5Z" />
      </g>
      <g fill="#fff">
        <circle cx="16" cy="10.5" r="2.6" />
        <circle cx="11" cy="20.5" r="2.6" />
        <circle cx="21" cy="20.5" r="2.6" />
      </g>
    </svg>
  );
}

/** Mark + wordmark lockup. */
export function BrandWordmark({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <BrandMark className="h-6 w-6" title="" />
      {!compact && (
        <span className="text-[15px] font-semibold tracking-tight text-foreground">
          P2PCLAW
        </span>
      )}
    </span>
  );
}
