import test from "node:test";
import assert from "node:assert/strict";
import {
  parseBenchmark, benchmarkStatus, BENCHMARK_FRESHNESS_MS,
  datasetPageUrl, parseDatasetPage, filterDatasetPage, datasetJsonl, fetchPublicJson,
} from "../src/lib/live-data.ts";
import { proxyEndpoints, proxyLogUrl, proxyRequestHeaders } from "../src/lib/proxy-policy.ts";

const timestamp = "2026-09-13T20:00:00.000Z";
const now = Date.parse(timestamp);
const benchmark = () => ({
  updated_at: timestamp,
  summary: { total_agents: 348, scored_papers: 887, avg_score: 5.8 },
  agent_leaderboard: Array.from({ length: 50 }, (_, i) => ({ name: `Researcher ${i}`, papers: 2, best_score: 8, avg_score: 6 })),
  podium: [{ author: "Researcher 0", title: "Test result", overall: 0 }],
});
const records = [
  { id: "paper-1", title: "Network science", author: "Ada", status: "VERIFIED", content: "## Methods\nA reproducible result.", license: "CC-BY-4.0", version: 3 },
  { id: "paper-2", title: "Algebra", author: "Emmy", status: "PENDING", content: "Text with \"quotes\" and\nnewlines." },
];

test("benchmark preserves global aggregates when only 50 of 348 agents are returned", () => {
  const data = parseBenchmark(benchmark());
  assert.equal(data.agent_leaderboard.length, 50);
  assert.deepEqual(data.summary, { total_agents: 348, scored_papers: 887, avg_score: 5.8 });
  assert.equal(data.podium[0].score, 0);
});

test("empty benchmark is an actual empty response, with no fabricated ranks", () => {
  const data = parseBenchmark({ updated_at: timestamp, summary: { total_agents: 0, scored_papers: 0, avg_score: 0 }, agent_leaderboard: [], podium: [] });
  assert.equal(data.agent_leaderboard.length, 0);
  assert.equal(benchmarkStatus(data, false, now).state, "empty");
});

test("invalid benchmark values surface an error rather than becoming zeroes", () => {
  assert.throws(() => parseBenchmark({ error: "unavailable" }));
  for (const invalid of [null, "", "not-a-number", -1, Infinity]) {
    const value = benchmark();
    value.summary.scored_papers = invalid;
    assert.throws(() => parseBenchmark(value));
  }
});

test("unknown dates never acquire the time of the fetch", () => {
  const value = benchmark();
  delete value.updated_at;
  const data = parseBenchmark(value);
  assert.equal(data.updated_at, undefined);
  assert.equal(benchmarkStatus(data, false, now).state, "unknown");
  value.updated_at = "invalid";
  assert.equal(parseBenchmark(value).updated_at, undefined);
});

test("loading, error, recent, stale and failed refresh remain distinct", () => {
  const data = parseBenchmark(benchmark());
  assert.equal(benchmarkStatus(undefined, false, now).state, "loading");
  assert.equal(benchmarkStatus(undefined, true, now).state, "error");
  assert.equal(benchmarkStatus(data, false, now).state, "fresh");
  assert.equal(benchmarkStatus(data, false, now + BENCHMARK_FRESHNESS_MS + 1).state, "stale");
  assert.equal(benchmarkStatus(data, true, now).state, "stale");
  assert.equal(benchmarkStatus(data, false, now - 120_000).state, "unknown");
  assert.equal(data.updated_at, timestamp);
});

test("dataset uses supported pagination and verification filters, with no fake global query", () => {
  const url = new URL(datasetPageUrl({ minScore: 7, verifiedOnly: true }, 100), "https://example.test");
  assert.equal(url.pathname, "/api/dataset/papers");
  assert.deepEqual(Object.fromEntries(url.searchParams), { min_score: "7", verified_only: "true", offset: "100", limit: "50" });
});

test("a dataset page retains the corpus total and original export fields", () => {
  const page = parseDatasetPage({ papers: records, total: 266, offset: 100, limit: 50, count: 2 });
  assert.equal(page.total, 266);
  assert.equal(page.offset, 100);
  assert.deepEqual(page.papers, records);
  assert.throws(() => parseDatasetPage({ papers: records, total: 266, offset: 0, limit: 50, count: 50 }));
});

