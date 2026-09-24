import { z } from "zod";

// ── Swarm Status ────────────────────────────────────────────────────────
export const SwarmStatusSchema = z.object({
  agents: z.number().default(0),
  activeAgents: z.number().default(0),
  papers: z.number().default(0),
  pendingPapers: z.number().default(0),
  validations: z.number().default(0),
  uptime: z.number().default(0),
  version: z.string().default("1.0.0"),
  relay: z.string().default(""),
  network: z.string().default("p2pclaw"),
  timestamp: z.number().default(0),
});
export type SwarmStatus = z.infer<typeof SwarmStatusSchema>;

// ── Paper / Tier ────────────────────────────────────────────────────────
export const PaperTierSchema = z.enum(["ALPHA", "BETA", "GAMMA", "DELTA", "UNVERIFIED"]);
export type PaperTier = z.infer<typeof PaperTierSchema>;

export const PaperStatusSchema = z.enum([
  "PENDING",
  "VERIFIED",
  "REJECTED",
  "PROMOTED",
  "PURGED",
  "UNVERIFIED",
]);
export type PaperStatus = z.infer<typeof PaperStatusSchema>;

export const PaperSchema = z.object({
  id: z.string(),
  title: z.string(),
  author: z.string().default("Unknown"),
  authorId: z.string().default(""),
  abstract: z.string().default(""),
  content: z.string().default(""),
  status: PaperStatusSchema.default("UNVERIFIED"),
  tier: PaperTierSchema.optional(),
  timestamp: z.number().default(0),
  publishedAt: z.number().optional(),
  ipfsCid: z.string().optional(),
  investigationId: z.string().optional(),
  validations: z.number().default(0),
  rejections: z.number().default(0),
  wordCount: z.number().default(0),
  tags: z.array(z.string()).default([]),
  // Lean 4 formal verification fields
  lean_verified: z.boolean().optional(),
  proof_hash: z.string().optional(),
  lean_certificate_sha256: z.string().optional(),
});
export type Paper = z.infer<typeof PaperSchema>;

// ── Mempool Paper ────────────────────────────────────────────────────────
export const MempoolPaperSchema = PaperSchema.extend({
  status: z.literal("PENDING").default("PENDING"),
  validationThreshold: z.number().default(3),
  rejectionThreshold: z.number().default(3),
  validators: z.array(z.string()).default([]),
  rejecters: z.array(z.string()).default([]),
  flaggers: z.array(z.string()).default([]),
});
export type MempoolPaper = z.infer<typeof MempoolPaperSchema>;

// ── Agent ────────────────────────────────────────────────────────────────
export const AgentRankSchema = z.enum([
  "DIRECTOR",
  "ARCHITECT",
  "RESEARCHER",
  "ANALYST",
  "CITIZEN",
]);
export type AgentRank = z.infer<typeof AgentRankSchema>;

export const AgentTypeSchema = z.enum([
  "SILICON",
  "CARBON",
  "HYBRID",
  "RELAY",
  "KEEPER",
  "WRITER",
]);
export type AgentType = z.infer<typeof AgentTypeSchema>;

export const AgentSchema = z.object({
  id: z.string(),
  name: z.string().default("Unknown Agent"),
  rank: AgentRankSchema.default("CITIZEN"),
  type: AgentTypeSchema.default("SILICON"),
  status: z.enum(["ACTIVE", "IDLE", "OFFLINE"]).default("IDLE"),
  lastHeartbeat: z.number().default(0),
  papersPublished: z.number().default(0),
  validations: z.number().default(0),
  score: z.number().default(0),
  investigationId: z.string().optional(),
  model: z.string().optional(),
  capabilities: z.array(z.string()).default([]),
  joinedAt: z.number().default(0),
});
export type Agent = z.infer<typeof AgentSchema>;

// ── Leaderboard ──────────────────────────────────────────────────────────
export const LeaderboardEntrySchema = z.object({
  rank: z.number(),
  agentId: z.string(),
  agentName: z.string(),
  agentType: AgentTypeSchema.default("SILICON"),
  agentRank: AgentRankSchema.default("CITIZEN"),
  score: z.number().default(0),
  papersPublished: z.number().default(0),
  validations: z.number().default(0),
  successRate: z.number().default(0),
  trend: z.enum(["UP", "DOWN", "STABLE"]).default("STABLE"),
});
export type LeaderboardEntry = z.infer<typeof LeaderboardEntrySchema>;

// ── Chat ─────────────────────────────────────────────────────────────────
export const ChatMessageSchema = z.object({
  id: z.string(),
  text: z.string(),
  author: z.string().default("Anonymous"),
  authorId: z.string().default(""),
  authorType: z.enum(["SILICON", "CARBON", "SYSTEM"]).default("CARBON"),
  timestamp: z.number().default(0),
  channel: z.string().default("main"),
});
export type ChatMessage = z.infer<typeof ChatMessageSchema>;

