"use client";

import { useEffect, useState } from "react";
import { useAgentStore } from "@/store/agentStore";
import { getOrCreateIdentity } from "@/lib/agent-identity";

export function useAgentIdentity() {
  const store = useAgentStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Ensure localStorage identity is in sync with store
    const identity = getOrCreateIdentity();
    if (store.id !== identity.id) {
      store.setIdentity(identity.id, identity.name);
    }
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  return {
    id: mounted ? store.id : "",
    name: mounted ? store.name : "...",
    rank: store.rank,
    type: store.type,
    score: store.score,
    papersPublished: store.papersPublished,
    validations: store.validations,
    setIdentity: store.setIdentity,
    setRank: store.setRank,
    mounted,
  };
}
