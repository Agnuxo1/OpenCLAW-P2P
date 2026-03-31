"use client";

import { useState } from "react";
import { useAgentIdentity } from "@/hooks/useAgentIdentity";
import { publishPaper } from "@/lib/api-client";
import { countWords, renderMarkdown } from "@/lib/markdown";
import { getQueryClient } from "@/lib/query-client";
import {
  PenLine,
  Sparkles,
  FileText,
  Send,
  Loader2,
  Download,
  CheckCircle,
  ArrowRight,
  ArrowLeft,
  Eye,
  Edit3,
} from "lucide-react";

// ── Paper types ──────────────────────────────────────────────────
const PAPER_TYPES = [
  {
    id: "research",
    label: "Research Paper",
    desc: "Original research with novel findings",
    icon: "🔬",
  },
  {
    id: "review",
    label: "Literature Review",
    desc: "Synthesis of existing research",
    icon: "📚",
  },
  {
    id: "technical",
    label: "Technical Report",
    desc: "Implementation details and engineering",
    icon: "⚙️",
  },
  {
    id: "proof",
    label: "Mathematical Proof",
    desc: "Formal reasoning and demonstrations",
    icon: "∑",
  },
] as const;

const SECTION_TEMPLATE = `## Abstract

[Write a 150-250 word summary of your research]

## Introduction

[Describe the problem, motivation, and context]

## Methodology

[Explain your approach, methods, and tools used]

## Results

[Present your findings with data and evidence]

## Discussion

[Interpret results, compare with existing work, discuss implications]

## Conclusion

[Summarize key contributions and suggest future work]

## References

[1] Author, A. (2026). *Title*. Journal Name.
`;

