/**
 * PaperClaw — VS Code / Cursor / Windsurf / opencode extension.
 *
 * UX is deliberately tiny: one command turns a short project description into
 * a peer-reviewed paper on p2pclaw.com. Everything heavy happens server-side
 * on Railway. The extension is just a well-styled client.
 *
 * Commands:
 *   - paperclaw.publishProject       → prompt for description, publish, open URL
 *   - paperclaw.publishFromReadme    → use the current README.md as the description
 *   - paperclaw.openDashboard        → open p2pclaw.com
 *   - paperclaw.openLastPaper        → open the most recent paper URL
 *
 * Signed: Silicon: Claude Opus 4.6 / Carbon: Francisco Angulo de Lafuente /
 * Plataforma: p2pclaw.com
 */

import * as vscode from "vscode";
import * as https from "https";
import * as http from "http";
import { URL } from "url";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GenerateResponse {
  success: boolean;
  paperId?: string;
  url?: string;
  title?: string;
  author?: string;
  wordCount?: number;
  error?: string;
  message?: string;
  llm?: { provider?: string; model?: string };
}

const LAST_PAPER_KEY = "paperclaw.lastPaperUrl";
const CLIENT_ID = resolveClientId();

// ---------------------------------------------------------------------------
// Activation
// ---------------------------------------------------------------------------

let outputChannel: vscode.OutputChannel | undefined;

export function activate(context: vscode.ExtensionContext): void {
  outputChannel = vscode.window.createOutputChannel("PaperClaw");
  context.subscriptions.push(outputChannel);

  log(`PaperClaw ${context.extension.packageJSON.version} activated (client=${CLIENT_ID})`);

  context.subscriptions.push(
    vscode.commands.registerCommand("paperclaw.publishProject", () => publishFlow(context)),
    vscode.commands.registerCommand("paperclaw.publishFromReadme", () => publishFromReadme(context)),
    vscode.commands.registerCommand("paperclaw.openDashboard", () => {
      void vscode.env.openExternal(vscode.Uri.parse("https://www.p2pclaw.com"));
    }),
    vscode.commands.registerCommand("paperclaw.openLastPaper", async () => {
      const last = context.globalState.get<string>(LAST_PAPER_KEY);
      if (!last) {
        void vscode.window.showInformationMessage("PaperClaw: no paper has been generated yet.");
        return;
      }
      void vscode.env.openExternal(vscode.Uri.parse(last));
    }),
  );
}

export function deactivate(): void {
  outputChannel?.dispose();
}

// ---------------------------------------------------------------------------
// Main command: prompt for a description, generate & publish, open URL.
// ---------------------------------------------------------------------------

async function publishFlow(context: vscode.ExtensionContext): Promise<void> {
  const description = await vscode.window.showInputBox({
    title: "PaperClaw — describe your project",
    prompt:
      "In 1-3 sentences, describe what you are building. PaperClaw will turn this into a peer-reviewed paper on p2pclaw.com.",
    placeHolder: "e.g. A peer-to-peer reputation system using verifiable delay functions and hybrid Byzantine consensus.",
    ignoreFocusOut: true,
    validateInput: (v) => {
      const t = v.trim();
      if (t.length === 0) return null;
      if (t.length < 30) return `A bit more detail, please — ${30 - t.length} more characters.`;
      if (t.length > 4000) return "Too long. Trim to under 4000 characters.";
      return null;
    },
  });
  if (!description) return;

  await runGenerate(context, description.trim(), { source: "inputbox" });
}

async function publishFromReadme(context: vscode.ExtensionContext): Promise<void> {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) {
    void vscode.window.showErrorMessage("PaperClaw: open a folder first.");
    return;
  }

  let readmeUri: vscode.Uri | undefined;
  for (const folder of folders) {
    const pattern = new vscode.RelativePattern(folder, "README*.md");
    const files = await vscode.workspace.findFiles(pattern, null, 1);
    if (files.length > 0) {
      readmeUri = files[0];
      break;
    }
  }

  if (!readmeUri) {
    void vscode.window.showErrorMessage("PaperClaw: no README.md found in the workspace.");
    return;
  }

  const bytes = await vscode.workspace.fs.readFile(readmeUri);
  const readme = Buffer.from(bytes).toString("utf8").trim();
  if (readme.length < 80) {
    void vscode.window.showErrorMessage("PaperClaw: README.md is too short to use as a description.");
    return;
  }

  await runGenerate(context, readme.slice(0, 4000), {
    source: "readme",
    title: extractMarkdownTitle(readme) ?? undefined,
  });
}

interface GenerateOpts {
  source: string;
  title?: string;
}

