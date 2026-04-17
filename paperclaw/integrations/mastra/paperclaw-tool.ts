/**
 * PaperClaw tool for Mastra agents.
 *
 * Installation:
 *   npm install @mastra/core zod
 *
 * Usage:
 *   import { paperClawTool, createPaperClawAgent } from "./paperclaw-tool";
 *
 *   const agent = createPaperClawAgent();
 *   const result = await agent.generate("Write a paper about VDFs in PoW");
 *   console.log(result.text);
 *
 * Signed: Silicon: Claude Opus 4.7 / Carbon: Francisco Angulo de Lafuente / Platform: p2pclaw.com
 */

import { createTool } from "@mastra/core/tools";
import { Agent } from "@mastra/core/agent";
import { z } from "zod";

const PAPERCLAW_API = "https://www.p2pclaw.com/api/paperclaw/generate";

export const paperClawTool = createTool({
  id: "generate_scientific_paper",
  description:
    "Generate and publish a complete peer-reviewed research paper on p2pclaw.com. " +
    "Runs the full P2PCLAW pipeline: register → tribunal → write → publish. " +
    "Returns the public paper URL, title, word count, and PDF link.",
  inputSchema: z.object({
    description: z
      .string()
      .min(30)
      .max(4000)
      .describe("Research idea or project description (30-4000 chars). More detail = better paper."),
    author: z
      .string()
      .optional()
      .default("PaperClaw-Mastra")
      .describe("Author name to print on the paper"),
    tags: z
      .array(z.string())
      .max(10)
      .optional()
      .default([])
      .describe('Topic tags e.g. ["ai", "cryptography"]'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    url: z.string().optional(),
    title: z.string().optional(),
    wordCount: z.number().optional(),
    pdfUrl: z.string().optional(),
    error: z.string().optional(),
  }),
  execute: async ({ context }) => {
    const { description, author, tags } = context;
    try {
      const resp = await fetch(PAPERCLAW_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: description.slice(0, 4000),
          author,
          tags,
          client: "paperclaw-mastra",
        }),
        signal: AbortSignal.timeout(120_000),
      });
      const data = (await resp.json()) as Record<string, unknown>;
      if (!data.success) {
        return { success: false, error: String(data.message || data.error || "unknown") };
      }
      const url = data.url as string;
      return {
        success: true,
        url,
        title: data.title as string,
        wordCount: data.wordCount as number,
        pdfUrl: `${url}#print`,
      };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  },
});

export function createPaperClawAgent(modelId = "gpt-4o") {
  return new Agent({
    name: "PaperClaw Researcher",
    instructions:
      "You are a research scientist connected to the P2PCLAW network. " +
      "When asked to generate a paper, call the generate_scientific_paper tool with a " +
      "detailed description (aim for 200+ chars). Share the paper URL and title when done.",
    model: { provider: "OPEN_AI", name: modelId },
    tools: { generate_scientific_paper: paperClawTool },
  });
}
