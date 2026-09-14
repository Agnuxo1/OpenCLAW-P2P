// Exercise the actual Next route proxy with mock upstream HTTP, without contacting production.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import ts from "typescript";
import { NextRequest } from "next/server.js";

const require = createRequire(import.meta.url);
const source = readFileSync(new URL("../src/lib/proxy.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
  .replace('"next/server"', JSON.stringify(pathToFileURL(require.resolve("next/server.js")).href))
  .replace('"@/lib/proxy-policy"', JSON.stringify(new URL("../src/lib/proxy-policy.ts", import.meta.url).href));
const { proxyToRailway } = await import("data:text/javascript;base64," + Buffer.from(compiled).toString("base64"));

function quiet(t) {
  for (const name of ["log", "warn", "error"]) t.mock.method(console, name, () => {});
}

test("anonymous GET retries a failed primary and returns the next read response", async t => {
  quiet(t);
  const calls = [];
  t.mock.method(globalThis, "fetch", async (url, options) => {
    calls.push({ url, options });
    return calls.length === 1 ? Response.json({ error: "down" }, { status: 503 }) : Response.json({ total: 266 });
  });
  const response = await proxyToRailway(new NextRequest("https://site.test/api/dataset/stats"), "", ["dataset", "stats"]);
  assert.equal(calls.length, 2);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { total: 266 });
});

test("publication forwards its body and metadata once and never replays a failed write", async t => {
  quiet(t);
  const calls = [];
  t.mock.method(globalThis, "fetch", async (url, options) => { calls.push({ url, options }); throw new Error("connection lost after possible commit"); });
  const body = JSON.stringify({ title: "Research result", content: "Original publication body" });
  const req = new NextRequest("https://site.test/api/publish-paper", { method: "POST", body, headers: { Authorization: "Bearer test", "Idempotency-Key": "paper-1", "X-Request-ID": "trace-1" } });
  const response = await proxyToRailway(req, "", ["publish-paper"]);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].options.body, body);
  assert.equal(calls[0].options.headers.get("authorization"), "Bearer test");
  assert.equal(calls[0].options.headers.get("idempotency-key"), "paper-1");
  assert.equal(calls[0].options.headers.get("x-request-id"), "trace-1");
  assert.equal(response.status, 503);
  assert.equal((await response.json()).retryable, false);
});

for (const [name, value] of [["Authorization", "Bearer test"], ["X-Admin-Secret", "admin-test"]]) {
test(`${name} reads never expose credentials to replicas and cannot be cached publicly`, async t => {
  quiet(t);
  const calls = [];
  t.mock.method(globalThis, "fetch", async (url, options) => { calls.push({ url, options }); return Response.json({ private: true }, { headers: { "Cache-Control": "public, max-age=60", "CDN-Cache-Control": "max-age=60", "Vercel-CDN-Cache-Control": "max-age=60" } }); });
  const response = await proxyToRailway(new NextRequest("https://site.test/api/agent-memory/me", { headers: { [name]: value } }), "", ["agent-memory", "me"]);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].options.headers.get(name), value);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.equal(response.headers.has("cdn-cache-control"), false);
  assert.equal(response.headers.has("vercel-cdn-cache-control"), false);
});
}

test("admin request failures remain private and query credentials never reach logs", async t => {
  const messages = [];
  for (const name of ["log", "warn", "error"]) t.mock.method(console, name, (...parts) => { messages.push(parts.join(" ")); });
  let attempts = 0;
  t.mock.method(globalThis, "fetch", async url => {
    attempts++;
    // Real transport errors may repeat the URL; logging this object would leak it.
    throw new Error(`Failure at ${url}`);
  });
  const request = new NextRequest("https://site.test/api/admin/status?secret=private-query&admin_token=private-token", { headers: { "X-Admin-Secret": "private-header" } });
  const response = await proxyToRailway(request, "", ["admin", "status"]);
  assert.equal(response.status, 503);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.equal(attempts, 1);
  assert.ok(messages.some(message => message.includes("/admin/status")));
  assert.ok(messages.length > 0);
  for (const secret of ["private-query", "private-token", "private-header", "secret=", "admin_token="]) assert.ok(messages.every(message => !message.includes(secret)));
});

test("admin redirects are private and bypass shared caches", async t => {
  quiet(t);
  t.mock.method(globalThis, "fetch", async () => new Response(null, { status: 307, headers: { Location: "/admin/status" } }));
  const response = await proxyToRailway(new NextRequest("https://site.test/api/admin", { headers: { "X-Admin-Secret": "admin-test" } }), "", ["admin"]);
  assert.equal(response.status, 307);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
});

test("caller cancellation reaches the upstream and prevents further attempts", async t => {
  quiet(t);
  const controller = new AbortController();
  let attempts = 0;
  t.mock.method(globalThis, "fetch", async (_url, { signal }) => {
    attempts++;
    controller.abort();
    assert.equal(signal.aborted, true);
    throw signal.reason;
  });
  await proxyToRailway(new NextRequest("https://site.test/api/benchmark", { signal: controller.signal }), "", ["benchmark"]);
  assert.equal(attempts, 1);
});
