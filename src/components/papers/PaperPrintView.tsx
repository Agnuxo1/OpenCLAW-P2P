"use client";

/**
 * PaperPrintView — A print-ready, PDF-exportable rendition of a paper.
 *
 * Shows the paper on an A4-sized page with the PaperClaw orange accent,
 * crab-claw watermark, metric infographics (judge panel + score bars),
 * print/share actions, and @media print rules so the browser "Save as PDF"
 * flow produces a clean document for arXiv / Zenodo / ResearchGate / Academia.
 *
 * Inspired by google-research/papervizagent (structured paper visual
 * summaries) and the "utility-bill" visual style the user requested.
 */

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { renderMarkdown } from "@/lib/markdown";
import type { Paper } from "@/types/api";
import {
  Printer, X, Share2, Twitter, Facebook, Linkedin,
  MessageCircle, Send, Copy, Check, FileDown, Award,
} from "lucide-react";

// ── Score bundle fetched from the public dataset endpoint ───────────────
type JudgeScore = {
  judge: string;
  scores: Record<string, number>;
};
type GranularScores = {
  overall?: number;
  novelty?: number;
  reproducibility?: number;
  citation_quality?: number;
  sections?: Record<string, number>;
  judges?: string[];
  judge_count?: number;
  judge_details?: JudgeScore[];
  consensus?: Record<string, number>;
  overall_consensus?: number;
  calibration?: { field?: string; field_confidence?: number };
  live_verification?: {
    citations?: { total?: number; verified?: number; verification_rate?: number };
    novelty?: { max_similarity?: number };
    code_execution?: { total?: number; passed?: number; failed?: number };
    lean4?: { blocks_found?: number; verified?: number };
  };
};

const ACCENT = "#ff4e1a";
const ACCENT_LIGHT = "#ff7020";
const INK = "#1a1a1c";
const SUB = "#52504e";
const PAPER_BG = "#fffaf5"; // warm off-white for the page

// ── Utility: fetch full scored record from dataset ──────────────────────
async function fetchScored(id: string): Promise<GranularScores | null> {
  try {
    const r = await fetch(
      `https://www.p2pclaw.com/api/dataset/papers?limit=500&min_score=0`,
      { cache: "no-store" },
    );
    if (!r.ok) return null;
    const j = await r.json();
    const list: unknown[] = j?.papers || j?.data || [];
    const match = list.find((p) => {
      const rec = p as Record<string, unknown>;
      return rec.id === id || rec.paperId === id;
    }) as Record<string, unknown> | undefined;
    return (match?.granular_scores as GranularScores | undefined) ?? null;
  } catch {
    return null;
  }
}

// ── Medal (from score) ──────────────────────────────────────────────────
function medalOf(score: number | undefined): { label: string; color: string } {
  if (score == null) return { label: "UNSCORED", color: SUB };
  if (score >= 8.5) return { label: "GOLD", color: "#ffcb47" };
  if (score >= 7.5) return { label: "SILVER", color: "#c0c0c0" };
  if (score >= 6.5) return { label: "BRONZE", color: "#cd7f32" };
  if (score >= 5.0) return { label: "PASS", color: "#4caf50" };
  return { label: "DRAFT", color: SUB };
}

// ── Score bar ───────────────────────────────────────────────────────────
function ScoreBar({ label, value, max = 10 }: { label: string; value: number; max?: number }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="flex items-center gap-2 text-[11px]">
      <span className="w-28 shrink-0 font-mono" style={{ color: SUB }}>{label}</span>
      <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "#f1e7dc" }}>
        <div className="h-full" style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${ACCENT}, ${ACCENT_LIGHT})` }} />
      </div>
      <span className="w-10 text-right font-mono font-bold tabular-nums" style={{ color: INK }}>
        {value.toFixed(1)}
      </span>
    </div>
  );
}

// ── Share helpers ───────────────────────────────────────────────────────
function shareUrls(paper: Paper, currentUrl: string) {
  const u = encodeURIComponent(currentUrl);
  const t = encodeURIComponent(paper.title);
  const text = encodeURIComponent(`${paper.title} — published on P2PCLAW`);
  return {
    twitter:  `https://twitter.com/intent/tweet?url=${u}&text=${text}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${u}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${u}`,
    reddit:   `https://www.reddit.com/submit?url=${u}&title=${t}`,
    // Moltbook is Francisco Angulo's social graph; share intent mirrors Mastodon.
    moltbook: `https://moltbook.com/share?url=${u}&title=${t}`,
    mastodon: `https://mastodon.social/share?text=${text}%20${u}`,
  };
}

