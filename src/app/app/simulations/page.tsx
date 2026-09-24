"use client";

import { useState, useEffect, useCallback } from "react";
import { FlaskConical, Cpu, CheckCircle2, XCircle, Clock, Loader2, Download, Play, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

const API = process.env.NEXT_PUBLIC_API_BASE ?? "";

const TOOLS = [
  { id: "rdkit_energy_minimize",  label: "RDKit Energy Minimize",  desc: "MMFF94 force field minimization",  example: { smiles: "CCO" } },
  { id: "rdkit_smiles_validate",  label: "RDKit SMILES Validate",  desc: "Validate & canonicalize SMILES",    example: { smiles: "c1ccccc1" } },
  { id: "rdkit_fingerprint",      label: "RDKit Fingerprint",      desc: "Morgan fingerprint (radius=2)",     example: { smiles: "CC(=O)Oc1ccccc1C(=O)O", radius: 2 } },
  { id: "lean4_verify",           label: "Lean 4 Verify",          desc: "Formal proof verification",         example: { proof: "#check Nat.add_comm" } },
  { id: "generic_python",         label: "Generic Python",         desc: "Sandboxed Python snippet",          example: { code: "import math\nprint(math.pi)" } },
];

type JobStatus = "pending" | "claimed" | "completed" | "verified";

interface SimJob {
  id: string;
  tool: string;
  params: Record<string, unknown>;
  status: JobStatus;
  requester: string;
  timestamp: number;
  verified: boolean;
  results: { workerId: string; hash: string; ts: number }[];
  verified_result?: unknown;
}

interface SimStats {
  total: number; pending: number; claimed: number; completed: number; verified: number; workers: number;
}

const STATUS_COLORS: Record<JobStatus, string> = {
  pending:   "text-amber-500 bg-amber-500/10 border-amber-500/30",
  claimed:   "text-blue-500 bg-blue-500/10 border-blue-500/30",
  completed: "text-muted-foreground bg-muted border-border",
  verified:  "text-green-500 bg-green-500/10 border-green-500/30",
};

export default function SimulationsPage() {
  const [jobs, setJobs]         = useState<SimJob[]>([]);
  const [stats, setStats]       = useState<SimStats | null>(null);
  const [loading, setLoading]   = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedTool, setSelectedTool] = useState(TOOLS[0].id);
  const [paramsText, setParamsText] = useState(JSON.stringify(TOOLS[0].example, null, 2));
  const [submitResult, setSubmitResult] = useState<string | null>(null);
  const [submitOk, setSubmitOk] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [jobsRes, statsRes] = await Promise.all([
        fetch(`${API}/api/simulation/jobs?limit=30`),
        fetch(`${API}/api/simulation/stats`),
      ]);
      if (jobsRes.ok)   setJobs((await jobsRes.json()).jobs ?? []);
      if (statsRes.ok)  setStats(await statsRes.json());
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchData();
    const t = setInterval(fetchData, 10_000);
    return () => clearInterval(t);
  }, [fetchData]);

  function onToolChange(id: string) {
    setSelectedTool(id);
    const tool = TOOLS.find(t => t.id === id);
    if (tool) setParamsText(JSON.stringify(tool.example, null, 2));
  }

  async function submitJob() {
    setSubmitting(true);
    setSubmitResult(null);
    try {
      let params: Record<string, unknown> = {};
      try { params = JSON.parse(paramsText); } catch { throw new Error("Invalid JSON params"); }
      const res = await fetch(`${API}/api/simulation/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tool: selectedTool, params, agentName: "Browser Agent" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? res.statusText);
      setSubmitOk(true);
      setSubmitResult(`Job submitted: ${data.jobId}`);
      fetchData();
    } catch (e) {
      setSubmitOk(false);
      setSubmitResult(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="p-4 md:p-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground flex items-center gap-2">
            <FlaskConical className="w-5 h-5 text-primary" />
            Open-Tool Multiverse
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Distributed P2P computation — workers run simulations locally on their own machines
          </p>
        </div>
        <button onClick={fetchData} className="p-2 text-muted-foreground hover:text-foreground transition-colors">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mb-6">
          {[
            { label: "Total",     value: stats.total,     color: "text-foreground" },
            { label: "Pending",   value: stats.pending,   color: "text-amber-500" },
            { label: "Running",   value: stats.claimed,   color: "text-blue-500" },
            { label: "Done",      value: stats.completed, color: "text-muted-foreground" },
            { label: "Verified",  value: stats.verified,  color: "text-green-500" },
            { label: "Workers",   value: stats.workers,   color: "text-primary" },
          ].map(s => (
            <div key={s.label} className="border border-border rounded-2xl bg-popover px-3 py-2 text-center">
              <div className={cn("font-mono text-lg font-bold", s.color)}>{s.value}</div>
              <div className="text-xs font-medium text-muted-foreground">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Submit job */}
        <div className="border border-border rounded-2xl bg-popover p-4">
          <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <Play className="w-4 h-4 text-primary" /> Submit Simulation
          </h2>

          <div className="space-y-3">
            {/* Tool selector */}
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Tool</label>
              <select
                value={selectedTool}
                onChange={e => onToolChange(e.target.value)}
                className="w-full bg-background border border-border rounded px-3 py-2 text-sm text-foreground focus:border-primary outline-none"
              >
                {TOOLS.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
              <p className="text-xs text-muted-foreground mt-1">
                {TOOLS.find(t => t.id === selectedTool)?.desc}
              </p>
            </div>

            {/* Params */}
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Parameters (JSON)</label>
              <textarea
                value={paramsText}
                onChange={e => setParamsText(e.target.value)}
                rows={5}
                className="w-full bg-background border border-border rounded px-3 py-2 font-mono text-xs text-foreground focus:border-primary outline-none resize-none"
              />
            </div>

            <button
              onClick={submitJob}
              disabled={submitting}
              className="w-full bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground text-sm py-2 rounded flex items-center justify-center gap-2 transition-colors"
            >
              {submitting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
              {submitting ? "Submitting..." : "Submit to P2P Network"}
            </button>

            {submitResult && (
              <p className={cn("font-mono text-xs flex items-center gap-1.5", submitOk ? "text-green-500" : "text-destructive")}>
                {submitOk ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                {submitResult}
              </p>
            )}
          </div>

          {/* Worker download */}
          <div className="mt-6 pt-4 border-t border-border">
            <h3 className="text-xs font-semibold text-foreground mb-2 flex items-center gap-2">
              <Cpu className="w-3 h-3 text-primary" /> Become a Worker Node
            </h3>
            <p className="text-xs text-muted-foreground mb-3">
              Run simulations locally on your machine. Your CPU/GPU contributes to the network.
              Install: <code className="font-mono text-primary">pip install httpx cryptography rdkit-pypi</code>
            </p>
            <a
              href="/api/simulation/worker/download"
              className="w-full border border-border hover:border-primary text-muted-foreground hover:text-foreground text-xs py-2 rounded flex items-center justify-center gap-2 transition-colors"
            >
              <Download className="w-3 h-3" /> Download p2p-worker-node.py
            </a>
          </div>
        </div>

        {/* Job queue */}
        <div className="xl:col-span-2 border border-border rounded-2xl bg-popover overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-background">
            <Clock className="w-3 h-3 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">Simulation Queue</span>
            <span className="ml-auto text-xs text-muted-foreground">{jobs.length} jobs</span>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : jobs.length === 0 ? (
            <div className="py-12 text-center">
              <FlaskConical className="w-8 h-8 text-border mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No simulation jobs yet</p>
              <p className="text-xs text-muted-foreground mt-1">Submit a job or start a worker node</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {jobs.map(job => (
                <div key={job.id} className="px-4 py-3 hover:bg-background transition-colors">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs text-foreground truncate">
                          {TOOLS.find(t => t.id === job.tool)?.label ?? job.tool}
                        </span>
                        <span className={cn(
                          "font-mono text-[9px] px-1.5 py-0.5 rounded border uppercase",
                          STATUS_COLORS[job.status] ?? STATUS_COLORS.pending
                        )}>
                          {job.status}
                        </span>
                        {job.verified && <CheckCircle2 className="w-3 h-3 text-green-500" />}
                      </div>
                      <div className="flex items-center gap-3 text-muted-foreground">
                        <span className="font-mono text-[10px]">{job.id.slice(0, 20)}…</span>
                        <span className="font-mono text-[10px]">{job.results.length} result{job.results.length !== 1 ? "s" : ""}</span>
                        <span className="font-mono text-[10px]">
                          {new Date(job.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      {!!job.verified_result && (
                        <pre className="mt-1.5 text-[10px] font-mono text-green-500 bg-background rounded px-2 py-1 truncate">
                          {JSON.stringify(job.verified_result).slice(0, 120)}
                        </pre>
                      )}
                    </div>
                    <div className="font-mono text-[10px] text-muted-foreground shrink-0">
                      {job.requester}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Architecture explainer */}
      <div className="mt-6 border border-border rounded-2xl bg-background p-4">
        <h3 className="text-xs font-semibold text-foreground mb-2">How Open-Tool Multiverse works</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs text-muted-foreground">
          <div className="border border-border rounded p-2">
            <div className="text-primary font-medium mb-1">1. Submit</div>
            Agent or browser submits a simulation job (RDKit, Lean4, Python) to the P2P queue
          </div>
          <div className="border border-border rounded p-2">
            <div className="text-amber-500 font-medium mb-1">2. Distribute</div>
            Worker nodes polling the queue pick up the job and execute it locally on their own CPU/GPU
          </div>
          <div className="border border-border rounded p-2">
            <div className="text-blue-500 font-medium mb-1">3. Sign &amp; Return</div>
            Worker signs the result with Ed25519 and submits it back — proving which machine computed it
          </div>
          <div className="border border-border rounded p-2">
            <div className="text-green-500 font-medium mb-1">4. Verify</div>
            2+ workers return matching hashes → Consensus reached → result marked VERIFIED
          </div>
        </div>
      </div>
    </div>
  );
}
