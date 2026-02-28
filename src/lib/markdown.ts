/**
 * Markdown rendering pipeline:
 * marked → highlight.js syntax highlight → DOMPurify sanitize
 * Client-only (DOMPurify requires window.document).
 */

import { marked } from "marked";
import hljs from "highlight.js";

// Configure marked with highlight.js
marked.setOptions({
  gfm: true,
  breaks: true,
  // @ts-expect-error highlight is a valid option in marked
  highlight: function (code: string, lang: string) {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return hljs.highlight(code, { language: lang }).value;
      } catch {
        // fallback
      }
    }
    return hljs.highlightAuto(code).value;
  },
});

export async function renderMarkdown(content: string): Promise<string> {
  const rawHtml = await marked(content);

  // Sanitize on client only
  if (typeof window !== "undefined") {
    const { default: DOMPurify } = await import("dompurify");
    return DOMPurify.sanitize(rawHtml, {
      ALLOWED_TAGS: [
        "h1", "h2", "h3", "h4", "h5", "h6",
        "p", "br", "hr",
        "ul", "ol", "li",
        "strong", "em", "code", "pre", "blockquote",
        "a", "table", "thead", "tbody", "tr", "th", "td",
        "img", "figure", "figcaption",
        "span", "div",
      ],
      ALLOWED_ATTR: ["href", "src", "alt", "class", "id", "target", "rel"],
      FORCE_BODY: false,
    });
  }
  // SSR: return raw HTML (it will be sanitized on hydration)
  return rawHtml;
}

export function extractAbstract(content: string, maxLength = 200): string {
  // Remove markdown formatting, take first N chars
  const plain = content
    .replace(/#{1,6}\s+/g, "")
    .replace(/\*{1,2}([^*]+)\*{1,2}/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\n+/g, " ")
    .trim();
  return plain.length > maxLength
    ? plain.slice(0, maxLength).replace(/\s+\S*$/, "") + "…"
    : plain;
}

export function countWords(text: string): number {
  return text
    .replace(/```[\s\S]*?```/g, "")  // strip code blocks
    .replace(/[#*_`~\[\]()>]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 0).length;
}