test("search covers title and author on the received page, and export matches exactly", () => {
  const shown = filterDatasetPage(records, " ada ");
  assert.deepEqual(shown.map(p => p.id), ["paper-1"]);
  assert.deepEqual(datasetJsonl(shown).trim().split("\n").map(JSON.parse), [records[0]]);
  assert.deepEqual(filterDatasetPage(records, "ALGEBRA"), [records[1]]);
  assert.deepEqual(filterDatasetPage(records, "paper not in this page"), []);
  assert.equal(datasetJsonl([]), "");
  assert.deepEqual(datasetJsonl(records).trim().split("\n").map(JSON.parse), records);
});

test("HTTP errors reject the query instead of returning an empty dataset", async t => {
  t.mock.method(globalThis, "fetch", async () => new Response("unavailable", { status: 503 }));
  await assert.rejects(fetchPublicJson("/api/dataset/papers", parseDatasetPage), /HTTP 503/);
});

test("requests use no-store and a cancellable deadline", async t => {
  let request;
  t.mock.method(globalThis, "fetch", async (url, options) => { request = { url, options }; return Response.json(benchmark()); });
  const controller = new AbortController();
  await fetchPublicJson("/api/benchmark", parseBenchmark, controller.signal);
  assert.equal(request.options.cache, "no-store");
  assert.equal(request.options.headers.Accept, "application/json");
  controller.abort();
  assert.equal(request.options.signal.aborted, true);
});

test("an expired request rejects instead of waiting indefinitely", async t => {
  t.mock.method(globalThis, "fetch", (_url, { signal }) => new Promise((resolve, reject) => {
    signal.addEventListener("abort", () => reject(signal.reason), { once: true });
  }));
  const keepAlive = setTimeout(() => {}, 100);
  try { await assert.rejects(fetchPublicJson("/api/benchmark", parseBenchmark, undefined, 5), { name: "TimeoutError" }); }
  finally { clearTimeout(keepAlive); }
});

test("proxy credentials and idempotency metadata are allowlisted, not cookies or forwarding headers", () => {
  const output = proxyRequestHeaders(new Headers({ Authorization: "Bearer test-value", "X-Admin-Secret": "admin-test", "Idempotency-Key": "request-1", "X-Request-ID": "trace-1", Cookie: "private=1", Host: "other.test", "X-Forwarded-For": "spoofed", "X-Admin-Key": "not-approved" }));
  assert.equal(output.get("authorization"), "Bearer test-value");
  assert.equal(output.get("idempotency-key"), "request-1");
  assert.equal(output.get("x-request-id"), "trace-1");
  assert.equal(output.get("x-admin-secret"), "admin-test");
  for (const header of ["cookie", "host", "x-forwarded-for", "x-admin-key"]) assert.equal(output.has(header), false);
});

test("only anonymous reads fail over; writes and credentials stay at the primary", () => {
  const hosts = ["https://primary.test", "https://legacy.test"];
  assert.deepEqual(proxyEndpoints("GET", new Headers(), hosts), hosts);
  assert.deepEqual(proxyEndpoints("GET", new Headers({ Authorization: "Bearer test" }), hosts), hosts.slice(0, 1));
  assert.deepEqual(proxyEndpoints("GET", new Headers({ "X-Admin-Secret": "admin-test" }), hosts), hosts.slice(0, 1));
  assert.deepEqual(proxyEndpoints("HEAD", new Headers({ "X-Admin-Secret": "admin-test" }), hosts), hosts.slice(0, 1));
  for (const method of ["POST", "PUT", "DELETE", "PATCH"]) {
    assert.deepEqual(proxyEndpoints(method, new Headers({ "Idempotency-Key": "request-1" }), hosts), hosts.slice(0, 1));
  }
});

test("proxy log URLs omit query strings, fragments and userinfo", () => {
  assert.equal(proxyLogUrl("https://user:pass@primary.test/admin?secret=private&admin_token=private#token"), "https://primary.test/admin");
  assert.equal(proxyLogUrl("malformed?secret=private"), "[invalid upstream URL]");
});
