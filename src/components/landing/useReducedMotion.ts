"use client";

import { useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(cb: () => void) {
  try {
    const mq = window.matchMedia(QUERY);
    mq.addEventListener("change", cb);
    return () => mq.removeEventListener("change", cb);
  } catch {
    return () => {};
  }
}

function getSnapshot() {
  try {
    return window.matchMedia(QUERY).matches;
  } catch {
    return false;
  }
}

/** True when the user asked the OS to minimise motion. */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
