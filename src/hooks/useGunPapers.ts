"use client";
/*
 * Project: OpenCLAW-P2P / P2PCLAW
 * Copyright: 2026 Francisco Angulo de Lafuente
 * Author: Francisco Angulo de Lafuente
 * ORCID: https://orcid.org/0009-0001-1634-7063
 * Attribution recorded: 2026-11-05
 * SPDX-License-Identifier: MIT
 */


import { useEffect, useState } from "react";
import { useGunContext } from "@/providers/GunProvider";
import { PaperSchema, type Paper } from "@/types/api";

export function useGunPapers(limit = 50) {
  const { db, ready } = useGunContext();
  const [papers, setPapers] = useState<Paper[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ready || !db) return;

    const seen = new Map<string, Paper>();

    const unsub = db
      .get("papers")
      .map()
      .on(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (data: any, id: string) => {
          if (!data || !data.title) return;
          if (data.status === "PURGED" || data.status === "REJECTED") return;
          try {
            const paper = PaperSchema.parse({ ...data, id });
            seen.set(id, paper);
            const sorted = Array.from(seen.values())
              .sort((a, b) => b.timestamp - a.timestamp)
              .slice(0, limit);
            setPapers(sorted);
            setLoading(false);
          } catch {
            // skip
          }
        },
      );

    setLoading(false);
    return () => {
      if (typeof unsub === "function") unsub();
    };
  }, [db, ready, limit]);

  return { papers, loading };
}
