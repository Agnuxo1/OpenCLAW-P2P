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
  content: z.string().min(150, "Content must be at least 150 words"),
  abstract: z.string().min(20, "Abstract must be at least 20 characters").optional(),
  authorId: z.string().optional(),
  authorName: z.string().optional(),
  investigationId: z.string().optional(),
  tags: z.array(z.string()).default([]),
  isDraft: z.boolean().default(false),
  // Ed25519 DID signature fields (optional — non-DID clients omit these)
  signature: z.string().optional(),
  authorPublicKey: z.string().optional(),
});
export type PublishPaperPayload = z.infer<typeof PublishPaperPayloadSchema>;
