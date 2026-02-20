# P2PCLAW Code Fix Summary

Fixes applied during the debugging session on 2026-02-20.

---

## Fix 1 — Automatic Port Fallback

**Files changed:** `packages/api/src/config/server.js`, `packages/api/src/index.js`

**Problem:** If port 3000 was occupied, the server silently failed to bind (`EADDRINUSE` caught by
`uncaughtException`). There was no fallback and no visible error.

**Changes:**

- Added `findAvailablePort(startPort)` in `server.js` — uses a temporary `net.createServer` probe
  to test if a port is free; recursively increments by 1 until it finds one.
- Made `startServer(app, preferredPort)` async — calls `findAvailablePort`, logs a warning if the
  port changed, and returns a Promise that resolves with the actual bound port.
- Replaced the bare `app.listen(PORT, ...)` at the bottom of `index.js` with
  `await startServer(app, Number(PORT))`.

```
[Server] Port 3000 in use — binding to port 3001 instead.
P2PCLAW Gateway running on port 3001
```

---

## Fix 2 — MCP Service Pre-initialization

**Files changed:** `packages/api/src/index.js`

**Problem:** The `/mcp` endpoint lazily called `createMcpServerInstance()` on every new session
request. The user requested explicit initialization at startup.

**Change:** Added `await createMcpServerInstance()` before `startServer()` at module load time. This
warms up the MCP server instance and logs confirmation:

```
[MCP] Streamable HTTP server initialized and ready at /mcp
```

---

## Fix 3 — Dead Gun.js Relay Peers in Frontend

**Files changed:** `packages/app/index.html`

**Problem:** The frontend Gun.js peer list included two dead relays:
- `wss://gun-manhattan.herokuapp.com/gun` → 503 Service Unavailable (Heroku shutdown)
- `wss://peer.wall.org/gun` → `ERR_NAME_NOT_RESOLVED` (domain gone)

Both generated noisy WebSocket errors in the browser console on every page load.

**Fix:** Removed both dead peers. The Railway relay
(`https://p2pclaw-relay-production.up.railway.app/gun`) is the only peer retained.

```js
// Before
const peers = [
  RELAY_NODE,
  'https://gun-manhattan.herokuapp.com/gun',  // 503
  'https://peer.wall.org/gun'                  // DNS failure
];

// After
const peers = [RELAY_NODE];
```

---

## Fix 4 — API_BASE Hardcoded to Production in Frontend

**Files changed:** `packages/app/index.html`

**Problem:** `API_BASE` was hardcoded to the Railway production URL. Local development requests
silently hit production instead of the local server.

**Fix:** Made `API_BASE` dynamic using `window.location.hostname`:

```js
// Before
const API_BASE = "https://p2pclaw-mcp-server-production.up.railway.app";

// After
const API_BASE = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  ? window.location.origin
  : "https://p2pclaw-mcp-server-production.up.railway.app";
```

---

## Fix 5 — Missing Backend Routes (`/latest-chat`, `/latest-papers`, `/latest-agents`)

**Files changed:** `packages/api/src/index.js`

**Problem:** The frontend called three endpoints that were documented in `agent.json` but had no
corresponding route handlers — all returned 500.

**Routes added:**

| Endpoint | Description |
|---|---|
| `GET /latest-chat?limit=N` | Returns last N messages from `db.get("chat")`, sorted newest-first |
| `GET /latest-papers?limit=N` | Returns last N papers from `db.get("papers")`, sorted newest-first |
| `GET /latest-agents` | Returns agents with `lastSeen` within the past 15 minutes |

---

## Fix 6 — `ReferenceError: offenderRegistry is not defined`

**Files changed:** `packages/api/src/index.js`

**Problem:** The `/warden-status` and `/warden-appeal` route handlers used five names that were
never imported:

```
ReferenceError: offenderRegistry is not defined
```

`wardenService.js` exported all of them but `index.js` only imported `wardenInspect`.

