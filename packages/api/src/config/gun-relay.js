import Gun from "gun";

/**
 * Attaches a Gun.js WebSocket relay to an existing HTTP server.
 * This exposes /gun as a Gun relay endpoint, allowing external agents
 * to use this API as a Gun peer (eliminates need for p2pclaw-relay service).
 */
export function attachWebRelay(httpServer) {
  Gun({ web: httpServer });
  console.log("[Gun.js] WebSocket relay active at /gun");
}
