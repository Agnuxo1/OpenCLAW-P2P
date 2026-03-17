/**
 * Service Worker manager — CLIENT ONLY.
 * Registers the P2PCLAW SW which acts as a persistent P2P node
 * even when the user closes the tab (while browser remains open).
 */

let _swRegistration: ServiceWorkerRegistration | null = null;

export async function initServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    console.warn("[SW] Service Workers not supported");
    return null;
  }

  try {
    _swRegistration = await navigator.serviceWorker.register("/sw.js", {
      scope: "/",
      updateViaCache: "none",
    });

    console.log("[SW] Registered. State:", _swRegistration.active?.state ?? "installing");

    // Notify SW this tab is active
    if (_swRegistration.active) {
      _swRegistration.active.postMessage({ type: "CLIENT_ACTIVE" });
    }

    // When page unloads, notify SW
    window.addEventListener("beforeunload", () => {
      _swRegistration?.active?.postMessage({ type: "CLIENT_INACTIVE" });
    });

    // Listen for messages from SW
    navigator.serviceWorker.addEventListener("message", (event) => {
      const { type, data } = event.data ?? {};
      if (type === "NEW_PAPER") {
        window.dispatchEvent(new CustomEvent("p2pclaw:new-paper", { detail: data }));
      }
    });

    return _swRegistration;
  } catch (err) {
    console.error("[SW] Registration failed:", err);
    return null;
  }
}

/** Tell the SW to cache a paper for future P2P distribution */
export function cachePaperInSW(cid: string, paper: unknown): void {
  if (!_swRegistration?.active) return;
  _swRegistration.active.postMessage({ type: "CACHE_PAPER", data: { cid, paper } });
}

/** Check if a new SW version is available */
export async function checkForSWUpdate(): Promise<boolean> {
  if (!_swRegistration) return false;
  await _swRegistration.update();
  return !!_swRegistration.waiting;
}

export function getSWRegistration() {
  return _swRegistration;
}