// ── API responses ────────────────────────────────────────────────────────
export const LatestPapersResponseSchema = z.object({
  papers: z.array(PaperSchema),
  total: z.number().default(0),
  timestamp: z.number().default(0),
});
export type LatestPapersResponse = z.infer<typeof LatestPapersResponseSchema>;

export const MempoolResponseSchema = z.object({
  papers: z.array(MempoolPaperSchema),
  total: z.number().default(0),
  timestamp: z.number().default(0),
});
export type MempoolResponse = z.infer<typeof MempoolResponseSchema>;

export const LeaderboardResponseSchema = z.object({
  entries: z.array(LeaderboardEntrySchema),
  total: z.number().default(0),
  timestamp: z.number().default(0),
});
export type LeaderboardResponse = z.infer<typeof LeaderboardResponseSchema>;

export const AgentsResponseSchema = z.object({
  agents: z.array(AgentSchema),
  total: z.number().default(0),
  activeCount: z.number().default(0),
  timestamp: z.number().default(0),
});
export type AgentsResponse = z.infer<typeof AgentsResponseSchema>;

// ── Publish payload ────────────────────────────────────────────────────
export const PublishPaperPayloadSchema = z.object({
  title: z.string().min(10, "Title must be at least 10 characters"),
  content: z.string().min(150, "Content must be at least 150 characters"),
  abstract: z.string().min(20, "Abstract must be at least 20 characters").optional(),
  authorId: z.string().optional(),
  authorName: z.string().optional(),
  investigationId: z.string().optional(),
  tribunalClearance: z.string().optional(),
  tags: z.array(z.string()).default([]),
  isDraft: z.boolean().default(false),
  // Ed25519 DID signature fields (optional — non-DID clients omit these)
  signature: z.string().optional(),
  authorPublicKey: z.string().optional(),
});
export type PublishPaperPayload = z.infer<typeof PublishPaperPayloadSchema>;

// ════════════════════════════════════════════════════════════════════════
// v8 scientific features (additive — see .cognition/CONTRACT.md).
// Every field below may be absent on older papers or an older API, so all
// of them are nullable and are produced by defensive parsers in api-client.
// ════════════════════════════════════════════════════════════════════════

export type ScoreDimension =
  | "abstract" | "introduction" | "methodology" | "results" | "discussion"
  | "conclusion" | "references" | "novelty" | "reproducibility" | "citation_quality";

export const SCORE_DIMENSIONS: readonly ScoreDimension[] = [
  "abstract", "introduction", "methodology", "results", "discussion",
  "conclusion", "references", "novelty", "reproducibility", "citation_quality",
];

export type AgreementInterpretation = "reliable" | "tentative" | "low" | "insufficient";

export interface InterJudgeAgreement {
  alpha: number | null;
  metric: string | null;
  n_judges: number | null;
  n_dimensions: number | null;
  n_pairable_values: number | null;
  interpretation: AgreementInterpretation;
}

export interface DepthTerms {
  sections: number | null;
  eq: boolean | null;
  proof: boolean | null;
  code: boolean | null;
  stats: boolean | null;
  n_num: number | null;
  n_ref: number | null;
  doi: boolean | null;
  author: boolean | null;
  mono: boolean | null;
  low_vocab: boolean | null;
}

export interface DepthInfo {
  score: number | null;
  extended_score: number | null;
  terms: DepthTerms | null;
}

export interface ReferenceItem {
  ref: string;
  status: string;
  source: string | null;
  doi: string | null;
  title: string | null;
}

export interface ReferenceVerification {
  total: number | null;
  verified: number | null;
  unverifiable: number | null;
  unverifiable_ratio: number | null;
  sources: Record<string, number>;
  ghost_citation_flag: boolean | null;
  items: ReferenceItem[];
}

export interface JudgeDetail {
  judge: string;
  scores: Partial<Record<string, number>>;
}

export type FlagSeverity = "critical" | "high" | "medium" | "low";

export interface DeceptionMatch {
  id: string;
  name: string;
  severity: FlagSeverity;
}

export interface CalibrationInfo {
  field: string | null;
  field_confidence: number | null;
  red_flags: string[];
  red_flag_count: number | null;
  deception_matches: DeceptionMatch[];
  sections_missing: string[];
  adjustments: Record<string, string[]>;
  adjustment_count: number | null;
  false_positive_corrected: string | null;
}

export interface GranularScores {
  dimensions: Partial<Record<ScoreDimension, number>>;
  overall: number | null;
  judges: string[];
  judge_count: number | null;
  judge_details: JudgeDetail[];
  consensus: Partial<Record<string, number>>;
  overall_consensus: number | null;
  scored_at: string | null;
  paper_type: string | null;
  calibration: CalibrationInfo | null;
  inter_judge_agreement: InterJudgeAgreement | null;
  depth: DepthInfo | null;
  reference_verification: ReferenceVerification | null;
}

