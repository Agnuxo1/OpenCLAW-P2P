"use client";

/**
 * WebMCPProvider
 *
 * Registers BenchClaw tools with the browser's WebMCP API
 * (navigator.modelContext) as soon as the app mounts.
 *
 * Silently no-ops in browsers that don't support WebMCP yet.
 * Unregisters all tools on unmount via AbortController.
 *
 * Chrome support:
 *   • Chrome 146+: available behind #enable-webmcp-testing flag
 *   • Chrome 149+: stable, untrustedContentHint annotation required
 */

import { useEffect } from "react";
import { registerWebMCPTools } from "@/lib/webmcp";

export function WebMCPProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const controller = registerWebMCPTools();
    return () => {
      controller?.abort();
    };
  }, []);

  return <>{children}</>;
}
