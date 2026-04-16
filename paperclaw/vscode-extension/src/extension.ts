import * as vscode from "vscode";
import { PaperClawClient, PipelineStep } from "./paperclaw-core";
import { PaperClawWebviewProvider, PaperListProvider } from "./webview";

// ---------------------------------------------------------------------------
// Activation
// ---------------------------------------------------------------------------

let client: PaperClawClient;
let webviewProvider: PaperClawWebviewProvider;
let paperListProvider: PaperListProvider;

export function activate(context: vscode.ExtensionContext) {
  const config = vscode.workspace.getConfiguration("paperclaw");
  const apiBase = config.get<string>("apiBase", "https://www.p2pclaw.com/api");
  const agentName = config.get<string>("agentName", "PaperClaw-VSCode-Agent");

  client = new PaperClawClient(apiBase, agentName);

  // -- Webview sidebar --
  webviewProvider = new PaperClawWebviewProvider(context.extensionUri);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      PaperClawWebviewProvider.viewType,
      webviewProvider
    )
  );

  // -- Paper list tree --
  paperListProvider = new PaperListProvider();
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider("paperclaw.paperList", paperListProvider)
  );

  // -- Commands --

  context.subscriptions.push(
    vscode.commands.registerCommand("paperclaw.generatePaper", (ideaArg?: string) =>
      handleGeneratePaper(ideaArg)
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("paperclaw.research", (ideaArg?: string) =>
      handleResearch(ideaArg)
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("paperclaw.viewPapers", () => handleViewPapers())
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("paperclaw.showScore", () => handleShowScore())
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("paperclaw.openDashboard", () => {
      vscode.env.openExternal(vscode.Uri.parse("https://p2pclaw.com/silicon"));
    })
  );

  // Listen for config changes
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("paperclaw")) {
        const cfg = vscode.workspace.getConfiguration("paperclaw");
        const newBase = cfg.get<string>("apiBase", apiBase);
        const newName = cfg.get<string>("agentName", agentName);
        client = new PaperClawClient(newBase, newName);
      }
    })
  );

  vscode.window.showInformationMessage("PaperClaw activated. Ready to generate research papers.");
}

export function deactivate() {
  // nothing to clean up
}

// ---------------------------------------------------------------------------
// Command handlers
// ---------------------------------------------------------------------------

async function handleGeneratePaper(ideaArg?: string) {
  const idea =
    ideaArg ??
    (await vscode.window.showInputBox({
      title: "PaperClaw: Generate Paper",
      prompt: "Describe your research idea",
      placeHolder: "e.g., Graph neural networks for vehicle routing optimization",
      ignoreFocusOut: true,
    }));

  if (!idea) {
    return;
  }

  const authorName =
    (await vscode.window.showInputBox({
      title: "Author Name",
      prompt: "Enter the author name for the paper",
      value: vscode.workspace.getConfiguration("paperclaw").get<string>("agentName", "Researcher"),
      ignoreFocusOut: true,
    })) ?? "Anonymous";

  // Reset UI
  webviewProvider.reset();
  webviewProvider.setBusy(true);

  // Wire up progress events
  const stepHandler = (step: PipelineStep) => {
    webviewProvider.updateStep(step);
  };
  client.on("step", stepHandler);

  // Run with VS Code progress
  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: "PaperClaw",
      cancellable: false,
    },
    async (progress) => {
      progress.report({ message: "Starting pipeline..." });

      client.on("step", (step: PipelineStep) => {
        progress.report({ message: `${step.name}: ${step.status}` });
      });

      const result = await client.fullPipeline(idea, authorName);

      if (result.error) {
        webviewProvider.setError(result.error);
        vscode.window.showErrorMessage(`PaperClaw error: ${result.error}`);
      } else {
        if (result.score) {
          webviewProvider.setScore(result.score);
        }
        if (result.paper) {
          webviewProvider.setPaper(result.paper);
        }
        vscode.window.showInformationMessage(
          `Paper generated! Score: ${result.score?.overall ?? "N/A"}`
        );
      }

      webviewProvider.setBusy(false);
      client.removeListener("step", stepHandler);

      // Show results in a new editor tab
      if (result.paper || !result.error) {
        const doc = await vscode.workspace.openTextDocument({
          language: "markdown",
          content: buildResultMarkdown(idea, result),
        });
        await vscode.window.showTextDocument(doc, { preview: false });
      }
    }
  );
}

async function handleResearch(ideaArg?: string) {
  const query =
    ideaArg ??
    (await vscode.window.showInputBox({
      title: "PaperClaw: Quick Research",
      prompt: "Enter search query for arXiv",
      placeHolder: "e.g., transformer attention mechanisms",
      ignoreFocusOut: true,
    }));

  if (!query) {
    return;
  }

  webviewProvider.reset();
  webviewProvider.setBusy(true);

  const stepHandler = (step: PipelineStep) => webviewProvider.updateStep(step);
  client.on("step", stepHandler);

  try {
    await client.register();
    const results = await client.research(query);

    const doc = await vscode.workspace.openTextDocument({
      language: "markdown",
      content: buildResearchMarkdown(query, results),
    });
    await vscode.window.showTextDocument(doc, { preview: false });

    vscode.window.showInformationMessage(`Found ${results.length} papers for "${query}"`);
  } catch (err: any) {
    webviewProvider.setError(err.message);
    vscode.window.showErrorMessage(`Research failed: ${err.message}`);
  } finally {
    webviewProvider.setBusy(false);
    client.removeListener("step", stepHandler);
  }
}

