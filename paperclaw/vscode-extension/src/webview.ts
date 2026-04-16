import * as vscode from "vscode";
import { PipelineStep } from "./paperclaw-core";

// ---------------------------------------------------------------------------
// WebviewProvider — main sidebar panel
// ---------------------------------------------------------------------------

export class PaperClawWebviewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "paperclaw.mainView";

  private _view?: vscode.WebviewView;
  private _steps: PipelineStep[] = [];
  private _score: any = null;
  private _paper: any = null;
  private _error: string | null = null;
  private _busy = false;

  constructor(private readonly _extensionUri: vscode.Uri) {}

  // -- VS Code lifecycle --

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };

    webviewView.webview.html = this._getHtml();

    webviewView.webview.onDidReceiveMessage((msg) => {
      switch (msg.command) {
        case "generate":
          vscode.commands.executeCommand("paperclaw.generatePaper", msg.idea);
          break;
        case "research":
          vscode.commands.executeCommand("paperclaw.research", msg.idea);
          break;
        case "viewPapers":
          vscode.commands.executeCommand("paperclaw.viewPapers");
          break;
      }
    });
  }

  // -- Public methods for the extension to push state --

  updateStep(step: PipelineStep) {
    const idx = this._steps.findIndex((s) => s.name === step.name);
    if (idx >= 0) {
      this._steps[idx] = step;
    } else {
      this._steps.push(step);
    }
    this._postMessage({ command: "updateSteps", steps: this._steps });
  }

  setScore(score: any) {
    this._score = score;
    this._postMessage({ command: "updateScore", score });
  }

  setPaper(paper: any) {
    this._paper = paper;
    this._postMessage({ command: "updatePaper", paper });
  }

  setError(error: string) {
    this._error = error;
    this._postMessage({ command: "error", error });
  }

  setBusy(busy: boolean) {
    this._busy = busy;
    this._postMessage({ command: "busy", busy });
  }

  reset() {
    this._steps = [];
    this._score = null;
    this._paper = null;
    this._error = null;
    this._busy = false;
    this._postMessage({ command: "reset" });
  }

  private _postMessage(msg: any) {
    this._view?.webview.postMessage(msg);
  }

  // -- HTML --

  private _getHtml(): string {
    return /*html*/ `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<style>
  :root {
    --bg: var(--vscode-editor-background, #1e1e1e);
    --fg: var(--vscode-editor-foreground, #cccccc);
    --accent: #4fc3f7;
    --success: #66bb6a;
    --warn: #ffa726;
    --error: #ef5350;
    --border: var(--vscode-panel-border, #333);
    --input-bg: var(--vscode-input-background, #2d2d2d);
    --btn-bg: var(--vscode-button-background, #0e639c);
    --btn-fg: var(--vscode-button-foreground, #fff);
    --btn-hover: var(--vscode-button-hoverBackground, #1177bb);
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: var(--vscode-font-family, 'Segoe UI', sans-serif);
    font-size: 13px;
    color: var(--fg);
    background: var(--bg);
    padding: 12px;
  }
  h2 { font-size: 15px; margin-bottom: 8px; color: var(--accent); }
  h3 { font-size: 13px; margin: 12px 0 6px; }

  /* Input area */
  .input-area { margin-bottom: 16px; }
  .input-area textarea {
    width: 100%;
    min-height: 80px;
    padding: 8px;
    border: 1px solid var(--border);
    border-radius: 4px;
    background: var(--input-bg);
    color: var(--fg);
    font-family: inherit;
    font-size: 13px;
    resize: vertical;
  }
  .input-area textarea:focus {
    outline: none;
    border-color: var(--accent);
  }
  .btn-row { display: flex; gap: 6px; margin-top: 8px; }
  .btn {
    padding: 6px 14px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
    font-weight: 600;
    transition: background 0.15s;
  }
  .btn-primary {
    background: var(--btn-bg);
    color: var(--btn-fg);
  }
  .btn-primary:hover { background: var(--btn-hover); }
  .btn-secondary {
    background: transparent;
    color: var(--accent);
    border: 1px solid var(--accent);
  }
  .btn-secondary:hover { background: rgba(79,195,247,0.1); }
  .btn:disabled { opacity: 0.5; cursor: not-allowed; }

  /* Timeline */
  .timeline { margin: 12px 0; }
  .step {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 5px 0;
    border-left: 2px solid var(--border);
    padding-left: 12px;
    margin-left: 6px;
    position: relative;
  }
  .step::before {
    content: '';
    position: absolute;
    left: -6px;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--border);
  }
  .step.running { border-left-color: var(--accent); }
  .step.running::before { background: var(--accent); animation: pulse 1s infinite; }
  .step.done { border-left-color: var(--success); }
  .step.done::before { background: var(--success); }
  .step.error { border-left-color: var(--error); }
  .step.error::before { background: var(--error); }
  .step-name { font-weight: 600; min-width: 70px; }
  .step-detail { opacity: 0.7; font-size: 11px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
  }

  /* Score */
  .score-panel {
    background: var(--input-bg);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 12px;
    margin: 12px 0;
    display: none;
  }
  .score-panel.visible { display: block; }
  .score-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    margin-top: 8px;
  }
  .score-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .score-badge {
    display: inline-block;
    padding: 2px 10px;
    border-radius: 10px;
    font-weight: 700;
    font-size: 12px;
  }
  .score-high { background: rgba(102,187,106,0.2); color: var(--success); }
  .score-mid  { background: rgba(255,167,38,0.2);  color: var(--warn); }
  .score-low  { background: rgba(239,83,80,0.2);   color: var(--error); }

  /* Paper preview */
  .paper-panel {
    background: var(--input-bg);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 12px;
    margin: 12px 0;
    display: none;
  }
  .paper-panel.visible { display: block; }
  .paper-title { font-size: 14px; font-weight: 700; margin-bottom: 6px; }
  .paper-meta { font-size: 11px; opacity: 0.6; margin-bottom: 8px; }
  .paper-actions { display: flex; gap: 6px; margin-top: 10px; }

  /* Error */
  .error-bar {
    background: rgba(239,83,80,0.15);
    border: 1px solid var(--error);
    border-radius: 4px;
    padding: 8px;
    margin: 8px 0;
    display: none;
    color: var(--error);
    font-size: 12px;
  }
  .error-bar.visible { display: block; }

  /* Spinner */
  .spinner {
    display: none;
    text-align: center;
    padding: 8px;
    color: var(--accent);
    font-size: 12px;
  }
  .spinner.visible { display: block; }

  /* Links */
  a { color: var(--accent); text-decoration: none; }
  a:hover { text-decoration: underline; }

  .footer {
    margin-top: 20px;
    font-size: 10px;
    opacity: 0.4;
    text-align: center;
  }
</style>
</head>
<body>

<h2>PaperClaw</h2>
<p style="font-size:11px;opacity:0.6;margin-bottom:12px">Generate published research papers from your IDE</p>

<div class="input-area">
  <textarea id="idea" placeholder="Describe your research idea...&#10;&#10;Example: Investigating the use of graph neural networks for optimizing vehicle routing in last-mile delivery"></textarea>
  <div class="btn-row">
    <button class="btn btn-primary" id="btnGenerate">Generate Paper</button>
    <button class="btn btn-secondary" id="btnResearch">Quick Research</button>
  </div>
</div>

<div class="spinner" id="spinner">Processing pipeline...</div>
<div class="error-bar" id="errorBar"></div>

<div class="timeline" id="timeline"></div>

<div class="score-panel" id="scorePanel">
  <h3>Paper Score</h3>
  <div class="score-grid" id="scoreGrid"></div>
</div>

<div class="paper-panel" id="paperPanel">
  <h3>Published Paper</h3>
  <div class="paper-title" id="paperTitle"></div>
  <div class="paper-meta" id="paperMeta"></div>
  <div class="paper-actions">
    <button class="btn btn-secondary" id="btnViewP2P">View on P2PCLAW</button>
    <button class="btn btn-secondary" id="btnViewAll">All Papers</button>
  </div>
</div>

<div class="footer">Powered by <a href="https://p2pclaw.com/silicon">P2PCLAW Silicon</a></div>

<script>
  const vscode = acquireVsCodeApi();
  const $ = (sel) => document.querySelector(sel);

  // -- Send messages to extension --
  $('#btnGenerate').addEventListener('click', () => {
    const idea = $('#idea').value.trim();
    if (!idea) return;
    vscode.postMessage({ command: 'generate', idea });
  });
  $('#btnResearch').addEventListener('click', () => {
    const idea = $('#idea').value.trim();
    if (!idea) return;
    vscode.postMessage({ command: 'research', idea });
  });
  $('#btnViewAll').addEventListener('click', () => {
    vscode.postMessage({ command: 'viewPapers' });
  });
  $('#btnViewP2P').addEventListener('click', () => {
    // open external
  });

  // -- Receive messages from extension --
  window.addEventListener('message', (event) => {
    const msg = event.data;
    switch (msg.command) {
      case 'reset':
        $('#timeline').innerHTML = '';
        $('#scorePanel').classList.remove('visible');
        $('#paperPanel').classList.remove('visible');
        $('#errorBar').classList.remove('visible');
        $('#spinner').classList.remove('visible');
        break;

      case 'busy':
        if (msg.busy) {
          $('#spinner').classList.add('visible');
          $('#btnGenerate').disabled = true;
          $('#btnResearch').disabled = true;
        } else {
          $('#spinner').classList.remove('visible');
          $('#btnGenerate').disabled = false;
          $('#btnResearch').disabled = false;
        }
        break;

      case 'updateSteps':
        renderSteps(msg.steps);
        break;

      case 'updateScore':
        renderScore(msg.score);
        break;

      case 'updatePaper':
        renderPaper(msg.paper);
        break;

      case 'error':
        $('#errorBar').textContent = msg.error;
        $('#errorBar').classList.add('visible');
        break;
    }
  });

  function renderSteps(steps) {
    const el = $('#timeline');
    el.innerHTML = steps.map(s => {
      const icon = s.status === 'done' ? '\\u2713'
                 : s.status === 'error' ? '\\u2717'
                 : s.status === 'running' ? '\\u25CB' : '\\u25CB';
      return '<div class="step ' + s.status + '">'
           + '<span class="step-name">' + icon + ' ' + s.name + '</span>'
           + '<span class="step-detail">' + (s.detail || '') + '</span>'
           + '</div>';
    }).join('');
  }

  function scoreBadgeClass(val) {
    if (typeof val !== 'number') return 'score-mid';
    if (val >= 7) return 'score-high';
    if (val >= 4) return 'score-mid';
    return 'score-low';
  }

  function renderScore(score) {
    if (!score) return;
    const panel = $('#scorePanel');
    const grid = $('#scoreGrid');
    const fields = ['overall', 'novelty', 'rigor', 'clarity', 'impact'];
    grid.innerHTML = fields.map(f => {
      const val = score[f] ?? '-';
      return '<div class="score-item">'
           + '<span>' + f.charAt(0).toUpperCase() + f.slice(1) + '</span>'
           + '<span class="score-badge ' + scoreBadgeClass(val) + '">' + val + '</span>'
           + '</div>';
    }).join('');
    if (score.feedback) {
      grid.innerHTML += '<div style="grid-column:1/3;font-size:11px;opacity:0.7;margin-top:6px">' + score.feedback + '</div>';
    }
    panel.classList.add('visible');
  }

  function renderPaper(paper) {
    if (!paper) return;
    $('#paperTitle').textContent = paper.title || 'Untitled';
    $('#paperMeta').textContent = 'ID: ' + (paper.id || 'N/A') + ' | Author: ' + (paper.author || 'N/A');
    $('#paperPanel').classList.add('visible');
  }
</script>

</body>
</html>`;
  }
}

// ---------------------------------------------------------------------------
// PaperListProvider — tree view of published papers
// ---------------------------------------------------------------------------

export class PaperListProvider implements vscode.TreeDataProvider<PaperTreeItem> {
  private _onDidChange = new vscode.EventEmitter<PaperTreeItem | undefined>();
  readonly onDidChangeTreeData = this._onDidChange.event;

  private _papers: any[] = [];

  refresh(papers: any[]) {
    this._papers = papers;
    this._onDidChange.fire(undefined);
  }

  getTreeItem(element: PaperTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(): PaperTreeItem[] {
    if (this._papers.length === 0) {
      const empty = new PaperTreeItem("No papers yet", "Run 'Generate Paper' to get started");
      empty.iconPath = new vscode.ThemeIcon("info");
      return [empty];
    }
    return this._papers.map((p) => {
      const item = new PaperTreeItem(
        p.title || "Untitled",
        p.author || "Unknown author"
      );
      item.iconPath = new vscode.ThemeIcon("file-text");
      item.tooltip = `Score: ${p.score?.overall ?? "N/A"}`;
      return item;
    });
  }
}

class PaperTreeItem extends vscode.TreeItem {
  constructor(label: string, description: string) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.description = description;
  }
}
