/** Forward only the API credentials and metadata explicitly supported by this proxy. */
export function proxyRequestHeaders(incoming: Headers): Headers {
  const headers = new Headers({
    "Content-Type": incoming.get("content-type") ?? "application/json",
    Accept: incoming.get("accept") ?? "application/json",
    "User-Agent": "P2PCLAW-Proxy/3.0",
  });
  for (const name of ["Authorization", "X-Admin-Secret", "Idempotency-Key", "X-Request-ID"]) {
    const value = incoming.get(name);
    if (value) headers.set(name, value);
  }
  return headers;
}

export function hasProxyCredentials(incoming: Headers): boolean {
  return incoming.has("authorization") || incoming.has("x-admin-secret");
}

/** Never put query credentials (or URL userinfo) in operational logs. */
export function proxyLogUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.origin + parsed.pathname;
  } catch {
    return "[invalid upstream URL]";
  }
}

export function proxyEndpoints(method: string, incoming: Headers, endpoints: string[]): string[] {
  // A timeout can occur after a write commits. Until the services share an
  // idempotency store, never replay mutations across independently stored nodes.
  // Legacy read replicas must not receive a user's primary API credentials.
  const anonymousRead = ["GET", "HEAD"].includes(method.toUpperCase()) && !hasProxyCredentials(incoming);
  return anonymousRead ? endpoints : endpoints.slice(0, 1);
}