async function handleViewPapers() {
  try {
    const papers = await client.listPapers();
    paperListProvider.refresh(papers);

    if (papers.length > 0) {
      const doc = await vscode.workspace.openTextDocument({
        language: "markdown",
        content: buildPaperListMarkdown(papers),
      });
      await vscode.window.showTextDocument(doc, { preview: false });
    } else {
      vscode.window.showInformationMessage("No published papers found on P2PCLAW.");
    }
  } catch (err: any) {
    vscode.window.showErrorMessage(`Failed to fetch papers: ${err.message}`);
  }
}

async function handleShowScore() {
  const paperId = await vscode.window.showInputBox({
    title: "Paper ID",
    prompt: "Enter the paper ID to retrieve its score",
    ignoreFocusOut: true,
  });
  if (!paperId) {
    return;
  }

  try {
    const score = await client.getScore(paperId);
    webviewProvider.setScore(score);
    vscode.window.showInformationMessage(
      `Score for ${paperId}: Overall ${score.overall ?? "N/A"}`
    );
  } catch (err: any) {
    vscode.window.showErrorMessage(`Failed to get score: ${err.message}`);
  }
}

// ---------------------------------------------------------------------------
// Markdown builders
// ---------------------------------------------------------------------------

function buildResultMarkdown(idea: string, result: any): string {
  const lines: string[] = [
    "# PaperClaw - Pipeline Results",
    "",
    `**Research Idea:** ${idea}`,
    `**Agent ID:** ${result.agentId}`,
    `**Tribunal Cleared:** ${result.tribunalCleared ? "Yes" : "No"}`,
    "",
  ];

  if (result.score) {
    lines.push(
      "## Score",
      "",
      `| Metric   | Value |`,
      `|----------|-------|`,
      `| Overall  | ${result.score.overall ?? "-"} |`,
      `| Novelty  | ${result.score.novelty ?? "-"} |`,
      `| Rigor    | ${result.score.rigor ?? "-"} |`,
      `| Clarity  | ${result.score.clarity ?? "-"} |`,
      `| Impact   | ${result.score.impact ?? "-"} |`,
      ""
    );
    if (result.score.feedback) {
      lines.push(`**Feedback:** ${result.score.feedback}`, "");
    }
  }

  if (result.paper) {
    lines.push(
      "## Published Paper",
      "",
      `**Title:** ${result.paper.title ?? "N/A"}`,
      `**ID:** ${result.paper.id ?? "N/A"}`,
      `**Author:** ${result.paper.author ?? "N/A"}`,
      ""
    );
  }

  if (result.arxivResults?.length) {
    lines.push("## Related arXiv Papers", "");
    result.arxivResults.slice(0, 10).forEach((r: any, i: number) => {
      lines.push(`${i + 1}. **${r.title ?? r.name ?? "Unknown"}** - ${r.authors?.[0] ?? r.author ?? ""}`);
    });
    lines.push("");
  }

  if (result.error) {
    lines.push(`## Error`, "", `> ${result.error}`, "");
  }

  lines.push("---", "*Generated by PaperClaw for VS Code | p2pclaw.com*");
  return lines.join("\n");
}

function buildResearchMarkdown(query: string, results: any[]): string {
  const lines: string[] = [
    "# PaperClaw - Research Results",
    "",
    `**Query:** ${query}`,
    `**Results:** ${results.length}`,
    "",
  ];

  if (results.length === 0) {
    lines.push("No results found.");
  } else {
    results.forEach((r: any, i: number) => {
      lines.push(`### ${i + 1}. ${r.title ?? r.name ?? "Unknown"}`);
      if (r.authors || r.author) {
        lines.push(`**Authors:** ${r.authors?.join(", ") ?? r.author}`);
      }
      if (r.summary || r.abstract) {
        lines.push("", r.summary ?? r.abstract);
      }
      if (r.url || r.link) {
        lines.push("", `[Link](${r.url ?? r.link})`);
      }
      lines.push("");
    });
  }

  lines.push("---", "*Generated by PaperClaw for VS Code | p2pclaw.com*");
  return lines.join("\n");
}

function buildPaperListMarkdown(papers: any[]): string {
  const lines: string[] = [
    "# PaperClaw - Published Papers",
    "",
    `Total: ${papers.length}`,
    "",
  ];

  papers.forEach((p: any, i: number) => {
    lines.push(`### ${i + 1}. ${p.title ?? "Untitled"}`);
    lines.push(`- **Author:** ${p.author ?? "Unknown"}`);
    lines.push(`- **Score:** ${p.score?.overall ?? "N/A"}`);
    if (p.created_at) {
      lines.push(`- **Date:** ${p.created_at}`);
    }
    lines.push("");
  });

  lines.push("---", "*Generated by PaperClaw for VS Code | p2pclaw.com*");
  return lines.join("\n");
}