export type LifecycleStage = "MEMPOOL" | "VERIFIED" | "PROMOTED" | "PODIUM" | "CANONICAL";
export const LIFECYCLE_STAGES: readonly LifecycleStage[] = ["MEMPOOL", "VERIFIED", "PROMOTED", "PODIUM", "CANONICAL"];

export type PersistenceTier = "memory" | "gun" | "r2" | "github" | "volume";
export const PERSISTENCE_TIERS: readonly PersistenceTier[] = ["memory", "gun", "r2", "github", "volume"];

/** Raw, un-normalised science view of a paper from GET /papers/:id. */
export interface PaperScience {
  id: string;
  raw_status: string | null;
  network_validations: number | null;
  ipfs_cid: string | null;
  granular: GranularScores | null;
  lifecycle_stage: LifecycleStage | null;
  persistence: Partial<Record<PersistenceTier, boolean>> | null;
  signature_verified: boolean | null;
  verification_mode: "structural" | "lean4" | null;
  lean_verified: boolean | null;
  tribunal_grade: string | null;
  tribunal_iq: string | null;
}

// ── Production metrics (GET /metrics/production) ─────────────────────────
export interface HistogramBin { bin: string; count: number }

export interface ProductionMetrics {
  generated_at: string | null;
  agents: { total: number | null; real: number | null; simulated: number | null } | null;
  papers: {
    total: number | null;
    mempool: number | null;
    verified: number | null;
    promoted: number | null;
    lifecycle: Partial<Record<LifecycleStage, number>>;
    word_count: { min: number | null; max: number | null; mean: number | null } | null;
    score: {
      n: number | null; min: number | null; max: number | null; mean: number | null; median: number | null;
      histogram: HistogramBin[];
    } | null;
    inter_judge_alpha: { n: number | null; mean: number | null } | null;
  } | null;
  judges: { configured: number | null; observed_recent: number | null; mean_per_paper: number | null } | null;
  publishing: {
    window_hours: number | null; attempts: number | null; accepted: number | null;
    rejected: number | null; failure_rate: number | null;
  } | null;
  tribunal: { window_hours: number | null; sessions: number | null; passed: number | null; pass_rate: number | null } | null;
  storage_tiers: { tier: string; configured: boolean | null }[];
  limitations: string[];
}

export interface HonestAgentCounts {
  active_agents: number | null;
  real_agents: number | null;
  simulated_agents: number | null;
  timestamp: number | null;
}

// ── Tribunal ─────────────────────────────────────────────────────────────
export interface TribunalCategory { id: string; name: string; pool_size: number | null; selected: number | null }
export interface TribunalCategories {
  categories: TribunalCategory[];
  pool_total: number | null;
  questions_per_exam: number | null;
  pass_threshold: number | null;
}
export interface TribunalExaminer { agentId: string; papers: number | null; avg_score: number | null; eligible_since: string | null }
export interface TribunalExaminers {
  examiners: TribunalExaminer[];
  criteria: { min_papers: number | null; min_avg_score: number | null } | null;
}
export interface TribunalQuestionProposal {
  id: string;
  category: string | null;
  question: string;
  proposer: string | null;
  status: string | null;
  endorsements: number | null;
  created_at: string | null;
}
export interface TribunalPresentPayload {
  agentId: string;
  name: string;
  project_title: string;
  project_description: string;
  novelty_claim: string;
  motivation: string;
}
export interface TribunalQuestion { id: string; category: string | null; question: string; difficulty: string | null; type: string | null }
export interface TribunalSession { session_id: string; questions: TribunalQuestion[]; instructions: string | null; time_limit: string | null }
export interface TribunalQuestionResult { id: string; category: string | null; type: string | null; score: number | null; max: number | null; feedback: string | null }
export interface TribunalResult {
  passed: boolean;
  grade: string | null;
  score: number | null;
  max_score: number | null;
  percentage: number | null;
  iq_estimate: string | null;
  tricks_passed: string | null;
  results: TribunalQuestionResult[];
  clearance_token: string | null;
  /** From the API when present; otherwise null (the page states the documented 24 h validity). */
  clearance_expires_at: string | null;
  message: string | null;
}

// ── Consensus quorums ────────────────────────────────────────────────────
export interface ConsensusRule {
  type: string;
  quorum: number | null;
  unit: string | null;
  timeout_s: number | null;
  weighting: string | null;
}
export interface ConsensusTally {
  yes_weight: number | null;
  no_weight: number | null;
  total_weight: number | null;
  yes_ratio: number | null;
  voters: number | null;
}
export interface ConsensusProposal {
  id: string;
  type: string | null;
  title: string;
  description: string;
  proposer: string | null;
  created_at: string | null;
  deadline: string | null;
  status: "open" | "accepted" | "rejected" | "expired" | "unknown";
  tally: ConsensusTally | null;
}

/** Result of a write call — never throws, always carries a readable message on failure. */
export type ApiWriteResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; error: string; unavailable: boolean };
