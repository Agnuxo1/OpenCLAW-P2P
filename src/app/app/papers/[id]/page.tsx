"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { useQuery } from "@tanstack/react-query";
import { useLatestPapers } from "@/hooks/useLatestPapers";
import { useAgentStore } from "@/store/agentStore";
import { renderMarkdown } from "@/lib/markdown";
import {
  fetchPaperById,
  fetchPaperScience,
  fetchPodiumPaperIds,
  getPaperTierLabel,
} from "@/lib/api-client";
import { PaperPrintView } from "@/components/papers/PaperPrintView";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PaperEvaluation } from "@/components/science/PaperEvaluation";
import { Pill, fmt } from "@/components/science/primitives";
import {
  ArrowLeft, ExternalLink, Calendar, User, Hash,
  Eye, Edit3, CheckCircle, Clock, XCircle, ShieldCheck,
  FileDown, Microscope, Users, BarChart3,
} from "lucide-react";
import type { Paper } from "@/types/api";

// Collaborative editor — client-only, no SSR
const CollaborativeEditor = dynamic(
  () => import("@/components/editor/CollaborativeEditor").then((m) => m.CollaborativeEditor),
  {
    ssr: false,
    loading: () => (
      <div className="h-64 rounded-2xl border border-border bg-card flex items-center justify-center">
        <span className="text-sm text-muted-foreground motion-safe:animate-pulse">Loading editor…</span>
      </div>
    ),
  },
);

// ── Status chip ──────────────────────────────────────────────────────────
const STATUS_MAP: Record<string, { icon: React.ComponentType<{ className?: string }>; label: string; tone: "primary" | "neutral" | "muted" | "destructive" }> = {
  VERIFIED:   { icon: CheckCircle, label: "Verified",   tone: "primary" },
  PROMOTED:   { icon: CheckCircle, label: "Promoted",   tone: "primary" },
  PENDING:    { icon: Clock,       label: "In Mempool", tone: "neutral" },
  UNVERIFIED: { icon: Clock,       label: "Unverified", tone: "muted" },
  REJECTED:   { icon: XCircle,     label: "Rejected",   tone: "destructive" },
  PURGED:     { icon: XCircle,     label: "Purged",     tone: "muted" },
};

function StatusChip({ status }: { status: Paper["status"] }) {
  const s = STATUS_MAP[status] ?? STATUS_MAP.UNVERIFIED;
  const Icon = s.icon;
  return (
    <Pill tone={s.tone}>
      <Icon className="size-3.5" aria-hidden="true" />
      {s.label}
    </Pill>
  );
}

// Token-based styles for rendered Markdown (no typography plugin is installed).
const ARTICLE_CLASSES = [
  "text-[15px] leading-7 text-foreground break-words",
  "[&_h1]:text-3xl [&_h1]:font-semibold [&_h1]:tracking-tight [&_h1]:mt-10 [&_h1]:mb-4",
  "[&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2]:mt-10 [&_h2]:mb-3",
  "[&_h3]:text-xl [&_h3]:font-semibold [&_h3]:mt-8 [&_h3]:mb-2",
  "[&_h4]:text-base [&_h4]:font-semibold [&_h4]:mt-6 [&_h4]:mb-2",
  "[&_p]:my-4 [&_strong]:font-semibold [&_em]:italic",
  "[&_a]:text-primary [&_a]:underline-offset-4 [&_a:hover]:underline",
  "[&_code]:font-mono [&_code]:text-[90%] [&_code]:bg-muted [&_code]:rounded [&_code]:px-1",
  "[&_pre]:my-5 [&_pre]:bg-muted [&_pre]:border [&_pre]:border-border [&_pre]:rounded-xl [&_pre]:p-4 [&_pre]:overflow-x-auto [&_pre_code]:bg-transparent [&_pre_code]:p-0",
  "[&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-4 [&_blockquote]:text-muted-foreground",
  "[&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:my-1",
  "[&_hr]:my-10 [&_hr]:border-border",
  "[&_table]:w-full [&_table]:my-6 [&_table]:text-sm [&_table]:block [&_table]:overflow-x-auto",
  "[&_th]:text-left [&_th]:font-medium [&_th]:border-b [&_th]:border-border [&_th]:py-2 [&_th]:pr-4",
  "[&_td]:border-b [&_td]:border-border [&_td]:py-2 [&_td]:pr-4 [&_img]:rounded-xl",
].join(" ");

type TabKey = "read" | "evaluation" | "collaborate";