// ── Main component ──────────────────────────────────────────────────────
export function PaperPrintView({
  paper,
  html,
  onClose,
}: {
  paper: Paper;
  html: string | null;
  onClose: () => void;
}) {
  const [scored, setScored] = useState<GranularScores | null>(null);
  const [copied, setCopied] = useState(false);
  const [mounted, setMounted] = useState(false);

  const pageUrl = typeof window !== "undefined" ? window.location.href : "";
  const share = useMemo(() => shareUrls(paper, pageUrl), [paper, pageUrl]);

  // Portal mount flag (avoid SSR mismatch)
  useEffect(() => {
    setMounted(true);
  }, []);

  // While the print-view is open, lock the underlying app's scroll so the
  // overlay behaves like a full-screen modal on screen, and — more
  // importantly — disable the app's fixed layout during print by tagging
  // <html>. That lets the print CSS target `html.paperclaw-printing *` and
  // safely hide everything except the portal.
  useEffect(() => {
    const htmlEl = document.documentElement;
    const prevOverflow = document.body.style.overflow;
    htmlEl.classList.add("paperclaw-printing");
    document.body.style.overflow = "hidden";
    return () => {
      htmlEl.classList.remove("paperclaw-printing");
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  useEffect(() => {
    let live = true;
    fetchScored(paper.id).then((s) => { if (live) setScored(s); });
    return () => { live = false; };
  }, [paper.id]);

  const overall = scored?.overall;
  const medal = medalOf(overall);

  const sections = scored?.sections ?? {};
  const sectionBars = [
    ["abstract",     sections.abstract     ?? 0],
    ["introduction", sections.introduction ?? 0],
    ["methodology",  sections.methodology  ?? 0],
    ["results",      sections.results      ?? 0],
    ["discussion",   sections.discussion   ?? 0],
    ["conclusion",   sections.conclusion   ?? 0],
    ["references",   sections.references   ?? 0],
  ] as const;

  const livever = scored?.live_verification;
  const citationsVerified = `${livever?.citations?.verified ?? 0}/${livever?.citations?.total ?? 0}`;
  const codeExec = `${livever?.code_execution?.passed ?? 0}/${livever?.code_execution?.total ?? 0}`;
  const leanVer = `${livever?.lean4?.verified ?? 0}/${livever?.lean4?.blocks_found ?? 0}`;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(pageUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* noop */ }
  }

  // SSR guard — portal only after client mount
  if (!mounted || typeof document === "undefined") return null;

  const printView = (
    <div className="paperclaw-print-root fixed inset-0 z-[9999] overflow-auto" style={{ background: "#f1ece7" }}>
      {/* Print-only CSS: page size, hide chrome, serif body, force colors, paginate */}
      <style jsx global>{`
        @page { size: A4; margin: 14mm 12mm 18mm 12mm; }
        @media print {
          html, body {
            background: #fff !important;
            margin: 0 !important;
            padding: 0 !important;
            height: auto !important;
            min-height: 0 !important;
            max-height: none !important;
            overflow: visible !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }
          /* Force every element to keep its backgrounds + colors when printing */
          *, *::before, *::after {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }
          /* ══ PRINT ISOLATION ═══════════════════════════════════════════
           * The component is portaled directly into <body>, so at body
           * level we simply hide every sibling that is NOT the print root.
           * This makes the browser paginate ONLY the paper content instead
           * of screenshotting the app chrome + clipping to one viewport. */
          body > *:not(.paperclaw-print-root) { display: none !important; }
          .no-print { display: none !important; }
          /* The portal container itself flows as normal block content
           * so it expands to its full natural height and paginates. */
          .paperclaw-print-root {
            position: static !important;
            inset: auto !important;
            top: auto !important;
            left: auto !important;
            right: auto !important;
            bottom: auto !important;
            z-index: auto !important;
            overflow: visible !important;
            height: auto !important;
            min-height: 0 !important;
            max-height: none !important;
            width: 100% !important;
            background: #fff !important;
          }
          /* The A4 page itself flows as normal content so pagination works */
          .paperclaw-page {
            box-shadow: none !important;
            margin: 0 auto !important;
            width: 100% !important;
            max-width: 100% !important;
            min-height: 0 !important;
            max-height: none !important;
            padding: 0 !important;
            overflow: visible !important;
            background: ${PAPER_BG} !important;
          }
          /* Keep structural blocks from splitting awkwardly across pages */
          .paperclaw-body h2,
          .paperclaw-body h3 {
            page-break-after: avoid;
            break-after: avoid-page;
          }
          .paperclaw-body pre,
          .paperclaw-body table,
          .paperclaw-body blockquote,
          .paperclaw-body figure,
          .paperclaw-body img {
            page-break-inside: avoid;
            break-inside: avoid;
          }
          img { max-width: 100% !important; height: auto !important; }
          a { color: ${ACCENT_LIGHT} !important; text-decoration: none !important; }
        }
        .paperclaw-page {
          font-family: "Source Serif 4", "Source Serif Pro", Georgia, "Times New Roman", serif;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
          color-adjust: exact;
        }
        .paperclaw-page h1, .paperclaw-page h2, .paperclaw-page h3 {
          font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
        }
        .paperclaw-body h2 {
          color: ${ACCENT};
          border-bottom: 2px solid ${ACCENT}33;
          padding-bottom: 4px;
          margin-top: 18px;
          font-size: 15px;
          font-weight: 700;
          letter-spacing: 0.02em;
        }
        .paperclaw-body h3 { color: ${INK}; font-size: 13px; margin-top: 12px; }
        .paperclaw-body p  { color: ${INK}; font-size: 11.5px; line-height: 1.55; margin: 8px 0; text-align: justify; hyphens: auto; }
        .paperclaw-body code { background: #f7efe7; color: ${ACCENT}; padding: 1px 4px; border-radius: 3px; font-size: 10.5px; }
        .paperclaw-body pre { background: #fdfaf6; border: 1px solid #e8dcce; border-left: 3px solid ${ACCENT}; padding: 10px; overflow-x: auto; font-size: 10px; line-height: 1.4; }
        .paperclaw-body pre code { background: transparent; color: ${INK}; padding: 0; }
        .paperclaw-body table { width: 100%; border-collapse: collapse; font-size: 10.5px; margin: 10px 0; }
        .paperclaw-body th { background: ${ACCENT}12; color: ${INK}; text-align: left; padding: 6px 8px; border-bottom: 1.5px solid ${ACCENT}55; }
        .paperclaw-body td { padding: 5px 8px; border-bottom: 1px solid #ebe2d6; color: ${INK}; }
        .paperclaw-body a  { color: ${ACCENT_LIGHT}; text-decoration: none; border-bottom: 1px dotted ${ACCENT_LIGHT}; }
        .paperclaw-body blockquote { border-left: 3px solid ${ACCENT}; padding-left: 10px; color: ${SUB}; font-style: italic; }
      `}</style>

      {/* ── Action bar (screen only) ───────────────────────────────── */}
      <div className="no-print sticky top-0 z-10 backdrop-blur-sm" style={{ background: "#1a1a1cdd", borderBottom: `1px solid ${ACCENT}33` }}>
        <div className="max-w-[220mm] mx-auto flex items-center justify-between gap-2 px-4 py-2">
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="flex items-center gap-1.5 font-mono text-xs px-2 py-1 rounded hover:bg-white/5"
              style={{ color: "#f5f0eb" }}
            >
              <X className="w-3.5 h-3.5" />
              Close
            </button>
            <span className="font-mono text-[10px]" style={{ color: SUB }}>
              PaperClaw PDF · {paper.id}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 font-mono text-xs px-3 py-1.5 rounded font-bold"
              style={{ background: ACCENT, color: "#fff" }}
              title="Open browser print dialog; choose 'Save as PDF' to download"
            >
              <FileDown className="w-3.5 h-3.5" />
              Save as PDF
            </button>
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 font-mono text-xs px-3 py-1.5 rounded border"
              style={{ borderColor: `${ACCENT}55`, color: "#f5f0eb" }}
            >
              <Printer className="w-3.5 h-3.5" />
              Print
            </button>
          </div>
        </div>
      </div>

      {/* ── The page itself ────────────────────────────────────────── */}
      <div
        className="paperclaw-page relative mx-auto my-6"
        style={{
          width: "210mm",
          minHeight: "297mm",
          background: PAPER_BG,
          color: INK,
          padding: "14mm 16mm 20mm 16mm",
          boxShadow: "0 6px 28px rgba(0,0,0,0.45)",
        }}
      >
        {/* Watermark */}
        <img
          src="/claw-watermark.svg"
          alt=""
          aria-hidden
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%,-50%) rotate(-12deg)",
            width: "420px",
            height: "420px",
            opacity: 0.10,
            pointerEvents: "none",
            userSelect: "none",
          }}
        />

        {/* ── Bill-style header banner ───────────────────────────── */}
        <div
          className="relative flex items-start justify-between gap-4 mb-4"
          style={{
            padding: "12px 14px",
            background: `linear-gradient(90deg, ${ACCENT}, ${ACCENT_LIGHT})`,
            color: "#fff",
            borderRadius: "6px",
          }}
        >
          <div>
            <div className="font-mono text-[10px] tracking-[0.2em] opacity-80">P2PCLAW · SCIENTIFIC RECORD</div>
            <div className="font-mono text-lg font-extrabold leading-tight">PaperClaw PDF</div>
            <div className="font-mono text-[10px] opacity-80 mt-0.5">www.p2pclaw.com · decentralized peer review</div>
          </div>
          <div className="text-right">
            <div className="font-mono text-[10px] tracking-widest opacity-80">RECORD ID</div>
            <div className="font-mono text-sm font-bold">{paper.id}</div>
            <div
              className="inline-block mt-1 px-2 py-0.5 rounded font-mono text-[10px] font-bold"
              style={{ background: "#ffffff22", color: "#fff", border: "1px solid #ffffff44" }}
            >
              <Award className="inline w-3 h-3 mr-1" />
              {medal.label}
              {overall != null && <> · {overall.toFixed(1)}/10</>}
            </div>
          </div>
        </div>

        {/* ── Title + author block ───────────────────────────────── */}
        <div className="relative mb-4">
          <h1 className="text-[22px] font-bold leading-tight" style={{ color: INK, fontFamily: '"Source Serif 4", Georgia, serif' }}>
            {paper.title}
          </h1>
          <div className="mt-2 font-mono text-[11px]" style={{ color: SUB }}>
            <span style={{ color: INK, fontWeight: 600 }}>{paper.author}</span>
            {paper.timestamp ? <> · {new Date(paper.timestamp).toLocaleDateString()}</> : null}
            {paper.tier ? <> · tier <span style={{ color: ACCENT }}>{paper.tier}</span></> : null}
            {paper.wordCount ? <> · {paper.wordCount.toLocaleString()} words</> : null}
            {paper.ipfsCid ? <> · IPFS <span className="underline">{paper.ipfsCid.slice(0, 10)}…</span></> : null}
          </div>
          {paper.tags.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1 font-mono text-[9px]">
              {paper.tags.map((t) => (
                <span key={t} style={{ color: ACCENT, border: `1px solid ${ACCENT}55`, borderRadius: 3, padding: "1px 5px" }}>
                  #{t}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* ── Scorecard infographic (utility-bill style) ─────────── */}
        <div
          className="relative grid gap-2 mb-5"
          style={{ gridTemplateColumns: "1.3fr 1fr", background: "#fff", border: `1px solid ${ACCENT}33`, borderRadius: 6, padding: 12 }}
        >
          {/* LEFT: section bars */}
          <div>
            <div className="font-mono text-[10px] tracking-widest mb-2" style={{ color: ACCENT }}>
              GRANULAR SCORES · /10
            </div>
            <div className="space-y-1.5">
              {sectionBars.map(([k, v]) => (
                <ScoreBar key={k} label={k} value={Number(v)} />
              ))}
              <div className="h-px my-1.5" style={{ background: `${ACCENT}22` }} />
              <ScoreBar label="novelty"          value={Number(scored?.novelty          ?? 0)} />
              <ScoreBar label="reproducibility"  value={Number(scored?.reproducibility  ?? 0)} />
              <ScoreBar label="citation_quality" value={Number(scored?.citation_quality ?? 0)} />
              <div className="h-px my-1.5" style={{ background: `${ACCENT}22` }} />
              <ScoreBar label="overall"          value={Number(overall                  ?? 0)} />
            </div>
          </div>

          {/* RIGHT: verification facts (utility-bill boxes) */}
          <div className="grid grid-cols-2 gap-2 content-start">
            <MetricBox label="Judges"        value={String(scored?.judge_count ?? "—")} sub="LLM reviewers" />
            <MetricBox label="Consensus"     value={scored?.overall_consensus != null ? `${Math.round(scored.overall_consensus * 100)}%` : "—"} sub="inter-rater" />
            <MetricBox label="Citations"     value={citationsVerified} sub="verified" />
            <MetricBox label="Code exec"     value={codeExec}          sub="passed" />
            <MetricBox label="Lean 4"        value={leanVer}           sub="verified" />
            <MetricBox label="Field"         value={(scored?.calibration?.field ?? "—").toString()} sub="calibrated" />
          </div>
        </div>

        {/* ── Abstract box ───────────────────────────────────────── */}
        {paper.abstract && (
          <div
            className="relative mb-5"
            style={{ borderLeft: `3px solid ${ACCENT}`, background: "#fff", padding: "10px 12px", borderRadius: 4 }}
          >
            <div className="font-mono text-[10px] tracking-widest mb-1" style={{ color: ACCENT }}>ABSTRACT</div>
            <p className="text-[11.5px] leading-relaxed" style={{ color: INK, textAlign: "justify", fontFamily: '"Source Serif 4", Georgia, serif' }}>
              {paper.abstract}
            </p>
          </div>
        )}

        {/* ── Rendered body ──────────────────────────────────────── */}
        <div
          className="paperclaw-body relative"
          dangerouslySetInnerHTML={{ __html: html ?? "<p style='color:#999'>Loading paper…</p>" }}
        />

        {/* ── Judges table ───────────────────────────────────────── */}
        {scored?.judge_details && scored.judge_details.length > 0 && (
          <div className="relative mt-6">
            <h2 style={{ color: ACCENT, borderBottom: `2px solid ${ACCENT}33`, paddingBottom: 4, fontSize: 13, fontWeight: 700 }}>
              Peer-Review Panel
            </h2>
            <table className="w-full text-[9.5px] font-mono" style={{ borderCollapse: "collapse", marginTop: 6 }}>
              <thead>
                <tr style={{ background: `${ACCENT}12` }}>
                  <th style={{ textAlign: "left", padding: "4px 6px", borderBottom: `1.5px solid ${ACCENT}55` }}>Judge</th>
                  {["abs", "intro", "meth", "res", "disc", "conc", "ref", "nov", "repr", "cit"].map((h) => (
                    <th key={h} style={{ textAlign: "right", padding: "4px 6px", borderBottom: `1.5px solid ${ACCENT}55` }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {scored.judge_details.map((jd) => (
                  <tr key={jd.judge}>
                    <td style={{ padding: "3px 6px", borderBottom: "1px solid #ebe2d6" }}>{jd.judge}</td>
                    {["abstract","introduction","methodology","results","discussion","conclusion","references","novelty","reproducibility","citation_quality"].map((k) => (
                      <td key={k} style={{ padding: "3px 6px", textAlign: "right", borderBottom: "1px solid #ebe2d6", color: INK }}>
                        {jd.scores?.[k] != null ? Number(jd.scores[k]).toFixed(0) : "—"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Footer strip ───────────────────────────────────────── */}
        <div
          className="relative mt-6 pt-3 flex items-center justify-between font-mono text-[9px]"
          style={{ borderTop: `1px solid ${ACCENT}33`, color: SUB }}
        >
          <span>
            Generated by <span style={{ color: ACCENT, fontWeight: 700 }}>PaperClaw</span> · Decentralized peer-reviewed science · MIT
          </span>
          <span>
            © {new Date().getFullYear()} P2PCLAW · <a href={pageUrl} style={{ color: ACCENT_LIGHT }}>{pageUrl}</a>
          </span>
        </div>
      </div>

      {/* ── Share bar (screen only) ────────────────────────────────── */}
      <div className="no-print max-w-[220mm] mx-auto px-4 pb-10">
        <div
          className="rounded-lg p-4 grid gap-3"
          style={{ background: "#0c0c0d", border: `1px solid ${ACCENT}33` }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-mono text-xs" style={{ color: "#f5f0eb" }}>
              <Share2 className="w-4 h-4" style={{ color: ACCENT }} />
              Share this PaperClaw PDF
            </div>
            <button
              onClick={copyLink}
              className="flex items-center gap-1 font-mono text-[10px] px-2 py-1 rounded border"
              style={{ borderColor: `${ACCENT}55`, color: copied ? "#4caf50" : "#f5f0eb" }}
            >
              {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              {copied ? "Copied!" : "Copy link"}
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
            <ShareButton href={share.twitter}  label="X.com"     icon={<Twitter className="w-3.5 h-3.5" />} />
            <ShareButton href={share.facebook} label="Facebook"  icon={<Facebook className="w-3.5 h-3.5" />} />
            <ShareButton href={share.linkedin} label="LinkedIn"  icon={<Linkedin className="w-3.5 h-3.5" />} />
            <ShareButton href={share.reddit}   label="Reddit"    icon={<MessageCircle className="w-3.5 h-3.5" />} />
            <ShareButton href={share.mastodon} label="Mastodon"  icon={<Send className="w-3.5 h-3.5" />} />
            <ShareButton href={share.moltbook} label="Moltbook"  icon={<Send className="w-3.5 h-3.5" />} />
            <button
              onClick={() => window.print()}
              className="flex items-center justify-center gap-1.5 font-mono text-xs px-3 py-2 rounded font-bold"
              style={{ background: ACCENT, color: "#fff" }}
            >
              <FileDown className="w-3.5 h-3.5" />
              PDF
            </button>
          </div>
          <div className="font-mono text-[10px] leading-relaxed" style={{ color: SUB }}>
            <span style={{ color: "#f5f0eb" }}>Archive:</span> Once you save the PDF, upload it to
            {" "}<a href="https://arxiv.org/submit" target="_blank" rel="noopener" style={{ color: ACCENT_LIGHT }}>arXiv</a>,
            {" "}<a href="https://zenodo.org/deposit/new" target="_blank" rel="noopener" style={{ color: ACCENT_LIGHT }}>Zenodo</a>,
            {" "}<a href="https://www.researchgate.net/publication/new" target="_blank" rel="noopener" style={{ color: ACCENT_LIGHT }}>ResearchGate</a>, or
            {" "}<a href="https://www.academia.edu/upload" target="_blank" rel="noopener" style={{ color: ACCENT_LIGHT }}>Academia.edu</a>
            {" "}to reach the widest audience.
          </div>
        </div>
      </div>
    </div>
  );

  // Render into <body> so the print-isolation CSS can cleanly hide the rest
  // of the app's DOM (sidebar, top bar, scroll containers) which otherwise
  // wrap this overlay and make the browser print only the first viewport.
  return createPortal(printView, document.body);
}

// ── Small helpers ────────────────────────────────────────────────────────
function MetricBox({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div style={{ background: "#fdfaf6", border: `1px solid ${ACCENT}22`, borderRadius: 4, padding: "6px 8px" }}>
      <div className="font-mono text-[9px] uppercase tracking-widest" style={{ color: SUB }}>{label}</div>
      <div className="font-mono text-[14px] font-extrabold leading-tight" style={{ color: INK }}>{value}</div>
      <div className="font-mono text-[8.5px]" style={{ color: SUB }}>{sub}</div>
    </div>
  );
}

function ShareButton({ href, label, icon }: { href: string; label: string; icon: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center justify-center gap-1.5 font-mono text-xs px-3 py-2 rounded border transition-colors"
      style={{ borderColor: `${ACCENT}55`, color: "#f5f0eb" }}
      onMouseEnter={(e) => (e.currentTarget.style.background = `${ACCENT}22`)}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      {icon}
      {label}
    </a>
  );
}
