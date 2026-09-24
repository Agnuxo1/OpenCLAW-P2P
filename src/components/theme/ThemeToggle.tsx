"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "./useTheme";
import type { ThemePreference } from "./theme-script";

const ORDER: ThemePreference[] = ["system", "light", "dark"];
const META: Record<ThemePreference, { label: string; Icon: typeof Sun }> = {
  system: { label: "System appearance", Icon: Monitor },
  light: { label: "Light appearance", Icon: Sun },
  dark: { label: "Dark appearance", Icon: Moon },
};

/**
 * Single icon button that cycles System → Light → Dark.
 * Accessible name announces the current state and the next action.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { preference, setPreference } = useTheme();
  const next = ORDER[(ORDER.indexOf(preference) + 1) % ORDER.length];
  const { label, Icon } = META[preference];

  return (
    <button
      type="button"
      onClick={() => setPreference(next)}
      aria-label={`${label}. Switch to ${META[next].label.toLowerCase()}`}
      title={`${label} — click for ${META[next].label.toLowerCase()}`}
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground",
        "transition-colors hover:bg-accent hover:text-foreground",
        className,
      )}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
    </button>
  );
}
