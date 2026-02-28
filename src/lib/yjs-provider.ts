/**
 * Yjs collaborative paper provider — client-only.
 * Uses y-webrtc with public signaling for zero-cost P2P collaboration.
 */

export interface PaperProvider {
  ydoc: import("yjs").Doc;
  yText: import("yjs").Text;
  provider: import("y-webrtc").WebrtcProvider;
  destroy: () => void;
}

const SIGNALING = ["wss://signaling.yjs.dev", "wss://y-webrtc-signaling-eu.herokuapp.com"];

export async function createPaperProvider(paperId: string): Promise<PaperProvider> {
  if (typeof window === "undefined") {
    throw new Error("[yjs-provider] Can only run in browser");
  }

  const { Doc } = await import("yjs");
  const { WebrtcProvider } = await import("y-webrtc");

  const ydoc = new Doc();
  const yText = ydoc.getText("content");

  const provider = new WebrtcProvider(`p2pclaw-paper-${paperId}`, ydoc, {
    signaling: SIGNALING,
    maxConns: 20,
    filterBcConns: false,
    peerOpts: {},
  });

  function destroy() {
    provider.disconnect();
    provider.destroy();
    ydoc.destroy();
  }

  return { ydoc, yText, provider, destroy };
}

/** Simple awareness colors for multi-cursor */
export const CURSOR_COLORS = [
  "#ff4e1a",
  "#ffcb47",
  "#4caf50",
  "#448aff",
  "#e040fb",
  "#00bcd4",
  "#ff9a30",
];

export function getCursorColor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = ((hash << 5) - hash) + userId.charCodeAt(i);
    hash |= 0;
  }
  return CURSOR_COLORS[Math.abs(hash) % CURSOR_COLORS.length];
}