// ── Main page ────────────────────────────────────────────────────────────
export default function PaperPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data, isLoading: listLoading } = useLatestPapers();
  const { id: authorId, name: authorName } = useAgentStore();

  const [tab, setTab] = useState<TabKey>("read");
  const [html, setHtml] = useState<string | null>(null);
  const [individualPaper, setIndividualPaper] = useState<Paper | null>(null);
  const [individualLoading, setIndividualLoading] = useState(false);
  const [printMode, setPrintMode] = useState(false);

  // Raw record with granular_scores + v8 fields (the list view strips them).
  const scienceQuery = useQuery({
    queryKey: ["paper-science", id],
    queryFn: () => fetchPaperScience(id),
    enabled: !!id,
    staleTime: 60_000,
    retry: 1,
  });
  const podiumQuery = useQuery({
    queryKey: ["podium-ids"],
    queryFn: () => fetchPodiumPaperIds(),
    staleTime: 60_000,
    retry: 1,
  });

  // Try to find paper in the cached list first
  const listPaper: Paper | undefined = data?.papers.find((p) => p.id === id);
  const paper = listPaper ?? individualPaper ?? undefined;
  const isLoading = listLoading && !paper;

  // If the list loaded but paper not found, fetch individually
  useEffect(() => {
    if (listLoading || listPaper || individualPaper) return;
    setIndividualLoading(true);
    fetchPaperById(id).then((p) => {
      setIndividualPaper(p);
      setIndividualLoading(false);
    });
  }, [id, listLoading, listPaper, individualPaper]);

  useEffect(() => {
    if (!paper?.content) return;
    renderMarkdown(paper.content).then(setHtml);
  }, [paper?.content]);

  // ── Loading state ──────────────────────────────────────────────────────
  if ((isLoading || individualLoading) && !paper) {
    return (
      <div className="px-4 py-10 md:px-8 md:py-14 max-w-4xl mx-auto space-y-4" aria-busy="true" aria-label="Loading paper">
        <Skeleton className="h-10 w-3/4 rounded-xl motion-reduce:animate-none" />
        <Skeleton className="h-4 w-48 motion-reduce:animate-none" />
        <div className="space-y-3 mt-10">
          {Array.from({ length: 12 }).map((_, i) => (
            <Skeleton key={i} className="h-3 w-full motion-reduce:animate-none" />
          ))}
        </div>
      </div>
    );
  }

  // ── Not found ─────────────────────────────────────────────────────────
  if (!paper) {
    return (
      <div className="px-4 py-10 md:px-8 md:py-14 max-w-4xl mx-auto">
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-8 transition-colors rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to papers
        </button>
        <div className="rounded-2xl border border-border bg-card p-12 text-center">
          <Hash className="size-8 text-muted-foreground mx-auto mb-4" aria-hidden="true" />
          <p className="text-lg font-medium text-foreground">Paper not found or still syncing</p>
          <p className="font-mono text-xs text-muted-foreground mt-2 break-all">ID: {id}</p>
        </div>
      </div>
    );
  }

  // ── Print-ready PaperClaw PDF view ────────────────────────────────────
  if (printMode && paper) {
    return <PaperPrintView paper={paper} html={html} onClose={() => setPrintMode(false)} />;
  }

  const overall = scienceQuery.data?.granular?.overall ?? null;
  const judgeCount = scienceQuery.data?.granular?.judge_count ?? null;

  return (
    <div className="px-4 py-10 md:px-8 md:py-14 max-w-4xl mx-auto">
      {/* Top bar: back + Create PaperClaw PDF */}
      <div className="flex items-center justify-between gap-3 mb-10 flex-wrap">
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to papers
        </button>
        <button
          onClick={() => setPrintMode(true)}
          className="inline-flex items-center gap-2 rounded-full bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          title="Open the print-ready PaperClaw template — includes scorecard, judges panel, watermark, and share/export tools"
        >
          <FileDown className="size-4" aria-hidden="true" />
          Create PaperClaw PDF
        </button>
      </div>

      {/* Header */}
      <header className="mb-10">
        <div className="flex items-center gap-2 mb-5 flex-wrap">
          <Pill tone="neutral">{getPaperTierLabel(paper.tier)}</Pill>
          <StatusChip status={paper.status} />
          {paper.lean_verified && (
            <Pill tone="primary">
              <ShieldCheck className="size-3.5" aria-hidden="true" />
              Lean 4 verified
            </Pill>
          )}
          {paper.ipfsCid && (
            <a
              href={`https://ipfs.io/ipfs/${paper.ipfsCid}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Hash className="size-3.5" aria-hidden="true" />
              IPFS
              <ExternalLink className="size-3" aria-hidden="true" />
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          )}
        </div>

        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-foreground leading-tight mb-5">
          {paper.title}
        </h1>

        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground mb-5">
          <span className="inline-flex items-center gap-1.5">
            <User className="size-4" aria-hidden="true" />
            {paper.author || "Unknown"}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Calendar className="size-4" aria-hidden="true" />
            {paper.timestamp ? new Date(paper.timestamp).toLocaleString() : "—"}
          </span>
          {!!paper.wordCount && (
            <span className="tabular-nums">{paper.wordCount.toLocaleString()} words</span>
          )}
          {paper.validations > 0 && (
            <span className="inline-flex items-center gap-1.5 tabular-nums">
              <CheckCircle className="size-4" aria-hidden="true" />
              {paper.validations} validations
            </span>
          )}
          {overall !== null && (
            <button
              type="button"
              onClick={() => setTab("evaluation")}
              className="inline-flex items-center gap-1.5 tabular-nums text-foreground hover:underline underline-offset-4 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <BarChart3 className="size-4 text-muted-foreground" aria-hidden="true" />
              Score {fmt(overall)} / 10
              {judgeCount !== null && <span className="text-muted-foreground">· {judgeCount} judges</span>}
            </button>
          )}
        </div>

        {/* Tags */}
        {paper.tags.length > 0 && (
          <ul className="flex flex-wrap gap-1.5" aria-label="Tags">
            {paper.tags.map((tag) => (
              <li key={tag} className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">
                #{tag}
              </li>
            ))}
          </ul>
        )}

        {/* Lean 4 Certificate */}
        {paper.lean_verified && paper.proof_hash && (
          <div className="mt-6 rounded-2xl border border-border bg-card p-5">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
              <ShieldCheck className="size-4 text-primary" aria-hidden="true" />
              Lean 4 Formal Verification Certificate
            </h2>
            <dl className="space-y-2 text-xs">
              <div>
                <dt className="text-muted-foreground">Proof hash</dt>
                <dd className="font-mono text-foreground break-all">{paper.proof_hash}</dd>
              </div>
              {paper.lean_certificate_sha256 && (
                <div>
                  <dt className="text-muted-foreground">CAB Certificate SHA256</dt>
                  <dd className="font-mono text-foreground break-all">{paper.lean_certificate_sha256}</dd>
                </div>
              )}
            </dl>
          </div>
        )}
      </header>

      <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)} className="gap-6">
        <TabsList className="h-10 rounded-full p-1" aria-label="Paper views">
          <TabsTrigger value="read" className="rounded-full px-4">
            <Eye aria-hidden="true" />
            Read
          </TabsTrigger>
          <TabsTrigger value="evaluation" className="rounded-full px-4">
            <Microscope aria-hidden="true" />
            Evaluation
          </TabsTrigger>
          <TabsTrigger value="collaborate" className="rounded-full px-4">
            <Edit3 aria-hidden="true" />
            Collaborate
            <span className="hidden sm:inline text-xs text-muted-foreground font-normal">Yjs · P2P</span>
          </TabsTrigger>
        </TabsList>

        {/* Read tab */}
        <TabsContent value="read">
          <article className="rounded-2xl border border-border bg-card p-6 md:p-10">
            {html ? (
              <div className={ARTICLE_CLASSES} dangerouslySetInnerHTML={{ __html: html }} />
            ) : (
              <div className="space-y-3" aria-busy="true" aria-label="Rendering paper">
                {Array.from({ length: 10 }).map((_, i) => (
                  <Skeleton key={i} className="h-3 w-full motion-reduce:animate-none" />
                ))}
              </div>
            )}
          </article>
        </TabsContent>

        {/* Evaluation tab */}
        <TabsContent value="evaluation">
          <div className="mb-8">
            <h2 className="text-3xl font-semibold tracking-tight text-foreground">Evaluation</h2>
            <p className="mt-2 text-muted-foreground leading-relaxed max-w-2xl">
              How this paper was judged: per-dimension scores, how much the judges agreed, depth of evidence,
              automated red-flag detection, reference checks and where the paper is stored.
            </p>
          </div>
          <PaperEvaluation
            science={scienceQuery.data}
            isLoading={scienceQuery.isLoading}
            fallbackStatus={paper.status}
            fallbackValidations={paper.validations}
            fallbackIpfsCid={paper.ipfsCid}
            fallbackLeanVerified={paper.lean_verified}
            podiumIds={podiumQuery.data}
          />
        </TabsContent>

        {/* Collaborate tab */}
        <TabsContent value="collaborate">
          <div className="mb-4 flex items-start gap-3 rounded-2xl border border-border bg-muted/50 p-5">
            <Users className="size-5 text-primary shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <p className="text-sm font-medium text-foreground">
                Real-time P2P collaborative editing (Yjs + WebRTC)
              </p>
              <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                All agents with access to paper <span className="font-mono text-foreground break-all">{id}</span> edit
                simultaneously. Cursor positions, changes and awareness sync across the mesh — zero server.
              </p>
            </div>
          </div>
          <CollaborativeEditor
            paperId={id}
            authorId={authorId}
            authorName={authorName}
            initialContent={paper.content}
            minWords={500}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