async function runGenerate(
  context: vscode.ExtensionContext,
  description: string,
  opts: GenerateOpts,
): Promise<void> {
  const config = vscode.workspace.getConfiguration("paperclaw");
  let author = config.get<string>("authorName", "").trim();
  if (!author) {
    const asked = await vscode.window.showInputBox({
      title: "PaperClaw — author name",
      prompt: "Name to print on the paper",
      placeHolder: "Ada Lovelace",
      ignoreFocusOut: true,
    });
    if (!asked) return;
    author = asked.trim();
  }

  const rawTags = config.get<string>("tags", "").trim();
  const tags = rawTags
    ? rawTags.split(",").map((t) => t.trim()).filter(Boolean).slice(0, 10)
    : [];

  const apiBase = config.get<string>("apiBase", "https://p2pclaw-mcp-server-production-ac1c.up.railway.app").replace(/\/$/, "");

  log(`generate → ${apiBase}/paperclaw/generate   author="${author}"  source=${opts.source}  chars=${description.length}`);

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: "PaperClaw",
      cancellable: false,
    },
    async (progress) => {
      progress.report({ message: "Sending to your P2PCLAW agent…" });

      let resp: GenerateResponse;
      try {
        resp = await postJSON<GenerateResponse>(`${apiBase}/paperclaw/generate`, {
          description,
          author,
          title: opts.title,
          tags,
          client: CLIENT_ID,
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        log(`  error: ${msg}`);
        void vscode.window.showErrorMessage(`PaperClaw: ${msg}`);
        return;
      }

      if (!resp.success || !resp.url) {
        const msg = resp.message || resp.error || "Unknown error";
        log(`  server error: ${msg}`);
        void vscode.window.showErrorMessage(`PaperClaw: ${msg}`);
        return;
      }

      log(`  ok → ${resp.url}`);
      await context.globalState.update(LAST_PAPER_KEY, resp.url);

      progress.report({ message: "Paper published ✓" });

      const openLabel = "Open paper";
      const copyLabel = "Copy link";
      const printLabel = "Save as PDF";
      const choice = await vscode.window.showInformationMessage(
        `PaperClaw: “${resp.title ?? "Untitled"}” published (${resp.wordCount ?? "?"} words${
          resp.llm?.provider ? `, via ${resp.llm.provider}` : ""
        }).`,
        openLabel,
        copyLabel,
        printLabel,
      );

      if (choice === openLabel && config.get<boolean>("openInBrowser", true)) {
        void vscode.env.openExternal(vscode.Uri.parse(resp.url));
      } else if (choice === copyLabel) {
        await vscode.env.clipboard.writeText(resp.url);
        void vscode.window.showInformationMessage("PaperClaw: link copied to clipboard.");
      } else if (choice === printLabel) {
        void vscode.env.openExternal(vscode.Uri.parse(`${resp.url}#print`));
      } else if (config.get<boolean>("openInBrowser", true)) {
        // Default: open automatically if user ignored the toast.
        void vscode.env.openExternal(vscode.Uri.parse(resp.url));
      }
    },
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractMarkdownTitle(md: string): string | null {
  const m = md.match(/^\s*#\s+(.+?)\s*$/m);
  return m ? m[1].trim() : null;
}

function resolveClientId(): string {
  // Detect the host IDE so the server can record which client generated the paper.
  const appName = (vscode.env.appName || "").toLowerCase();
  if (appName.includes("cursor")) return "paperclaw-cursor";
  if (appName.includes("windsurf")) return "paperclaw-windsurf";
  if (appName.includes("opencode")) return "paperclaw-opencode";
  if (appName.includes("antigravity")) return "paperclaw-antigravity";
  if (appName.includes("vscodium")) return "paperclaw-vscodium";
  if (appName.includes("visual studio code")) return "paperclaw-vscode";
  return "paperclaw-vscode-compatible";
}

function log(line: string): void {
  const ts = new Date().toISOString().replace("T", " ").slice(0, 19);
  outputChannel?.appendLine(`[${ts}] ${line}`);
}

// ---------------------------------------------------------------------------
// Zero-dep HTTP POST with JSON body + timeout.
// ---------------------------------------------------------------------------

function postJSON<T>(url: string, body: Record<string, unknown>, timeoutMs = 90_000): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      reject(new Error(`Invalid URL: ${url}`));
      return;
    }
    const transport = parsed.protocol === "https:" ? https : http;
    const payload = Buffer.from(JSON.stringify(body), "utf8");

    const req = transport.request(
      {
        method: "POST",
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === "https:" ? 443 : 80),
        path: parsed.pathname + parsed.search,
        headers: {
          "Content-Type": "application/json",
          "Content-Length": payload.length,
          "User-Agent": `PaperClaw/${CLIENT_ID}`,
          Accept: "application/json",
        },
        timeout: timeoutMs,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c: Buffer) => chunks.push(c));
        res.on("end", () => {
          const raw = Buffer.concat(chunks).toString("utf8");
          try {
            const parsedBody = JSON.parse(raw) as T;
            if (res.statusCode && res.statusCode >= 400) {
              // Server returns JSON error envelopes — surface message.
              const env = parsedBody as unknown as { message?: string; error?: string };
              reject(new Error(env.message || env.error || `HTTP ${res.statusCode}`));
              return;
            }
            resolve(parsedBody);
          } catch {
            reject(new Error(`Malformed JSON response (HTTP ${res.statusCode}): ${raw.slice(0, 160)}`));
          }
        });
      },
    );

    req.on("error", (err) => reject(err));
    req.on("timeout", () => {
      req.destroy();
      reject(new Error(`Request timed out after ${Math.round(timeoutMs / 1000)}s`));
    });

    req.write(payload);
    req.end();
  });
}
