/**
 * PaperClaw — n8n Custom Node
 * ============================
 * Adds a "PaperClaw: Generate Paper" node to n8n workflows.
 * Calls the P2PCLAW API and outputs the paper URL + metadata.
 *
 * Installation (n8n self-hosted):
 *   1. Copy this file to ~/.n8n/custom/ (or your custom nodes dir)
 *   2. Restart n8n
 *   3. Search for "PaperClaw" in the node palette
 *
 * Installation (n8n community):
 *   npm install n8n-nodes-paperclaw  (coming soon)
 *
 * Alternatively, use n8n's built-in HTTP Request node:
 *   Method: POST
 *   URL: https://www.p2pclaw.com/api/paperclaw/generate
 *   Body (JSON): { "description": "{{ $json.description }}", "author": "n8n workflow" }
 *
 * Signed: Silicon: Claude Opus 4.7 / Carbon: Francisco Angulo de Lafuente / Platform: p2pclaw.com
 */

const PAPERCLAW_API = "https://www.p2pclaw.com/api/paperclaw/generate";

module.exports = {
  description: {
    displayName: "PaperClaw",
    name: "paperClaw",
    icon: "file:paperclaw.svg",
    group: ["transform"],
    version: 1,
    description: "Generate a peer-reviewed research paper via P2PCLAW",
    defaults: { name: "PaperClaw" },
    inputs: ["main"],
    outputs: ["main"],
    properties: [
      {
        displayName: "Description",
        name: "description",
        type: "string",
        typeOptions: { rows: 4 },
        default: "",
        placeholder: "Describe your research idea (30-4000 chars)...",
        description: "Research idea or project description. The richer, the better.",
        required: true,
      },
      {
        displayName: "Author",
        name: "author",
        type: "string",
        default: "n8n Workflow",
        description: "Author name to print on the paper",
      },
      {
        displayName: "Tags",
        name: "tags",
        type: "string",
        default: "",
        placeholder: "ai, distributed-systems",
        description: "Comma-separated topic tags (optional, max 10)",
      },
    ],
  },

  async execute() {
    const items = this.getInputData();
    const returnData = [];

    for (const item of items) {
      const description = this.getNodeParameter("description", 0, "") || item.json?.description;
      const author = this.getNodeParameter("author", 0, "n8n Workflow");
      const rawTags = this.getNodeParameter("tags", 0, "");
      const tags = rawTags
        ? rawTags.split(",").map((t) => t.trim()).filter(Boolean).slice(0, 10)
        : [];

      const resp = await this.helpers.httpRequest({
        method: "POST",
        url: PAPERCLAW_API,
        body: {
          description: String(description).slice(0, 4000),
          author,
          tags,
          client: "paperclaw-n8n",
        },
        json: true,
        timeout: 120000,
      });

      returnData.push({
        json: {
          success: resp.success,
          url: resp.url,
          title: resp.title,
          wordCount: resp.wordCount,
          pdfUrl: resp.url ? `${resp.url}#print` : null,
          llm: resp.llm,
          error: resp.error || resp.message,
        },
      });
    }

    return [returnData];
  },
};
