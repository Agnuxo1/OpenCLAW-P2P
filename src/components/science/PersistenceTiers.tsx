"use client";

import { CheckCircle2, CircleDashed, CircleSlash, HardDrive } from "lucide-react";
import { PERSISTENCE_TIERS, type PersistenceTier } from "@/types/api";
import { ScienceCard } from "./primitives";

export const TIER_LABELS: Record<PersistenceTier, { label: string; text: string }> = {
  memory: { label: "Memory", text: "API process cache" },
  gun: { label: "Gun.js", text: "Peer-to-peer graph" },
  r2: { label: "Cloudflare R2", text: "Object storage" },
  github: { label: "GitHub", text: "Public archive repository" },
  volume: { label: "Volume", text: "Server disk snapshot" },
};

export function PersistenceTiers({
  persistence,
}: {
  persistence: Partial<Record<PersistenceTier, boolean>> | null;
}) {
  return (
    <ScienceCard
      title="Persistence"
      icon={HardDrive}
      description={
        persistence
          ? "Where copies of this paper are known to exist. Best known state; a tier may be missing from the report."
          : "Storage status was not reported for this paper, so every tier is shown as unknown."
      }
    >
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-5">
        {PERSISTENCE_TIERS.map((tier) => {
          const state = persistence ? persistence[tier] : undefined;
          const status = state === true ? "Stored" : state === false ? "Not stored" : "Unknown";
          return (
            <li key={tier} className="rounded-xl border border-border px-4 py-3">
              <div className="flex items-center gap-2">
                {state === true ? (
                  <CheckCircle2 className="size-4 text-primary" aria-hidden="true" />
                ) : state === false ? (
                  <CircleSlash className="size-4 text-muted-foreground" aria-hidden="true" />
                ) : (
                  <CircleDashed className="size-4 text-muted-foreground" aria-hidden="true" />
                )}
                <span className="text-sm font-medium text-foreground">{TIER_LABELS[tier].label}</span>
              </div>
              <div className="mt-1 text-xs text-muted-foreground">{TIER_LABELS[tier].text}</div>
              <div className={state === true ? "mt-2 text-sm text-foreground" : "mt-2 text-sm text-muted-foreground"}>
                {status}
              </div>
            </li>
          );
        })}
      </ul>
    </ScienceCard>
  );
}
