"use client";

import { useEffect, useState } from "react";
import { useAgentStore } from "@/store/agentStore";
import { getOrCreateIdentity } from "@/lib/agent-identity";

export function useAgentIdentity() {
  const store = useAgentStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Load real Ed25519 DID
    import("@/lib/did").then(({ loadOrCreateDID }) => {
      const didIdentity = loadOrCreateDID();
      // Use DID as the primary identity
      store.setDID(didIdentity.did, didIdentity.publicKey);
      store.setIdentity(didIdentity.did, store.name); // id = DID
    }).catch(() => {
      // Fallback to random identity
      const identity = getOrCreateIdentity();
      if (store.id !== identity.id) store.setIdentity(identity.id, identity.name);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    id: mounted ? store.id : "",
    did: mounted ? store.did : "",
    publicKey: mounted ? store.publicKey : "",
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