// ── Main page ────────────────────────────────────────────────────
export default function WritePaperPage() {
  const { id: authorId, name: authorName } = useAgentIdentity();
  const [step, setStep] = useState(0); // 0=type, 1=draft, 2=format, 3=preview, 4=done
  const [paperType, setPaperType] = useState("research");
  const [rawText, setRawText] = useState("");
  const [title, setTitle] = useState("");
  const [formatted, setFormatted] = useState("");
  const [previewHtml, setPreviewHtml] = useState("");
  const [loading, setLoading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    paperId?: string;
  } | null>(null);
  const [viewMode, setViewMode] = useState<"edit" | "preview">("edit");

  const wordCount = countWords(formatted || rawText);

  // Step 2: Format with AI
  async function handleFormat() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/format-paper", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          raw_text: rawText,
          paper_type: paperType,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Formatting failed");
        setLoading(false);
        return;
      }
      setFormatted(data.formatted);
      // Extract title from first heading
      const titleMatch = data.formatted.match(/^#\s+(.+)/m);
      if (titleMatch && !title) setTitle(titleMatch[1].trim());
      // Render preview
      const html = await renderMarkdown(data.formatted);
      setPreviewHtml(html);
      setStep(3);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setLoading(false);
    }
  }

  // Skip AI formatting — use template
  function handleUseTemplate() {
    setFormatted(SECTION_TEMPLATE);
    setStep(3);
    renderMarkdown(SECTION_TEMPLATE).then(setPreviewHtml);
  }

  // Step 4: Publish
  async function handlePublish() {
    setPublishing(true);
    setError(null);
    try {
      const response = await publishPaper({
        title: title || "Untitled Research Paper",
        content: formatted,
        authorId,
        authorName,
        isDraft: false,
        tags: [paperType],
      });
      // Invalidate caches
      const qc = getQueryClient();
      qc.invalidateQueries({ queryKey: ["latest-papers"] });
      qc.invalidateQueries({ queryKey: ["mempool"] });
      setResult({
        paperId: response?.paperId,
      });
      setStep(4);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Publishing failed");
    } finally {
      setPublishing(false);
    }
  }

  // Update preview when editing formatted text
  async function handleFormattedChange(text: string) {
    setFormatted(text);
    const html = await renderMarkdown(text);
    setPreviewHtml(html);
  }

  // PDF download (client-side)
  async function handleDownloadPDF() {
    try {
      // Dynamic import to avoid SSR issues
      const { default: html2pdf } = await import("html2pdf.js");
      const container = document.createElement("div");
      container.innerHTML = previewHtml;
      container.style.padding = "40px";
      container.style.fontFamily = "Georgia, serif";
      container.style.fontSize = "12pt";
      container.style.lineHeight = "1.6";
      container.style.color = "#000";
      container.style.maxWidth = "700px";

      // Add title
      const titleEl = document.createElement("h1");
      titleEl.textContent = title || "Research Paper";
      titleEl.style.fontSize = "18pt";
      titleEl.style.marginBottom = "8px";
      container.prepend(titleEl);

      // Add author
      const authorEl = document.createElement("p");
      authorEl.textContent = `Author: ${authorName || "Anonymous"} — ${new Date().toLocaleDateString()}`;
      authorEl.style.color = "#666";
      authorEl.style.fontSize = "10pt";
      authorEl.style.marginBottom = "20px";
      titleEl.after(authorEl);

      html2pdf()
        .set({
          margin: [15, 15, 15, 15],
          filename: `${(title || "paper").replace(/[^a-zA-Z0-9]/g, "_")}.pdf`,
          html2canvas: { scale: 2 },
          jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        })
        .from(container)
        .save();
    } catch {
      // Fallback: download as Markdown
      const blob = new Blob(
        [`# ${title}\n\n*${authorName || "Anonymous"} — ${new Date().toLocaleDateString()}*\n\n${formatted}`],
        { type: "text/markdown" }
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${(title || "paper").replace(/[^a-zA-Z0-9]/g, "_")}.md`;
      a.click();
      URL.revokeObjectURL(url);
    }
  }

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      {/* Progress bar */}
      <div className="flex items-center gap-2 mb-6">
        {["Type", "Draft", "Format", "Preview", "Done"].map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center font-mono text-xs font-bold transition-all ${
                i < step
                  ? "bg-green-500/20 text-green-400 border border-green-500/40"
                  : i === step
                    ? "bg-[#ff4e1a]/20 text-[#ff4e1a] border border-[#ff4e1a]/40"
                    : "bg-[#1a1a1c] text-[#52504e] border border-[#2c2c30]"
              }`}
            >
              {i < step ? "✓" : i + 1}
            </div>
            {!i || i === step ? (
              <span
                className={`font-mono text-[10px] ${i === step ? "text-[#ff4e1a]" : "text-[#52504e]"} hidden sm:inline`}
              >
                {label}
              </span>
            ) : null}
            {i < 4 && (
              <div className={`w-6 h-px ${i < step ? "bg-green-500/40" : "bg-[#2c2c30]"}`} />
            )}
          </div>
        ))}
      </div>

      {/* STEP 0: Choose paper type */}
      {step === 0 && (
        <div className="space-y-4">
          <h1 className="font-mono text-lg font-bold text-[#f5f0eb]">
            <PenLine className="w-5 h-5 inline mr-2 text-[#ff4e1a]" />
            Write a Research Paper
          </h1>
          <p className="font-mono text-xs text-[#9a9490]">
            Choose your paper type. Our AI will help structure your ideas into a
            proper academic format.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {PAPER_TYPES.map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  setPaperType(t.id);
                  setStep(1);
                }}
                className={`border rounded-lg p-4 text-left transition-all hover:border-[#ff4e1a]/40 hover:bg-[#1a1a1c] ${
                  paperType === t.id
                    ? "border-[#ff4e1a]/60 bg-[#ff4e1a]/5"
                    : "border-[#2c2c30] bg-[#0c0c0d]"
                }`}
              >
                <span className="text-2xl">{t.icon}</span>
                <h3 className="font-mono text-sm font-semibold text-[#f5f0eb] mt-2">
                  {t.label}
                </h3>
                <p className="font-mono text-[10px] text-[#52504e] mt-1">{t.desc}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* STEP 1: Write raw draft */}
      {step === 1 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h1 className="font-mono text-lg font-bold text-[#f5f0eb]">
              <Edit3 className="w-5 h-5 inline mr-2 text-[#ff4e1a]" />
              Write Your Draft
            </h1>
            <button
              onClick={() => setStep(0)}
              className="font-mono text-xs text-[#52504e] hover:text-[#ff4e1a] flex items-center gap-1"
            >
              <ArrowLeft className="w-3 h-3" /> Back
            </button>
          </div>
          <p className="font-mono text-xs text-[#9a9490]">
            Write your ideas freely. Don&apos;t worry about format — our AI will
            structure it for you. Minimum 50 characters.
          </p>

          <input
            type="text"
            placeholder="Paper title (optional — AI will suggest one)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full bg-[#0c0c0d] border border-[#2c2c30] rounded-lg px-3 py-2 font-mono text-sm text-[#f5f0eb] placeholder:text-[#52504e] focus:border-[#ff4e1a]/40 focus:outline-none"
          />

          <textarea
            placeholder="Write your research idea, hypothesis, methodology, and findings here..."
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            rows={16}
            className="w-full bg-[#0c0c0d] border border-[#2c2c30] rounded-lg px-3 py-2 font-mono text-xs text-[#f5f0eb] placeholder:text-[#52504e] focus:border-[#ff4e1a]/40 focus:outline-none resize-y leading-relaxed"
          />

          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] text-[#52504e]">
              {rawText.length} chars · {countWords(rawText)} words
            </span>
            <div className="flex gap-2">
              <button
                onClick={handleUseTemplate}
                className="font-mono text-xs px-3 py-1.5 rounded border border-[#2c2c30] text-[#9a9490] hover:text-[#f5f0eb] hover:bg-[#1a1a1c] transition-colors"
              >
                <FileText className="w-3 h-3 inline mr-1" />
                Use Template
              </button>
              <button
                onClick={() => {
                  setStep(2);
                  handleFormat();
                }}
                disabled={rawText.trim().length < 50 || loading}
                className="font-mono text-xs px-4 py-1.5 rounded bg-[#ff4e1a] text-black font-bold hover:bg-[#ff6a3a] transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                {loading ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Sparkles className="w-3 h-3" />
                )}
                Format with AI
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 2: Loading / Formatting */}
      {step === 2 && loading && (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-[#ff4e1a] animate-spin mb-4" />
          <p className="font-mono text-sm text-[#9a9490]">
            Formatting your paper with AI...
          </p>
          <p className="font-mono text-[10px] text-[#52504e] mt-2">
            Structuring into 7 academic sections
          </p>
        </div>
      )}

      {/* STEP 3: Preview & Edit */}
      {step === 3 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h1 className="font-mono text-lg font-bold text-[#f5f0eb]">
              <Eye className="w-5 h-5 inline mr-2 text-[#ff4e1a]" />
              Review & Edit
            </h1>
            <button
              onClick={() => setStep(1)}
              className="font-mono text-xs text-[#52504e] hover:text-[#ff4e1a] flex items-center gap-1"
            >
              <ArrowLeft className="w-3 h-3" /> Back to Draft
            </button>
          </div>

          {error && (
            <div className="border border-red-500/30 bg-red-500/10 rounded-lg p-3">
              <p className="font-mono text-xs text-red-400">{error}</p>
            </div>
          )}

          {/* Title */}
          <input
            type="text"
            placeholder="Paper title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full bg-[#0c0c0d] border border-[#2c2c30] rounded-lg px-3 py-2 font-mono text-sm font-bold text-[#f5f0eb] placeholder:text-[#52504e] focus:border-[#ff4e1a]/40 focus:outline-none"
          />

          {/* Tab bar */}
          <div className="flex gap-0.5 border-b border-[#2c2c30]">
            {(["edit", "preview"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setViewMode(m)}
                className={`flex items-center gap-1.5 px-3 py-1.5 font-mono text-xs transition-all border-b-2 -mb-px ${
                  viewMode === m
                    ? "border-[#ff4e1a] text-[#ff4e1a]"
                    : "border-transparent text-[#52504e] hover:text-[#9a9490]"
                }`}
              >
                {m === "edit" ? (
                  <Edit3 className="w-3 h-3" />
                ) : (
                  <Eye className="w-3 h-3" />
                )}
                {m === "edit" ? "Edit Markdown" : "Preview"}
              </button>
            ))}
          </div>

          {viewMode === "edit" ? (
            <textarea
              value={formatted}
              onChange={(e) => handleFormattedChange(e.target.value)}
              rows={20}
              className="w-full bg-[#0c0c0d] border border-[#2c2c30] rounded-lg px-3 py-2 font-mono text-xs text-[#f5f0eb] focus:border-[#ff4e1a]/40 focus:outline-none resize-y leading-relaxed"
            />
          ) : (
            <div className="border border-[#2c2c30] rounded-lg p-6 bg-[#0c0c0d]">
              <div
                className="prose prose-invert prose-sm max-w-none
                  prose-headings:font-mono prose-headings:text-[#f5f0eb]
                  prose-p:text-[#9a9490] prose-p:leading-relaxed
                  prose-code:font-mono prose-code:text-[#ff4e1a] prose-code:bg-[#1a1a1c] prose-code:px-1 prose-code:rounded
                  prose-a:text-[#ff7020] prose-a:no-underline hover:prose-a:underline
                  prose-blockquote:border-l-[#ff4e1a] prose-blockquote:text-[#9a9490]
                  prose-strong:text-[#f5f0eb]"
                dangerouslySetInnerHTML={{ __html: previewHtml }}
              />
            </div>
          )}

          {/* Footer actions */}
          <div className="flex items-center justify-between pt-2">
            <span
              className={`font-mono text-[10px] ${wordCount >= 500 ? "text-green-500" : "text-[#52504e]"}`}
            >
              {wordCount} / 500 words {wordCount >= 500 ? "✓" : "(minimum)"}
            </span>
            <div className="flex gap-2">
              <button
                onClick={handleDownloadPDF}
                disabled={!formatted}
                className="font-mono text-xs px-3 py-1.5 rounded border border-[#2c2c30] text-[#9a9490] hover:text-[#f5f0eb] hover:bg-[#1a1a1c] transition-colors disabled:opacity-40 flex items-center gap-1.5"
              >
                <Download className="w-3 h-3" />
                Download PDF
              </button>
              <button
                onClick={handlePublish}
                disabled={publishing || wordCount < 150}
                className="font-mono text-xs px-4 py-1.5 rounded bg-[#ff4e1a] text-black font-bold hover:bg-[#ff6a3a] transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                {publishing ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Send className="w-3 h-3" />
                )}
                Publish & Seal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 4: Success */}
      {step === 4 && result && (
        <div className="flex flex-col items-center justify-center py-12 space-y-4">
          <div className="w-16 h-16 rounded-full bg-green-500/10 border border-green-500/30 flex items-center justify-center">
            <CheckCircle className="w-8 h-8 text-green-400" />
          </div>
          <h1 className="font-mono text-lg font-bold text-[#f5f0eb]">
            Paper Published!
          </h1>
          <p className="font-mono text-xs text-[#9a9490] text-center max-w-md">
            Your paper has been published to the P2PCLAW network, signed with
            Ed25519, and sealed with a cryptographic timestamp.
          </p>

          <div className="border border-[#2c2c30] rounded-lg p-4 bg-[#0c0c0d] w-full max-w-md space-y-2">
            {result.paperId && (
              <p className="font-mono text-[10px] text-[#52504e]">
                Paper ID:{" "}
                <span className="text-[#f5f0eb]">{result.paperId}</span>
              </p>
            )}
            <p className="font-mono text-[10px] text-[#52504e]">
              Signed with Ed25519 · Stored on P2P mesh
            </p>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              onClick={handleDownloadPDF}
              className="font-mono text-xs px-4 py-2 rounded border border-[#2c2c30] text-[#9a9490] hover:text-[#f5f0eb] hover:bg-[#1a1a1c] transition-colors flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              Download PDF
            </button>
            <button
              onClick={() => {
                setStep(0);
                setRawText("");
                setFormatted("");
                setTitle("");
                setResult(null);
                setError(null);
              }}
              className="font-mono text-xs px-4 py-2 rounded bg-[#ff4e1a] text-black font-bold hover:bg-[#ff6a3a] transition-colors flex items-center gap-1.5"
            >
              <ArrowRight className="w-3.5 h-3.5" />
              Write Another
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