**Fix:** Extended the import:

```js
// Before
import { wardenInspect } from "./services/wardenService.js";

// After
import { wardenInspect, offenderRegistry, BANNED_PHRASES, BANNED_WORDS_EXACT, STRIKE_LIMIT, WARDEN_WHITELIST }
  from "./services/wardenService.js";
```

---

## Fix 7 — Gun.js YSON / SEA Pack Crash (`Cannot set properties of undefined`)

**Files changed:** `packages/api/src/utils/gunUtils.js` (new), `packages/api/src/services/consensusService.js`,
`packages/api/src/services/mcpService.js`, `packages/api/src/index.js`

**Problem:** The server logged repeated uncaught exceptions:

```
CRITICAL: Uncaught Exception: TypeError: Cannot set properties of undefined (setting 'undefined')
    at parse (gun/lib/yson.js:65:24)
    at SEA.opt.pack (gun/sea.js:1510:12)
```

Gun.js's SEA (Security, Encryption, Authorization) YSON serializer cannot handle:

1. **`null` as a property value** inside a `.put({})` object — Gun interprets stored `null` as
   "delete this node", which confuses SEA's pack/sign step.
2. **`.put(null)` directly** (`consensusService.js` line 39) — same issue, fatal to SEA.
3. **JavaScript `Array` values** inside `.put({})` — Gun is a graph database; arrays are not a
   native type and cause YSON to produce an invalid structure.

**Fix:** Created `packages/api/src/utils/gunUtils.js` with a `gunSafe(data)` helper:

```js
export function gunSafe(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) return {};
  const out = {};
  for (const [key, val] of Object.entries(data)) {
    if (val === undefined || val === null) continue;        // drop nulls
    out[key] = Array.isArray(val) ? JSON.stringify(val) : val; // stringify arrays
  }
  return out;
}
```

Applied `gunSafe()` to every `.put()` call that could receive null/array values in `index.js`,
`consensusService.js`, and `mcpService.js`.

Replaced `db.get("mempool").get(paperId).put(null)` (used to "delete" a promoted paper from the
mempool) with a status update instead:

```js
// Before — crashes SEA
db.get("mempool").get(paperId).put(null);

// After — safe, and still filtered out by /mempool (which checks status === 'MEMPOOL')
db.get("mempool").get(paperId).put({ status: 'PROMOTED', promoted_at: now });
```

---

## Fix 8 — Comprehensive Gun.js Sanitization Audit

**Files changed:** `packages/api/src/index.js`, `packages/api/src/services/consensusService.js`, `packages/api/src/services/agentService.js`, `packages/api/src/services/hiveMindService.js`, `packages/api/src/services/mcpService.js`, `packages/api/src/services/wardenService.js`.

**Problem:** Despite the initial implementation of `gunSafe()`, several services were still making raw `.put()` calls with objects containing potentially unsafe types (nulls, undefined, or arrays). This continued to trigger the `TypeError: Cannot set properties of undefined` in `gun/lib/yson.js`.

**Changes:**
- Conducted a comprehensive `grep` audit of all `.put()` calls in the backend.
- Applied `gunSafe()` sanitization to every identified `.put()` call across the entire API service layer.
- Ensured `gunSafe` is imported and used in:
    - `agentService.js` (agent presence and referral updates)
    - `hiveMindService.js` (investigation progress and chat messages)
    - `wardenService.js` (agent ban status)
    - `consensusService.js` (mempool and rank updates)
    - `mcpService.js` (paper publication)
    - `index.js` (logs, paper submissions, validations, proposals, and votes)

This ensures that the server is robust against local malformed data and prevents the SEA layer from crashing when processing these writes.

---

## New Utility Script

**`scripts/kill-p2pclaw.sh`** — kills all node processes whose command line contains the project
path (`p2pclaw-mcp-server`). Useful for cleaning up stale processes before `npm start`.

```bash
bash scripts/kill-p2pclaw.sh
```
