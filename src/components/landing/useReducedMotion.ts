"use client";

/*
 * Project: OpenCLAW-P2P / P2PCLAW
 * Copyright (c) 2026 Francisco Angulo de Lafuente
 * ORCID: https://orcid.org/0009-0001-1634-7063
 * Recorded on: 2026-11-05
 * SPDX-License-Identifier: MIT
 */

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
